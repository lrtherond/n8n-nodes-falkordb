"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbVectorStore = exports.FalkorDbChatMemory = exports.VectorStore = exports.BaseChatMemory = void 0;
exports.getSessionId = getSessionId;
exports.getConnectionHintNoticeField = getConnectionHintNoticeField;
exports.logWrapper = logWrapper;
class BaseChatMemory {
}
exports.BaseChatMemory = BaseChatMemory;
class VectorStore {
}
exports.VectorStore = VectorStore;
class FalkorDbChatMemory extends BaseChatMemory {
    constructor(config) {
        super();
        this.sessionId = config.sessionId;
        this._graphName = config.graphName;
        this.contextWindowLength = config.contextWindowLength;
        this._credentials = config.credentials;
        this.memoryKey = config.memoryKey || 'history';
        this.inputKey = config.inputKey || 'input';
        this.outputKey = config.outputKey || 'output';
        this.returnMessages = config.returnMessages || false;
    }
    async loadMemoryVariables(_values) {
        try {
            const messages = await this.getMessages();
            if (this.returnMessages) {
                return { [this.memoryKey]: messages };
            }
            const historyString = messages.map((msg) => `${msg.type}: ${msg.content}`).join('\n');
            return { [this.memoryKey]: historyString };
        }
        catch (error) {
            return { [this.memoryKey]: this.returnMessages ? [] : '' };
        }
    }
    async saveContext(input, output) {
        const inputText = input[this.inputKey];
        const outputText = output[this.outputKey];
        if (!inputText || !outputText) {
            return;
        }
        try {
            await this.addMessage('human', inputText);
            await this.addMessage('ai', outputText);
        }
        catch (error) {
        }
    }
    async clear() {
        try {
            await this.executeQuery('MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message) DETACH DELETE m', { sessionId: this.sessionId });
        }
        catch (error) {
        }
    }
    async getMessages() {
        const query = `
			MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message)
			RETURN m.type as type, m.content as content, m.timestamp as timestamp
			ORDER BY m.timestamp DESC
			LIMIT $limit
		`;
        const result = await this.executeQuery(query, {
            sessionId: this.sessionId,
            limit: this.contextWindowLength * 2,
        });
        return result
            .map((row) => ({
            type: row.type,
            content: row.content,
            timestamp: new Date(row.timestamp),
        }))
            .reverse();
    }
    async addMessage(type, content) {
        const query = `
			MERGE (s:Session {id: $sessionId})
			CREATE (s)-[:HAS_MESSAGE]->(m:Message {
				type: $type,
				content: $content,
				timestamp: datetime()
			})
		`;
        await this.executeQuery(query, {
            sessionId: this.sessionId,
            type,
            content,
        });
    }
    async executeQuery(_query, _parameters) {
        return [];
    }
}
exports.FalkorDbChatMemory = FalkorDbChatMemory;
class FalkorDbVectorStore extends VectorStore {
    constructor(config) {
        super();
        this.collectionName = config.collectionName;
        this._dimensions = config.dimensions;
        this._credentials = config.credentials;
        this._distanceMetric = config.distanceMetric || 'cosine';
        this.similarityThreshold = config.similarityThreshold || 0.7;
    }
    async addDocuments(documents) {
        const query = `
			MERGE (c:Collection {name: $collectionName})
			UNWIND $documents AS doc
			CREATE (c)-[:CONTAINS]->(d:Document {
				id: randomUUID(),
				content: doc.content,
				metadata: doc.metadata,
				embedding: doc.embedding,
				created_at: datetime()
			})
		`;
        await this.executeQuery(query, {
            collectionName: this.collectionName,
            documents: documents.map((doc) => ({
                content: doc.pageContent,
                metadata: doc.metadata || {},
                embedding: [],
            })),
        });
    }
    async similaritySearch(_query, k, filter) {
        let cypherQuery = `
			MATCH (c:Collection {name: $collectionName})-[:CONTAINS]->(d:Document)
		`;
        const parameters = {
            collectionName: this.collectionName,
            queryEmbedding: [],
            limit: k,
            threshold: this.similarityThreshold,
        };
        if (filter && Object.keys(filter).length > 0) {
            const filterConditions = Object.entries(filter)
                .map(([key, _value]) => `d.metadata.${key} = $filter_${key}`)
                .join(' AND ');
            cypherQuery += ` WHERE ${filterConditions}`;
            Object.entries(filter).forEach(([key, value]) => {
                parameters[`filter_${key}`] = value;
            });
        }
        cypherQuery += `
			WITH d, vec.cosine_similarity(d.embedding, $queryEmbedding) AS score
			WHERE score >= $threshold
			RETURN d.content AS content, d.metadata AS metadata, score
			ORDER BY score DESC
			LIMIT $limit
		`;
        const results = await this.executeQuery(cypherQuery, parameters);
        return results.map((row) => ({
            pageContent: row.content,
            metadata: { ...row.metadata, score: row.score },
        }));
    }
    async delete(ids) {
        const query = `
			MATCH (d:Document)
			WHERE d.id IN $ids
			DETACH DELETE d
		`;
        await this.executeQuery(query, { ids });
    }
    static async fromDocuments(documents, _embeddings, config) {
        const store = new FalkorDbVectorStore(config);
        await store.addDocuments(documents);
        return store;
    }
    async executeQuery(_query, _parameters) {
        return [];
    }
}
exports.FalkorDbVectorStore = FalkorDbVectorStore;
function getSessionId(context, itemIndex) {
    var _a, _b;
    const sessionIdType = context.getNodeParameter('sessionIdType', itemIndex);
    if (sessionIdType === 'customKey') {
        return context.getNodeParameter('sessionKey', itemIndex);
    }
    const inputData = context.getInputData();
    if (inputData.length > 0 && ((_a = inputData[0].json) === null || _a === void 0 ? void 0 : _a.sessionId)) {
        return inputData[0].json.sessionId;
    }
    if (inputData.length > 0 && ((_b = inputData[0].json) === null || _b === void 0 ? void 0 : _b.chatId)) {
        return inputData[0].json.chatId;
    }
    return 'default-session';
}
function getConnectionHintNoticeField(_connectionTypes) {
    return {
        displayName: 'Connection Notice',
        name: 'connectionNotice',
        type: 'notice',
        default: '',
        displayOptions: {
            show: {
                '@version': [1],
            },
        },
    };
}
function logWrapper(instance, _context) {
    return new Proxy(instance, {
        get(target, prop) {
            const value = target[prop];
            if (typeof value === 'function') {
                return function (...args) {
                    const result = value.apply(target, args);
                    if (result instanceof Promise) {
                        return result
                            .then((res) => {
                            return res;
                        })
                            .catch((err) => {
                            throw err;
                        });
                    }
                    return result;
                };
            }
            return value;
        },
    });
}
//# sourceMappingURL=FalkorDbLangChain.js.map