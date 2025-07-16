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
			// Return empty history on error
			return { [this.memoryKey]: this.returnMessages ? [] : '' };
		}
	}

	async saveContext(input: InputValues, output: OutputValues): Promise<void> {
		const inputText = input[this.inputKey] as string;
		const outputText = output[this.outputKey] as string;

		if (!inputText || !outputText) {
			return;
		}

		try {
			await this.addMessage('human', inputText);
			await this.addMessage('ai', outputText);
		} catch (error) {
			// Failed to save context to FalkorDB
		}
	}

	async clear(): Promise<void> {
		try {
			await this.executeQuery(
				'MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message) DETACH DELETE m',
				{ sessionId: this.sessionId },
			);
		} catch (error) {
			// Failed to clear FalkorDB memory
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
				'Accept': 'application/json',
			},
			auth: {
				user: username || '',
				pass: password || '',
			},
			json: true,
		};
		
		try {
			const response = await this.httpRequest(requestOptions);
			
			if (response.result && response.result.data) {
				return response.result.data;
			}
			
			return [];
		} catch (error) {
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

	constructor(config: {
		graphName: string;
		nodeLabel: string;
		dimensions: number;
		credentials: IDataObject;
		distanceMetric?: string;
		similarityThreshold?: number;
		httpRequest: (options: IRequestOptions) => Promise<any>;
	}) {
		super();
		this.graphName = config.graphName;
		this.nodeLabel = config.nodeLabel;
		this._dimensions = config.dimensions;
		this._credentials = config.credentials;
		this._distanceMetric = config.distanceMetric || 'cosine';
		this.similarityThreshold = config.similarityThreshold || 0.7;
		this.httpRequest = config.httpRequest;
	}

	async addDocuments(documents: Document[]): Promise<void> {
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

	async similaritySearch(query: string, k: number, filter?: IDataObject): Promise<Document[]> {
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

		return results.map((row: any) => ({
			pageContent: row.content,
			metadata: { ...row.metadata, score: row.score },
		}));
	}

	async delete(ids: string[]): Promise<void> {
		const query = `
			MATCH (d:${this.nodeLabel})
			WHERE d.id IN $ids
			DETACH DELETE d
		`;

		await this.executeQuery(query, { ids });
	}

	private generatePlaceholderEmbedding(text: string): number[] {
		// Generate a deterministic placeholder embedding based on text hash
		// This is a simple placeholder - in production, use a real embedding model
		const embedding = new Array(this._dimensions).fill(0);
		let hash = 0;
		
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
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
				'Accept': 'application/json',
			},
			auth: {
				user: username || '',
				pass: password || '',
			},
			json: true,
		};
		
		try {
			const response = await this.httpRequest(requestOptions);
			
			if (response.result && response.result.data) {
				return response.result.data;
			}
			
			return [];
		} catch (error) {
			throw new Error(`FalkorDB vector store query failed: ${(error as Error).message}`);
		}
	}
}

// Utility functions for session management
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
					// console.log(`Calling ${String(prop)} with args:`, args);
					const result = value.apply(target, args);
					if (result instanceof Promise) {
						return result
							.then((res) => {
								// console.log(`${String(prop)} resolved with:`, res);
								return res;
							})
							.catch((err) => {
								// console.error(`${String(prop)} rejected with:`, err);
								throw err;
							});
					}
					// console.log(`${String(prop)} returned:`, result);
					return result;
				};
			}
			return value;
		},
	});
}
