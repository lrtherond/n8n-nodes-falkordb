import type { IDataObject } from 'n8n-workflow';

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

	constructor(config: {
		sessionId: string;
		graphName: string;
		contextWindowLength: number;
		credentials: IDataObject;
		memoryKey?: string;
		inputKey?: string;
		outputKey?: string;
		returnMessages?: boolean;
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

	private async executeQuery(_query: string, _parameters: IDataObject): Promise<any[]> {
		// In a real implementation, this would:
		// 1. Connect to FalkorDB using credentials
		// 2. Execute the Cypher query
		// 3. Return the results
		// For now, return empty array
		return [];
	}
}

// FalkorDB Vector Store implementation for LangChain
export class FalkorDbVectorStore extends VectorStore {
	private collectionName: string;
	private _dimensions: number;
	private _credentials: IDataObject;
	private _distanceMetric: string;
	private similarityThreshold: number;

	constructor(config: {
		collectionName: string;
		dimensions: number;
		credentials: IDataObject;
		distanceMetric?: string;
		similarityThreshold?: number;
	}) {
		super();
		this.collectionName = config.collectionName;
		this._dimensions = config.dimensions;
		this._credentials = config.credentials;
		this._distanceMetric = config.distanceMetric || 'cosine';
		this.similarityThreshold = config.similarityThreshold || 0.7;
	}

	async addDocuments(documents: Document[]): Promise<void> {
		// In a real implementation, this would:
		// 1. Generate embeddings for documents
		// 2. Store documents with embeddings in FalkorDB
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
				embedding: [], // Would be generated by embedding model
			})),
		});
	}

	async similaritySearch(_query: string, k: number, filter?: IDataObject): Promise<Document[]> {
		// In a real implementation, this would:
		// 1. Generate embedding for query
		// 2. Perform similarity search
		let cypherQuery = `
			MATCH (c:Collection {name: $collectionName})-[:CONTAINS]->(d:Document)
		`;

		const parameters: IDataObject = {
			collectionName: this.collectionName,
			queryEmbedding: [], // Would be generated by embedding model
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
			MATCH (d:Document)
			WHERE d.id IN $ids
			DETACH DELETE d
		`;

		await this.executeQuery(query, { ids });
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

	private async executeQuery(_query: string, _parameters: IDataObject): Promise<any[]> {
		// In a real implementation, this would:
		// 1. Connect to FalkorDB using credentials
		// 2. Execute the Cypher query
		// 3. Return the results
		// For now, return empty array
		return [];
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
