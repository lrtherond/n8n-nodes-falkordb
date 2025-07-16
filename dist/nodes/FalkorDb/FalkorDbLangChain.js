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
        this.logger = config.logger || { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
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
            this.logger.error('FalkorDB Memory: Failed to load memory variables', {
                error: error.message,
                stack: error.stack,
                sessionId: this.sessionId,
                graphName: this._graphName,
                memoryKey: this.memoryKey,
            });
            return { [this.memoryKey]: this.returnMessages ? [] : '' };
        }
    }
    async saveContext(input, output) {
        const inputText = input[this.inputKey];
        const outputText = output[this.outputKey];
        if (!inputText || !outputText) {
            this.logger.warn('FalkorDB Memory: Missing input or output text for context save', {
                hasInput: !!inputText,
                hasOutput: !!outputText,
                sessionId: this.sessionId,
                inputKey: this.inputKey,
                outputKey: this.outputKey,
            });
            return;
        }
        try {
            this.logger.debug('FalkorDB Memory: Saving context', {
                sessionId: this.sessionId,
                inputLength: inputText.length,
                outputLength: outputText.length,
            });
            await this.addMessage('human', inputText);
            await this.addMessage('ai', outputText);
        }
        catch (error) {
            this.logger.error('FalkorDB Memory: Failed to save context', {
                error: error.message,
                stack: error.stack,
                sessionId: this.sessionId,
                graphName: this._graphName,
                inputText: inputText.substring(0, 100) + '...',
                outputText: outputText.substring(0, 100) + '...',
            });
        }
    }
    async clear() {
        try {
            this.logger.debug('FalkorDB Memory: Clearing memory', {
                sessionId: this.sessionId,
                graphName: this._graphName,
            });
            await this.executeQuery('MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message) DETACH DELETE m', { sessionId: this.sessionId });
        }
        catch (error) {
            this.logger.error('FalkorDB Memory: Failed to clear memory', {
                error: error.message,
                stack: error.stack,
                sessionId: this.sessionId,
                graphName: this._graphName,
            });
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
        var _a, _b;
        const host = this._credentials.host;
        const port = this._credentials.port;
        const ssl = this._credentials.ssl;
        const username = this._credentials.username;
        const password = this._credentials.password;
        const graphName = this._graphName;
        const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;
        this.logger.debug('FalkorDB Memory: Executing query', {
            query: query.substring(0, 100) + '...',
            parameters,
            baseURL,
            graphName,
        });
        try {
            const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest, this.logger);
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
                    Accept: 'application/json',
                    Cookie: cookies,
                },
                json: true,
            };
            this.logger.debug('FalkorDB Memory: Making API request', {
                url: `${baseURL}${endpoint}`,
                method: requestOptions.method,
                hasCookies: !!cookies,
            });
            const response = await this.httpRequest(requestOptions);
            this.logger.debug('FalkorDB Memory: Query response received', {
                hasResult: !!response.result,
                hasData: !!(response.result && response.result.data),
                dataLength: ((_b = (_a = response.result) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.length) || 0,
            });
            if (response.result && response.result.data) {
                return response.result.data;
            }
            return [];
        }
        catch (error) {
            this.logger.error('FalkorDB Memory: Query execution failed', {
                error: error.message,
                stack: error.stack,
                query: query.substring(0, 100) + '...',
                parameters,
                baseURL,
                graphName,
            });
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
        this.logger = config.logger || { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
    }
    async addDocuments(documents) {
        try {
            this.logger.debug('FalkorDB Vector Store: Adding documents', {
                documentCount: documents.length,
                nodeLabel: this.nodeLabel,
                graphName: this.graphName,
            });
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
            this.logger.debug('FalkorDB Vector Store: Documents added successfully', {
                documentCount: documents.length,
            });
        }
        catch (error) {
            this.logger.error('FalkorDB Vector Store: Failed to add documents', {
                error: error.message,
                stack: error.stack,
                documentCount: documents.length,
                nodeLabel: this.nodeLabel,
                graphName: this.graphName,
            });
            throw error;
        }
    }
    async similaritySearch(query, k, filter) {
        try {
            this.logger.debug('FalkorDB Vector Store: Performing similarity search', {
                query: query.substring(0, 100) + '...',
                k,
                filter,
                nodeLabel: this.nodeLabel,
                threshold: this.similarityThreshold,
            });
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
            this.logger.debug('FalkorDB Vector Store: Similarity search completed', {
                resultCount: results.length,
                query: query.substring(0, 100) + '...',
            });
            return results.map((row) => ({
                pageContent: row.content,
                metadata: { ...row.metadata, score: row.score },
            }));
        }
        catch (error) {
            this.logger.error('FalkorDB Vector Store: Similarity search failed', {
                error: error.message,
                stack: error.stack,
                query: query.substring(0, 100) + '...',
                k,
                filter,
                nodeLabel: this.nodeLabel,
            });
            throw error;
        }
    }
    async delete(ids) {
        try {
            this.logger.debug('FalkorDB Vector Store: Deleting documents', {
                ids,
                idCount: ids.length,
                nodeLabel: this.nodeLabel,
            });
            const query = `
				MATCH (d:${this.nodeLabel})
				WHERE d.id IN $ids
				DETACH DELETE d
			`;
            await this.executeQuery(query, { ids });
            this.logger.debug('FalkorDB Vector Store: Documents deleted successfully', {
                idCount: ids.length,
            });
        }
        catch (error) {
            this.logger.error('FalkorDB Vector Store: Failed to delete documents', {
                error: error.message,
                stack: error.stack,
                ids,
                idCount: ids.length,
                nodeLabel: this.nodeLabel,
            });
            throw error;
        }
    }
    generatePlaceholderEmbedding(text) {
        const embedding = new Array(this._dimensions).fill(0);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = (hash << 5) - hash + char;
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
        var _a, _b;
        const host = this._credentials.host;
        const port = this._credentials.port;
        const ssl = this._credentials.ssl;
        const username = this._credentials.username;
        const password = this._credentials.password;
        const graphName = this.graphName;
        const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;
        this.logger.debug('FalkorDB Vector Store: Executing query', {
            query: query.substring(0, 100) + '...',
            parameters,
            baseURL,
            graphName,
        });
        try {
            const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest, this.logger);
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
                    Accept: 'application/json',
                    Cookie: cookies,
                },
                json: true,
            };
            this.logger.debug('FalkorDB Vector Store: Making API request', {
                url: `${baseURL}${endpoint}`,
                method: requestOptions.method,
                hasCookies: !!cookies,
            });
            const response = await this.httpRequest(requestOptions);
            this.logger.debug('FalkorDB Vector Store: Query response received', {
                hasResult: !!response.result,
                hasData: !!(response.result && response.result.data),
                dataLength: ((_b = (_a = response.result) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.length) || 0,
            });
            if (response.result && response.result.data) {
                return response.result.data;
            }
            return [];
        }
        catch (error) {
            this.logger.error('FalkorDB Vector Store: Query execution failed', {
                error: error.message,
                stack: error.stack,
                query: query.substring(0, 100) + '...',
                parameters,
                baseURL,
                graphName,
            });
            throw new Error(`FalkorDB vector store query failed: ${error.message}`);
        }
    }
}
exports.FalkorDbVectorStore = FalkorDbVectorStore;
async function getSessionCookies(baseURL, username, password, httpRequest, logger) {
    var _a, _b, _c;
    const log = logger || { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
    try {
        log.debug('FalkorDB Auth: Getting session cookies', {
            baseURL,
            username,
            hasPassword: !!password,
        });
        const providersResponse = await httpRequest({
            method: 'GET',
            baseURL,
            url: '/api/auth/providers',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            json: true,
        });
        log.debug('FalkorDB Auth: Providers response received', {
            hasCredentials: !!providersResponse.credentials,
            hasSigninUrl: !!((_a = providersResponse.credentials) === null || _a === void 0 ? void 0 : _a.signinUrl),
        });
        const signinUrl = (_b = providersResponse.credentials) === null || _b === void 0 ? void 0 : _b.signinUrl;
        if (!signinUrl) {
            log.error('FalkorDB Auth: Missing signin URL from providers', {
                providersResponse,
            });
            throw new Error('Failed to get signin URL from FalkorDB auth providers');
        }
        const signinPath = signinUrl.replace(/^https?:\/\/[^\/]+/, '');
        log.debug('FalkorDB Auth: Signing in with credentials', {
            signinPath,
            username,
        });
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
                Accept: 'application/json',
            },
            json: true,
        });
        const setCookieHeaders = ((_c = signinResponse.headers) === null || _c === void 0 ? void 0 : _c['set-cookie']) || [];
        const cookies = setCookieHeaders.map((cookie) => cookie.split(';')[0]).join('; ');
        log.debug('FalkorDB Auth: Session cookies extracted', {
            cookieCount: setCookieHeaders.length,
            hasCookies: !!cookies,
        });
        return cookies;
    }
    catch (error) {
        log.error('FalkorDB Auth: Session cookie authentication failed', {
            error: error.message,
            stack: error.stack,
            baseURL,
            username,
        });
        throw error;
    }
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