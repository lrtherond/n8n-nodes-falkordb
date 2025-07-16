"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbVectorStore = exports.FalkorDbChatMemory = exports.VectorStore = exports.BaseChatMemory = void 0;
exports.getSessionCookies = getSessionCookies;
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
        this.httpRequest = config.httpRequest;
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
    async executeQuery(query, parameters) {
        const host = this._credentials.host;
        const port = this._credentials.port;
        const ssl = this._credentials.ssl;
        const username = this._credentials.username;
        const password = this._credentials.password;
        const graphName = this._graphName;
        const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;
        const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest);
        const endpoint = `/api/graph/${graphName}`;
        const requestOptions = {
            method: 'POST',
            baseURL,
            url: endpoint,
            body: {
                query,
                parameters,
            },
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cookie': cookies,
            },
            json: true,
        };
        try {
            const response = await this.httpRequest(requestOptions);
            if (response.result && response.result.data) {
                return response.result.data;
            }
            return [];
        }
        catch (error) {
            throw new Error(`FalkorDB memory query failed: ${error.message}`);
        }
    }
}
exports.FalkorDbChatMemory = FalkorDbChatMemory;
class FalkorDbVectorStore extends VectorStore {
    constructor(config) {
        super();
        this.graphName = config.graphName;
        this.nodeLabel = config.nodeLabel;
        this._dimensions = config.dimensions;
        this._credentials = config.credentials;
        this._distanceMetric = config.distanceMetric || 'cosine';
        this.similarityThreshold = config.similarityThreshold || 0.7;
        this.httpRequest = config.httpRequest;
    }
    async addDocuments(documents) {
        const query = `
			UNWIND $documents AS doc
			CREATE (d:${this.nodeLabel} {
				id: randomUUID(),
				content: doc.content,
				metadata: doc.metadata,
				embedding: doc.embedding,
				created_at: datetime()
			})
		`;
        await this.executeQuery(query, {
            documents: documents.map((doc) => ({
                content: doc.pageContent,
                metadata: doc.metadata || {},
                embedding: this.generatePlaceholderEmbedding(doc.pageContent),
            })),
        });
    }
    async similaritySearch(query, k, filter) {
        let cypherQuery = `
			MATCH (d:${this.nodeLabel})
		`;
        const parameters = {
            queryEmbedding: this.generatePlaceholderEmbedding(query),
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
			MATCH (d:${this.nodeLabel})
			WHERE d.id IN $ids
			DETACH DELETE d
		`;
        await this.executeQuery(query, { ids });
    }
    generatePlaceholderEmbedding(text) {
        const embedding = new Array(this._dimensions).fill(0);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        for (let i = 0; i < this._dimensions; i++) {
            embedding[i] = Math.sin(hash * (i + 1)) * 0.1 + Math.cos(hash * (i + 2)) * 0.1;
        }
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }
        return embedding;
    }
    static async fromDocuments(documents, _embeddings, config) {
        const store = new FalkorDbVectorStore(config);
        await store.addDocuments(documents);
        return store;
    }
    async executeQuery(query, parameters) {
        const host = this._credentials.host;
        const port = this._credentials.port;
        const ssl = this._credentials.ssl;
        const username = this._credentials.username;
        const password = this._credentials.password;
        const graphName = this.graphName;
        const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;
        const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest);
        const endpoint = `/api/graph/${graphName}`;
        const requestOptions = {
            method: 'POST',
            baseURL,
            url: endpoint,
            body: {
                query,
                parameters,
            },
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cookie': cookies,
            },
            json: true,
        };
        try {
            const response = await this.httpRequest(requestOptions);
            if (response.result && response.result.data) {
                return response.result.data;
            }
            return [];
        }
        catch (error) {
            throw new Error(`FalkorDB vector store query failed: ${error.message}`);
        }
    }
}
exports.FalkorDbVectorStore = FalkorDbVectorStore;
async function getSessionCookies(baseURL, username, password, httpRequest) {
    var _a, _b;
    const providersResponse = await httpRequest({
        method: 'GET',
        baseURL,
        url: '/api/auth/providers',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        json: true,
    });
    const signinUrl = (_a = providersResponse.credentials) === null || _a === void 0 ? void 0 : _a.signinUrl;
    if (!signinUrl) {
        throw new Error('Failed to get signin URL from FalkorDB auth providers');
    }
    const signinPath = signinUrl.replace(/^https?:\/\/[^\/]+/, '');
    const signinResponse = await httpRequest({
        method: 'POST',
        baseURL,
        url: signinPath,
        body: {
            username,
            password,
        },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        json: true,
    });
    const setCookieHeaders = ((_b = signinResponse.headers) === null || _b === void 0 ? void 0 : _b['set-cookie']) || [];
    const cookies = setCookieHeaders.map((cookie) => cookie.split(';')[0]).join('; ');
    return cookies;
}
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