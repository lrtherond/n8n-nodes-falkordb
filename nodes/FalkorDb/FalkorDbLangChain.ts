import type { IDataObject, IHttpRequestOptions, IRequestOptions } from 'n8n-workflow';

// LangChain-compatible interfaces
export interface Document {
	pageContent: string;
	metadata?: IDataObject;
}

export interface ChatMessage {
	type: 'human' | 'ai' | 'system';
	content: string;
	timestamp?: Date;
}

export interface MemoryVariables {
	[key: string]: string | ChatMessage[];
}

export interface InputValues {
	[key: string]: any;
}

export interface OutputValues {
	[key: string]: any;
}

// Base interfaces for LangChain integration
export abstract class BaseChatMemory {
	abstract loadMemoryVariables(values: InputValues): Promise<MemoryVariables>;
	abstract saveContext(input: InputValues, output: OutputValues): Promise<void>;
	abstract clear(): Promise<void>;
}

export abstract class VectorStore {
	abstract addDocuments(documents: Document[]): Promise<void>;
	abstract similaritySearch(query: string, k: number, filter?: IDataObject): Promise<Document[]>;
	abstract delete(ids: string[]): Promise<void>;
}

// FalkorDB Memory implementation for LangChain
export class FalkorDbChatMemory extends BaseChatMemory {
	private sessionId: string;
	private _graphName: string;
	private contextWindowLength: number;
	private _credentials: IDataObject;
	private memoryKey: string;
	private inputKey: string;
	private outputKey: string;
	private returnMessages: boolean;
	private httpRequest: (options: IRequestOptions) => Promise<any>;
	private logger: any;

	constructor(config: {
		sessionId: string;
		graphName: string;
		contextWindowLength: number;
		credentials: IDataObject;
		memoryKey?: string;
		inputKey?: string;
		outputKey?: string;
		returnMessages?: boolean;
		httpRequest: (options: IRequestOptions) => Promise<any>;
		logger?: any;
	}) {
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
		this.logger = config.logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
	}

	async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
		try {
			const messages = await this.getMessages();

			if (this.returnMessages) {
				return { [this.memoryKey]: messages };
			}

			// Convert messages to string format
			const historyString = messages.map((msg) => `${msg.type}: ${msg.content}`).join('\n');

			return { [this.memoryKey]: historyString };
		} catch (error) {
			this.logger.error('FalkorDB Memory: Failed to load memory variables', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				sessionId: this.sessionId,
				graphName: this._graphName,
				memoryKey: this.memoryKey,
			});
			// Return empty history on error
			return { [this.memoryKey]: this.returnMessages ? [] : '' };
		}
	}

	async saveContext(input: InputValues, output: OutputValues): Promise<void> {
		const inputText = input[this.inputKey] as string;
		const outputText = output[this.outputKey] as string;

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
		} catch (error) {
			this.logger.error('FalkorDB Memory: Failed to save context', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				sessionId: this.sessionId,
				graphName: this._graphName,
				inputText: inputText.substring(0, 100) + '...',
				outputText: outputText.substring(0, 100) + '...',
			});
		}
	}

	async clear(): Promise<void> {
		try {
			this.logger.debug('FalkorDB Memory: Clearing memory', {
				sessionId: this.sessionId,
				graphName: this._graphName,
			});
			await this.executeQuery(
				'MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message) DETACH DELETE m',
				{ sessionId: this.sessionId },
			);
		} catch (error) {
			this.logger.error('FalkorDB Memory: Failed to clear memory', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				sessionId: this.sessionId,
				graphName: this._graphName,
			});
		}
	}

	private async getMessages(): Promise<ChatMessage[]> {
		const query = `
			MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message)
			RETURN m.type as type, m.content as content, m.timestamp as timestamp
			ORDER BY m.timestamp DESC
			LIMIT $limit
		`;

		const result = await this.executeQuery(query, {
			sessionId: this.sessionId,
			limit: this.contextWindowLength * 2, // Account for both human and AI messages
		});

		return result
			.map((row: any) => ({
				type: row.type,
				content: row.content,
				timestamp: new Date(row.timestamp),
			}))
			.reverse(); // Reverse to get chronological order
	}

	private async addMessage(type: 'human' | 'ai' | 'system', content: string): Promise<void> {
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

	private async executeQuery(query: string, parameters: IDataObject): Promise<any[]> {
		const host = this._credentials.host as string;
		const port = this._credentials.port as number;
		const ssl = this._credentials.ssl as boolean;
		const username = this._credentials.username as string;
		const password = this._credentials.password as string;
		const graphName = this._graphName;

		const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;

		this.logger.debug('FalkorDB Memory: Executing query', {
			query: query.substring(0, 100) + '...',
			parameters,
			baseURL,
			graphName,
		});

		try {
			// Get authentication session cookies
			const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest, this.logger);

			const endpoint = `/api/graph/${graphName}`;

			const requestOptions: IRequestOptions = {
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
				dataLength: response.result?.data?.length || 0,
			});

			if (response.result && response.result.data) {
				return response.result.data;
			}

			return [];
		} catch (error) {
			this.logger.error('FalkorDB Memory: Query execution failed', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				query: query.substring(0, 100) + '...',
				parameters,
				baseURL,
				graphName,
			});
			throw new Error(`FalkorDB memory query failed: ${(error as Error).message}`);
		}
	}
}

// FalkorDB Vector Store implementation for LangChain
export class FalkorDbVectorStore extends VectorStore {
	private graphName: string;
	private nodeLabel: string;
	private _dimensions: number;
	private _credentials: IDataObject;
	private _distanceMetric: string;
	private similarityThreshold: number;
	private httpRequest: (options: IRequestOptions) => Promise<any>;
	private logger: any;

	constructor(config: {
		graphName: string;
		nodeLabel: string;
		dimensions: number;
		credentials: IDataObject;
		distanceMetric?: string;
		similarityThreshold?: number;
		httpRequest: (options: IRequestOptions) => Promise<any>;
		logger?: any;
	}) {
		super();
		this.graphName = config.graphName;
		this.nodeLabel = config.nodeLabel;
		this._dimensions = config.dimensions;
		this._credentials = config.credentials;
		this._distanceMetric = config.distanceMetric || 'cosine';
		this.similarityThreshold = config.similarityThreshold || 0.7;
		this.httpRequest = config.httpRequest;
		this.logger = config.logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
	}

	async addDocuments(documents: Document[]): Promise<void> {
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
		} catch (error) {
			this.logger.error('FalkorDB Vector Store: Failed to add documents', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				documentCount: documents.length,
				nodeLabel: this.nodeLabel,
				graphName: this.graphName,
			});
			throw error;
		}
	}

	async similaritySearch(query: string, k: number, filter?: IDataObject): Promise<Document[]> {
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

			const parameters: IDataObject = {
				queryEmbedding: this.generatePlaceholderEmbedding(query),
				limit: k,
				threshold: this.similarityThreshold,
			};

			// Add metadata filter if provided
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

			return results.map((row: any) => ({
				pageContent: row.content,
				metadata: { ...row.metadata, score: row.score },
			}));
		} catch (error) {
			this.logger.error('FalkorDB Vector Store: Similarity search failed', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				query: query.substring(0, 100) + '...',
				k,
				filter,
				nodeLabel: this.nodeLabel,
			});
			throw error;
		}
	}

	async delete(ids: string[]): Promise<void> {
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
		} catch (error) {
			this.logger.error('FalkorDB Vector Store: Failed to delete documents', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				ids,
				idCount: ids.length,
				nodeLabel: this.nodeLabel,
			});
			throw error;
		}
	}

	private generatePlaceholderEmbedding(text: string): number[] {
		// Generate a deterministic placeholder embedding based on text hash
		// This is a simple placeholder - in production, use a real embedding model
		const embedding = new Array(this._dimensions).fill(0);
		let hash = 0;

		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}

		// Create a simple pattern based on hash
		for (let i = 0; i < this._dimensions; i++) {
			embedding[i] = Math.sin(hash * (i + 1)) * 0.1 + Math.cos(hash * (i + 2)) * 0.1;
		}

		// Normalize the embedding vector
		const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
		if (magnitude > 0) {
			for (let i = 0; i < embedding.length; i++) {
				embedding[i] /= magnitude;
			}
		}

		return embedding;
	}

	static async fromDocuments(
		documents: Document[],
		_embeddings: any, // Embedding function/model
		config: any,
	): Promise<FalkorDbVectorStore> {
		const store = new FalkorDbVectorStore(config);
		await store.addDocuments(documents);
		return store;
	}

	private async executeQuery(query: string, parameters: IDataObject): Promise<any[]> {
		const host = this._credentials.host as string;
		const port = this._credentials.port as number;
		const ssl = this._credentials.ssl as boolean;
		const username = this._credentials.username as string;
		const password = this._credentials.password as string;
		const graphName = this.graphName;

		const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;

		this.logger.debug('FalkorDB Vector Store: Executing query', {
			query: query.substring(0, 100) + '...',
			parameters,
			baseURL,
			graphName,
		});

		try {
			// Get authentication session cookies
			const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest, this.logger);

			const endpoint = `/api/graph/${graphName}`;

			const requestOptions: IRequestOptions = {
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
				dataLength: response.result?.data?.length || 0,
			});

			if (response.result && response.result.data) {
				return response.result.data;
			}

			return [];
		} catch (error) {
			this.logger.error('FalkorDB Vector Store: Query execution failed', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				query: query.substring(0, 100) + '...',
				parameters,
				baseURL,
				graphName,
			});
			throw new Error(`FalkorDB vector store query failed: ${(error as Error).message}`);
		}
	}
}

// Utility functions for session management
export async function getSessionCookies(
	baseURL: string,
	username: string,
	password: string,
	httpRequest: (options: IRequestOptions) => Promise<any>,
	logger?: any,
): Promise<string> {
	const log = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
	try {
		log.debug('FalkorDB Auth: Getting session cookies', {
			baseURL,
			username,
			hasPassword: !!password,
		});

		// Get authentication providers
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
			hasSigninUrl: !!providersResponse.credentials?.signinUrl,
		});

		const signinUrl = providersResponse.credentials?.signinUrl;
		if (!signinUrl) {
			log.error('FalkorDB Auth: Missing signin URL from providers', {
				providersResponse,
			});
			throw new Error('Failed to get signin URL from FalkorDB auth providers');
		}

		// Parse the signin URL to get the path
		const signinPath = signinUrl.replace(/^https?:\/\/[^\/]+/, '');

		log.debug('FalkorDB Auth: Signing in with credentials', {
			signinPath,
			username,
		});

		// Sign in with credentials
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

		// Extract session cookies from response headers
		const setCookieHeaders = signinResponse.headers?.['set-cookie'] || [];
		const cookies = setCookieHeaders.map((cookie: string) => cookie.split(';')[0]).join('; ');

		log.debug('FalkorDB Auth: Session cookies extracted', {
			cookieCount: setCookieHeaders.length,
			hasCookies: !!cookies,
		});

		return cookies;
	} catch (error) {
		log.error('FalkorDB Auth: Session cookie authentication failed', {
			error: (error as Error).message,
			stack: (error as Error).stack,
			baseURL,
			username,
		});
		throw error;
	}
}

export function getSessionId(context: any, itemIndex: number): string {
	const sessionIdType = context.getNodeParameter('sessionIdType', itemIndex) as string;

	if (sessionIdType === 'customKey') {
		return context.getNodeParameter('sessionKey', itemIndex) as string;
	}

	// Try to get from input data
	const inputData = context.getInputData();
	if (inputData.length > 0 && inputData[0].json?.sessionId) {
		return inputData[0].json.sessionId as string;
	}

	// Try to get from chat trigger
	if (inputData.length > 0 && inputData[0].json?.chatId) {
		return inputData[0].json.chatId as string;
	}

	// Fallback to default
	return 'default-session';
}

// Connection hint utility
export function getConnectionHintNoticeField(_connectionTypes: string[]): any {
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

// Logging wrapper for debugging
export function logWrapper(instance: any, _context: any): any {
	return new Proxy(instance, {
		get(target, prop) {
			const value = target[prop];
			if (typeof value === 'function') {
				return function (...args: any[]) {
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

