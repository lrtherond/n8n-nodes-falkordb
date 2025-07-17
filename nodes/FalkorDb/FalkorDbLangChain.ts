import type { IDataObject, IRequestOptions } from 'n8n-workflow';
import { BaseChatMemory } from '@langchain/community/memory/chat_memory';
import type { Document } from '@langchain/core/documents';
import type { InputValues, MemoryVariables, OutputValues } from '@langchain/core/memory';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

// Knowledge Graph Entity and Relationship Types
export interface GraphEntity {
	id: string;
	type: string;
	name: string;
	properties?: IDataObject;
}

export interface GraphRelationship {
	id: string;
	type: string;
	from: string;
	to: string;
	properties?: IDataObject;
}

export interface EntityExtractionResult {
	entities: GraphEntity[];
	relationships: GraphRelationship[];
}

// AI-Powered Entity and Relationship Extraction
export class AIEntityExtractor {
	private aiModel: any;
	private logger: any;

	constructor(aiModel: any, logger?: any) {
		this.aiModel = aiModel;
		this.logger = logger || {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
		};
	}

	async extractEntitiesAndRelationships(text: string): Promise<EntityExtractionResult> {
		try {
			const prompt = `You are an expert entity and relationship extractor. Extract entities and relationships from the following text.

Format your response as valid JSON only, no additional text:
{
  "entities": [
    {"name": "entity_name", "type": "Person|Food|Company|Interest|Location|Object", "id": "type_name"}
  ],
  "relationships": [
    {"from": "entity_id", "to": "entity_id", "type": "LOVES|LIKES|HATES|WORKS_AT|LIVES_IN|KNOWS|OWNS", "confidence": 0.0-1.0}
  ]
}

Rules:
- Use lowercase IDs with underscores: "person_laurent", "food_apples"
- Common entity types: Person, Food, Company, Interest, Location, Object
- Common relationships: LOVES, LIKES, HATES, WORKS_AT, LIVES_IN, KNOWS, OWNS
- Include confidence scores (0.0-1.0)
- Extract ALL entities and relationships, not just the obvious ones

TEXT: "${text}"`;

			this.logger.debug('AIEntityExtractor: Sending extraction prompt to AI model', {
				textLength: text.length,
				promptLength: prompt.length,
			});

			const response = await this.aiModel.invoke(prompt);
			const aiResponse = response.content || response.text || response;

			this.logger.debug('AIEntityExtractor: Received AI response', {
				responseLength: aiResponse.length,
				response: aiResponse.substring(0, 200) + '...',
			});

			// Parse the JSON response
			const parsed = JSON.parse(aiResponse);
			
			// Validate and clean the response
			const entities: GraphEntity[] = (parsed.entities || []).map((e: any) => ({
				id: e.id || `${e.type.toLowerCase()}_${e.name.replace(/\s+/g, '_').toLowerCase()}`,
				type: e.type,
				name: e.name,
				properties: { confidence: e.confidence || 0.8 }
			}));

			const relationships: GraphRelationship[] = (parsed.relationships || []).map((r: any) => ({
				id: `${r.from}_${r.type}_${r.to}`,
				type: r.type,
				from: r.from,
				to: r.to,
				properties: { 
					confidence: r.confidence || 0.8,
					extractedFrom: text.substring(0, 100) + '...'
				}
			}));

			this.logger.debug('AIEntityExtractor: Extraction completed', {
				entityCount: entities.length,
				relationshipCount: relationships.length,
				entities: entities.map(e => e.name),
				relationships: relationships.map(r => `${r.from} ${r.type} ${r.to}`),
			});

			return { entities, relationships };
		} catch (error) {
			this.logger.error('AIEntityExtractor: Extraction failed', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				textLength: text.length,
			});
			
			// Fallback to simple extraction if AI fails
			return SimpleNLPExtractor.extractEntitiesAndRelationships(text);
		}
	}

	async generateContextQuery(inputText: string, availableEntityTypes: string[], availableRelationships: string[]): Promise<string> {
		try {
			const prompt = `You are a knowledge graph query expert. Generate a Cypher query to find relevant context for the user's message.

Available entity types: ${availableEntityTypes.join(', ')}
Available relationships: ${availableRelationships.join(', ')}

Generate a Cypher query to find relevant facts about entities mentioned in: "${inputText}"

Requirements:
- Return only the Cypher query, no additional text
- Use MATCH, OPTIONAL MATCH, and WHERE clauses appropriately
- Look for direct and indirect relationships
- Include entity names, types, and relationship types in results
- Limit results to 20 most relevant items
- Focus on entities that might be relevant to the user's current message

Example format:
MATCH (e:Person) WHERE e.name CONTAINS 'Laurent'
OPTIONAL MATCH (e)-[r]-(related)
RETURN e.name, e.type, r.type, related.name, related.type
LIMIT 20`;

			this.logger.debug('AIEntityExtractor: Generating context query', {
				inputText: inputText.substring(0, 100) + '...',
				availableEntityTypes: availableEntityTypes.length,
				availableRelationships: availableRelationships.length,
			});

			const response = await this.aiModel.invoke(prompt);
			const query = response.content || response.text || response;

			this.logger.debug('AIEntityExtractor: Generated context query', {
				queryLength: query.length,
				query: query.substring(0, 200) + '...',
			});

			return query.trim();
		} catch (error) {
			this.logger.error('AIEntityExtractor: Query generation failed', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				inputText: inputText.substring(0, 100) + '...',
			});
			
			// Fallback to simple query
			return `MATCH (e) WHERE e.name CONTAINS '${inputText.split(' ')[0]}' OPTIONAL MATCH (e)-[r]-(related) RETURN e.name, e.type, r.type, related.name, related.type LIMIT 10`;
		}
	}
}

// Simple Entity and Relationship Extraction (Fallback)
export class SimpleNLPExtractor {
	private static readonly ENTITY_PATTERNS = [
		// Person patterns
		{ pattern: /\b(I|me|my|myself)\b/gi, type: 'Person', getValue: () => 'User' },
		{ pattern: /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, type: 'Person', getValue: (match: string) => match.trim() },
		{ pattern: /\b([A-Z][a-z]+)\b(?=\s+(?:loves|likes|hates|enjoys|eats|drinks|works|lives))/g, type: 'Person', getValue: (match: string) => match.trim() },
		
		// Object/Concept patterns
		{ pattern: /\b(apples?|oranges?|bananas?|pizza|coffee|tea|water|food)\b/gi, type: 'Food', getValue: (match: string) => match.toLowerCase() },
		{ pattern: /\b(music|movies?|books?|sports?|games?|art)\b/gi, type: 'Interest', getValue: (match: string) => match.toLowerCase() },
		{ pattern: /\b(work|job|career|profession)\b/gi, type: 'Occupation', getValue: (match: string) => match.toLowerCase() },
	];

	private static readonly RELATIONSHIP_PATTERNS = [
		{ pattern: /\b(loves?|really likes?|enjoys?)\b/gi, type: 'LOVES' },
		{ pattern: /\b(likes?|prefers?)\b/gi, type: 'LIKES' },
		{ pattern: /\b(hates?|dislikes?|despises?)\b/gi, type: 'HATES' },
		{ pattern: /\b(works? (?:as|at)|employed (?:as|at))\b/gi, type: 'WORKS_AS' },
		{ pattern: /\b(lives? (?:in|at)|resides? (?:in|at))\b/gi, type: 'LIVES_IN' },
		{ pattern: /\b(knows?|friends? with|acquainted with)\b/gi, type: 'KNOWS' },
		{ pattern: /\b(owns?|has|possesses?)\b/gi, type: 'OWNS' },
	];

	static extractEntitiesAndRelationships(text: string): EntityExtractionResult {
		const entities: GraphEntity[] = [];
		const relationships: GraphRelationship[] = [];
		const entityMap = new Map<string, GraphEntity>();

		// Extract entities
		this.ENTITY_PATTERNS.forEach(({ pattern, type, getValue }) => {
			const matches = text.matchAll(pattern);
			for (const match of matches) {
				const entityName = getValue(match[0]);
				const entityKey = `${type}:${entityName}`;
				
				if (!entityMap.has(entityKey)) {
					const entity: GraphEntity = {
						id: `${type.toLowerCase()}_${entityName.replace(/\s+/g, '_').toLowerCase()}`,
						type,
						name: entityName,
						properties: {}
					};
					entities.push(entity);
					entityMap.set(entityKey, entity);
				}
			}
		});

		// Extract relationships
		this.RELATIONSHIP_PATTERNS.forEach(({ pattern, type }) => {
			const matches = text.matchAll(pattern);
			for (const match of matches) {
				const relationshipIndex = match.index!;
				const beforeText = text.substring(Math.max(0, relationshipIndex - 50), relationshipIndex);
				const afterText = text.substring(relationshipIndex + match[0].length, Math.min(text.length, relationshipIndex + match[0].length + 50));

				// Find subject (entity before relationship)
				const subjectEntities = entities.filter(e => 
					beforeText.toLowerCase().includes(e.name.toLowerCase()) ||
					(e.name === 'User' && beforeText.match(/\b(I|me|my)\b/i))
				);

				// Find object (entity after relationship)
				const objectEntities = entities.filter(e => 
					afterText.toLowerCase().includes(e.name.toLowerCase())
				);

				// Create relationships
				subjectEntities.forEach(subject => {
					objectEntities.forEach(object => {
						if (subject.id !== object.id) {
							relationships.push({
								id: `${subject.id}_${type}_${object.id}`,
								type,
								from: subject.id,
								to: object.id,
								properties: {
									extractedFrom: text.substring(Math.max(0, relationshipIndex - 20), Math.min(text.length, relationshipIndex + match[0].length + 20))
								}
							});
						}
					});
				});
			}
		});

		return { entities, relationships };
	}
}

// FalkorDB Knowledge Graph Store
export class FalkorDbKnowledgeGraphStore {
	private graphName: string;
	private _credentials: IDataObject;
	private httpRequest: (options: IRequestOptions) => Promise<any>;
	private logger: any;
	private aiExtractor?: AIEntityExtractor;

	constructor(config: {
		graphName: string;
		credentials: IDataObject;
		aiModel?: any;
		httpRequest: (options: IRequestOptions) => Promise<any>;
		logger?: any;
	}) {
		this.graphName = config.graphName;
		this._credentials = config.credentials;
		this.httpRequest = config.httpRequest;
		this.logger = config.logger || {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
		};
		
		// Initialize AI extractor if AI model is provided
		if (config.aiModel) {
			this.aiExtractor = new AIEntityExtractor(config.aiModel, this.logger);
		}
	}

	async processText(text: string): Promise<void> {
		try {
			this.logger.debug('FalkorDB Knowledge Graph: Processing text', {
				textLength: text.length,
				graphName: this.graphName,
				hasAiExtractor: !!this.aiExtractor,
			});

			// Extract entities and relationships from text using AI if available
			const extraction = this.aiExtractor 
				? await this.aiExtractor.extractEntitiesAndRelationships(text)
				: SimpleNLPExtractor.extractEntitiesAndRelationships(text);

			// Create entities in the graph
			for (const entity of extraction.entities) {
				await this.createOrUpdateEntity(entity);
			}

			// Create relationships in the graph
			for (const relationship of extraction.relationships) {
				await this.createRelationship(relationship);
			}

			this.logger.debug('FalkorDB Knowledge Graph: Text processed successfully', {
				entityCount: extraction.entities.length,
				relationshipCount: extraction.relationships.length,
				extractorType: this.aiExtractor ? 'AI' : 'Simple',
			});
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph: Failed to process text', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				textLength: text.length,
				graphName: this.graphName,
			});
			throw error;
		}
	}

	private async createOrUpdateEntity(entity: GraphEntity): Promise<void> {
		const query = `
			MERGE (e:${entity.type} {id: $entityId})
			SET e.name = $name,
				e.type = $type,
				e.updated_at = datetime()
			ON CREATE SET e.created_at = datetime()
		`;

		await this.executeQuery(query, {
			entityId: entity.id,
			name: entity.name,
			type: entity.type,
		});
	}

	private async createRelationship(relationship: GraphRelationship): Promise<void> {
		const query = `
			MATCH (from {id: $fromId})
			MATCH (to {id: $toId})
			MERGE (from)-[r:${relationship.type}]->(to)
			SET r.created_at = coalesce(r.created_at, datetime()),
				r.updated_at = datetime(),
				r.extracted_from = $extractedFrom
		`;

		await this.executeQuery(query, {
			fromId: relationship.from,
			toId: relationship.to,
			extractedFrom: relationship.properties?.extractedFrom || '',
		});
	}

	async queryGraph(cypherQuery: string, parameters: IDataObject = {}): Promise<any[]> {
		return await this.executeQuery(cypherQuery, parameters);
	}

	async enrichFromMessage(message: string, sessionId?: string): Promise<{entities: number, relationships: number}> {
		try {
			this.logger.debug('FalkorDB Knowledge Graph Store: Enriching from message', {
				messageLength: message.length,
				sessionId,
				hasAiExtractor: !!this.aiExtractor,
			});

			// Extract entities and relationships from message using AI if available
			const extraction = this.aiExtractor 
				? await this.aiExtractor.extractEntitiesAndRelationships(message)
				: SimpleNLPExtractor.extractEntitiesAndRelationships(message);

			// Create entities in the graph
			for (const entity of extraction.entities) {
				await this.createOrUpdateEntityWithSession(entity, sessionId);
			}

			// Create relationships in the graph
			for (const relationship of extraction.relationships) {
				await this.createRelationshipWithSession(relationship, sessionId);
			}

			this.logger.debug('FalkorDB Knowledge Graph Store: Message enrichment completed', {
				entityCount: extraction.entities.length,
				relationshipCount: extraction.relationships.length,
				extractorType: this.aiExtractor ? 'AI' : 'Simple',
			});

			return {
				entities: extraction.entities.length,
				relationships: extraction.relationships.length,
			};
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph Store: Failed to enrich from message', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				messageLength: message.length,
			});
			throw error;
		}
	}

	async getContextForMessage(message: string, maxResults: number = 10): Promise<string[]> {
		try {
			this.logger.debug('FalkorDB Knowledge Graph Store: Getting context for message', {
				messageLength: message.length,
				maxResults,
				hasAiExtractor: !!this.aiExtractor,
			});

			let query: string;
			let parameters: IDataObject = { maxResults };

			if (this.aiExtractor) {
				// Use AI to generate a more sophisticated query
				const availableEntityTypes = ['Person', 'Food', 'Company', 'Interest', 'Location', 'Object'];
				const availableRelationships = ['LOVES', 'LIKES', 'HATES', 'WORKS_AT', 'LIVES_IN', 'KNOWS', 'OWNS'];
				
				query = await this.aiExtractor.generateContextQuery(message, availableEntityTypes, availableRelationships);
				
				// Add LIMIT clause if not present
				if (!query.toLowerCase().includes('limit')) {
					query += ` LIMIT ${maxResults}`;
				}
			} else {
				// Fallback to simple entity-based query
				const extraction = SimpleNLPExtractor.extractEntitiesAndRelationships(message);
				
				if (extraction.entities.length === 0) {
					return [];
				}

				const entityNames = extraction.entities.map(e => e.name);
				query = `
					MATCH (e)
					WHERE e.name IN $entityNames
					OPTIONAL MATCH (e)-[r]-(related)
					RETURN DISTINCT
						e.name as entity_name,
						e.type as entity_type,
						r.type as relationship_type,
						related.name as related_name,
						related.type as related_type
					LIMIT $maxResults
				`;
				parameters.entityNames = entityNames;
			}

			this.logger.debug('FalkorDB Knowledge Graph Store: Executing context query', {
				queryLength: query.length,
				queryPreview: query.substring(0, 100) + '...',
				parameters: Object.keys(parameters),
			});

			const results = await this.executeQuery(query, parameters);
			
			// Format results as context strings
			const contextStrings: string[] = [];
			for (const result of results) {
				if (result.relationship_type && result.related_name) {
					contextStrings.push(
						`${result.entity_name} ${result.relationship_type.toLowerCase()} ${result.related_name}`
					);
				} else if (result.entity_name) {
					contextStrings.push(`${result.entity_name} (${result.entity_type})`);
				}
			}

			this.logger.debug('FalkorDB Knowledge Graph Store: Context retrieval completed', {
				resultCount: results.length,
				contextStrings: contextStrings.length,
				extractorType: this.aiExtractor ? 'AI' : 'Simple',
			});

			return contextStrings;
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph Store: Failed to get context for message', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				messageLength: message.length,
			});
			return [];
		}
	}

	private async createOrUpdateEntityWithSession(entity: GraphEntity, sessionId?: string): Promise<void> {
		const query = `
			MERGE (e:${entity.type} {id: $entityId})
			SET e.name = $name,
				e.type = $type,
				e.updated_at = datetime()
				${sessionId ? ', e.last_session_id = $sessionId' : ''}
			ON CREATE SET e.created_at = datetime()
				${sessionId ? ', e.created_in_session = $sessionId' : ''}
		`;

		const parameters: IDataObject = {
			entityId: entity.id,
			name: entity.name,
			type: entity.type,
		};

		if (sessionId) {
			parameters.sessionId = sessionId;
		}

		await this.executeQuery(query, parameters);
	}

	private async createRelationshipWithSession(relationship: GraphRelationship, sessionId?: string): Promise<void> {
		const query = `
			MATCH (from {id: $fromId})
			MATCH (to {id: $toId})
			MERGE (from)-[r:${relationship.type}]->(to)
			SET r.created_at = coalesce(r.created_at, datetime()),
				r.updated_at = datetime(),
				r.extracted_from = $extractedFrom
				${sessionId ? ', r.last_session_id = $sessionId' : ''}
			ON CREATE SET r.created_at = datetime()
				${sessionId ? ', r.created_in_session = $sessionId' : ''}
		`;

		const parameters: IDataObject = {
			fromId: relationship.from,
			toId: relationship.to,
			extractedFrom: relationship.properties?.extractedFrom || '',
		};

		if (sessionId) {
			parameters.sessionId = sessionId;
		}

		await this.executeQuery(query, parameters);
	}

	private async executeQuery(query: string, parameters: IDataObject): Promise<any[]> {
		const host = this._credentials.host as string;
		const port = this._credentials.port as number;
		const ssl = this._credentials.ssl as boolean;
		const username = this._credentials.username as string;
		const password = this._credentials.password as string;

		const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;

		try {
			// Get authentication session cookies
			const cookies = await getSessionCookies(
				baseURL,
				username,
				password,
				this.httpRequest,
				this.logger,
			);

			const endpoint = `/api/graph/${this.graphName}`;

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

			const response = await this.httpRequest(requestOptions);

			if (response.result && response.result.data) {
				return response.result.data;
			}

			return [];
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph: Query execution failed', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				query: query.substring(0, 100) + '...',
				parameters,
				baseURL,
				graphName: this.graphName,
			});
			throw new Error(`FalkorDB knowledge graph query failed: ${(error as Error).message}`);
		}
	}
}

// FalkorDB Knowledge Graph Memory
export class FalkorDbKnowledgeGraphMemory extends BaseChatMemory {
	public memoryKeys = ['history'];
	public returnMessages: boolean;
	
	public inputKey: string;
	public outputKey: string;
	
	private sessionId: string;
	private _graphName: string;
	private contextWindowLength: number;
	private _credentials: IDataObject;
	private memoryKey: string;
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
		super({ returnMessages: config.returnMessages || false });
		this.sessionId = config.sessionId;
		this._graphName = config.graphName;
		this.contextWindowLength = config.contextWindowLength;
		this._credentials = config.credentials;
		this.memoryKey = config.memoryKey || 'history';
		this.inputKey = config.inputKey || 'input';
		this.outputKey = config.outputKey || 'output';
		this.returnMessages = config.returnMessages || false;
		this.httpRequest = config.httpRequest;
		this.logger = config.logger || {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
		};
	}

	async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
		try {
			// Get conversation history
			const messages = await this.getMessages();
			
			// Get current human input to enrich with knowledge graph context
			const currentInput = values[this.inputKey] as string;
			
			// Query knowledge graph for relevant context
			const relevantContext = await this.getRelevantContext(currentInput);
			
			// Combine conversation history with knowledge graph context
			const enrichedHistory = await this.enrichWithKnowledgeGraph(messages, relevantContext);

			if (this.returnMessages) {
				return { 
					[this.memoryKey]: enrichedHistory,
					knowledge_context: relevantContext 
				};
			}

			// Convert to string format with knowledge context
			const historyString = enrichedHistory.map((msg) => `${msg.getType()}: ${msg.content}`).join('\n');
			const contextString = this.formatContextAsString(relevantContext);
			
			return { 
				[this.memoryKey]: historyString,
				knowledge_context: contextString
			};
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph Memory: Failed to load memory variables', {
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
			this.logger.warn('FalkorDB Knowledge Graph Memory: Missing input or output text', {
				hasInput: !!inputText,
				hasOutput: !!outputText,
				sessionId: this.sessionId,
				inputKey: this.inputKey,
				outputKey: this.outputKey,
			});
			return;
		}

		try {
			await this.addMessage(new HumanMessage(inputText));
			await this.addMessage(new AIMessage(outputText));
			
			// Extract and store knowledge from the conversation
			await this.extractKnowledgeFromConversation(inputText, outputText);
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph Memory: Failed to save context', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				sessionId: this.sessionId,
				graphName: this._graphName,
			});
		}
	}

	async clear(): Promise<void> {
		try {
			await this.executeQuery(
				'MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message) DETACH DELETE m',
				{ sessionId: this.sessionId },
			);
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph Memory: Failed to clear memory', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				sessionId: this.sessionId,
				graphName: this._graphName,
			});
		}
	}

	private async getMessages(): Promise<BaseMessage[]> {
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
			.map((row: any) => {
				if (row.type === 'human') {
					return new HumanMessage(row.content);
				} else if (row.type === 'ai') {
					return new AIMessage(row.content);
				}
				return null;
			})
			.filter(msg => msg !== null)
			.reverse(); // Reverse to get chronological order
	}

	private async addMessage(message: BaseMessage): Promise<void> {
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
			type: message.getType(),
			content: message.content,
		});
	}

	private async extractKnowledgeFromConversation(inputText: string, outputText: string): Promise<void> {
		// Extract entities and relationships from both input and output
		const inputExtraction = SimpleNLPExtractor.extractEntitiesAndRelationships(inputText);
		const outputExtraction = SimpleNLPExtractor.extractEntitiesAndRelationships(outputText);

		// Process input knowledge
		for (const entity of inputExtraction.entities) {
			await this.createOrUpdateEntity(entity);
		}
		for (const relationship of inputExtraction.relationships) {
			await this.createRelationship(relationship);
		}

		// Process output knowledge
		for (const entity of outputExtraction.entities) {
			await this.createOrUpdateEntity(entity);
		}
		for (const relationship of outputExtraction.relationships) {
			await this.createRelationship(relationship);
		}
	}

	private async getRelevantContext(inputText: string): Promise<any[]> {
		try {
			// Extract entities from current input
			const extraction = SimpleNLPExtractor.extractEntitiesAndRelationships(inputText);
			
			if (extraction.entities.length === 0) {
				return [];
			}

			// Query for relevant knowledge based on entities in the input
			const entityNames = extraction.entities.map(e => e.name);
			const query = `
				// Find entities mentioned in the input
				MATCH (e)
				WHERE e.name IN $entityNames
				
				// Get their direct relationships
				OPTIONAL MATCH (e)-[r1]-(related1)
				
				// Get second-degree relationships for richer context
				OPTIONAL MATCH (related1)-[r2]-(related2)
				WHERE related2 <> e
				
				// Also look for entities that share relationships with input entities
				OPTIONAL MATCH (e)-[r3]->(shared)<-[r4]-(other)
				WHERE other <> e
				
				RETURN DISTINCT
					e as entity,
					r1 as direct_relationship,
					related1 as direct_related,
					r2 as indirect_relationship,
					related2 as indirect_related,
					r3 as shared_relationship_1,
					shared as shared_entity,
					r4 as shared_relationship_2,
					other as other_entity
				LIMIT 20
			`;

			const results = await this.executeQuery(query, { entityNames });
			
			this.logger.debug('FalkorDB Knowledge Graph Memory: Retrieved relevant context', {
				inputText: inputText.substring(0, 100) + '...',
				entityCount: extraction.entities.length,
				contextResults: results.length,
			});

			return results;
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph Memory: Failed to get relevant context', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				inputText: inputText.substring(0, 100) + '...',
			});
			return [];
		}
	}

	private async enrichWithKnowledgeGraph(messages: BaseMessage[], context: any[]): Promise<BaseMessage[]> {
		if (context.length === 0) {
			return messages;
		}

		// Create a context summary message
		const contextSummary = this.formatContextAsString(context);
		const contextMessage = new AIMessage(
			`[Knowledge Graph Context]: ${contextSummary}`
		);

		// Add context before the last few messages
		const enrichedMessages = [...messages];
		if (enrichedMessages.length > 0) {
			enrichedMessages.splice(-2, 0, contextMessage);
		} else {
			enrichedMessages.push(contextMessage);
		}

		return enrichedMessages;
	}

	private formatContextAsString(context: any[]): string {
		if (context.length === 0) {
			return "No relevant knowledge found.";
		}

		const facts: string[] = [];
		const entities = new Set<string>();
		const relationships = new Set<string>();

		for (const item of context) {
			// Direct relationships
			if (item.entity && item.direct_relationship && item.direct_related) {
				const fact = `${item.entity.name} ${item.direct_relationship.type.toLowerCase()} ${item.direct_related.name}`;
				facts.push(fact);
				entities.add(item.entity.name);
				entities.add(item.direct_related.name);
				relationships.add(item.direct_relationship.type);
			}

			// Indirect relationships for richer context
			if (item.direct_related && item.indirect_relationship && item.indirect_related) {
				const fact = `${item.direct_related.name} ${item.indirect_relationship.type.toLowerCase()} ${item.indirect_related.name}`;
				facts.push(fact);
				entities.add(item.direct_related.name);
				entities.add(item.indirect_related.name);
				relationships.add(item.indirect_relationship.type);
			}

			// Shared relationships
			if (item.entity && item.shared_relationship_1 && item.shared_entity && item.shared_relationship_2 && item.other_entity) {
				const fact = `${item.entity.name} and ${item.other_entity.name} both ${item.shared_relationship_1.type.toLowerCase()} ${item.shared_entity.name}`;
				facts.push(fact);
				entities.add(item.entity.name);
				entities.add(item.other_entity.name);
				entities.add(item.shared_entity.name);
			}
		}

		// Remove duplicates and format
		const uniqueFacts = [...new Set(facts)];
		
		if (uniqueFacts.length === 0) {
			return "Entities recognized but no specific relationships found.";
		}

		return `Relevant facts: ${uniqueFacts.slice(0, 5).join('; ')}.`;
	}

	private async createOrUpdateEntity(entity: GraphEntity): Promise<void> {
		const query = `
			MERGE (e:${entity.type} {id: $entityId})
			SET e.name = $name,
				e.type = $type,
				e.updated_at = datetime(),
				e.session_id = $sessionId
			ON CREATE SET e.created_at = datetime()
		`;

		await this.executeQuery(query, {
			entityId: entity.id,
			name: entity.name,
			type: entity.type,
			sessionId: this.sessionId,
		});
	}

	private async createRelationship(relationship: GraphRelationship): Promise<void> {
		const query = `
			MATCH (from {id: $fromId})
			MATCH (to {id: $toId})
			MERGE (from)-[r:${relationship.type}]->(to)
			SET r.created_at = coalesce(r.created_at, datetime()),
				r.updated_at = datetime(),
				r.session_id = $sessionId
		`;

		await this.executeQuery(query, {
			fromId: relationship.from,
			toId: relationship.to,
			sessionId: this.sessionId,
		});
	}

	private async executeQuery(query: string, parameters: IDataObject): Promise<any[]> {
		const host = this._credentials.host as string;
		const port = this._credentials.port as number;
		const ssl = this._credentials.ssl as boolean;
		const username = this._credentials.username as string;
		const password = this._credentials.password as string;

		const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;

		try {
			const cookies = await getSessionCookies(
				baseURL,
				username,
				password,
				this.httpRequest,
				this.logger,
			);

			const endpoint = `/api/graph/${this._graphName}`;

			const requestOptions: IRequestOptions = {
				method: 'POST',
				baseURL,
				url: endpoint,
				body: { query, parameters },
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					Cookie: cookies,
				},
				json: true,
			};

			const response = await this.httpRequest(requestOptions);

			if (response.result && response.result.data) {
				return response.result.data;
			}

			return [];
		} catch (error) {
			this.logger.error('FalkorDB Knowledge Graph Memory: Query execution failed', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				query: query.substring(0, 100) + '...',
				parameters,
				baseURL,
				graphName: this._graphName,
			});
			throw new Error(`FalkorDB knowledge graph memory query failed: ${(error as Error).message}`);
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

		const signinUrl = providersResponse.credentials?.signinUrl;
		if (!signinUrl) {
			throw new Error('Failed to get signin URL from FalkorDB auth providers');
		}

		// Parse the signin URL to get the path
		const signinPath = signinUrl.replace(/^https?:\/\/[^\/]+/, '');

		// Sign in with credentials
		const signinResponse = await httpRequest({
			method: 'POST',
			baseURL,
			url: signinPath,
			body: { username, password },
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			json: true,
		});

		// Extract session cookies from response headers
		const setCookieHeaders = signinResponse.headers?.['set-cookie'] || [];
		const cookies = setCookieHeaders.map((cookie: string) => cookie.split(';')[0]).join('; ');

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
export function getConnectionHintNoticeField(connectionTypes: string[]): any {
	const connectionsString = {
		'ai_agent': {
			connection: '',
			locale: 'AI Agent',
		},
		'ai_vectorStore': {
			connection: 'ai_vectorStore',
			locale: 'Vector Store',
		},
	};

	function determineArticle(nextWord: string): string {
		const vowels = /^[aeiouAEIOU]/;
		return vowels.test(nextWord) ? 'an' : 'a';
	}

	const getConnectionParameterString = (connectionType: string) => {
		if (connectionType === '') return "data-action-parameter-creatorview='AI'";
		return `data-action-parameter-connectiontype='${connectionType}'`;
	};

	if (connectionTypes.length === 1) {
		const connectionType = connectionTypes[0];
		const connectionInfo = connectionsString[connectionType as keyof typeof connectionsString];
		if (connectionInfo) {
			const locale = connectionInfo.locale;
			return {
				displayName: `This node must be connected to ${determineArticle(locale)} ${locale.toLowerCase().replace(/^ai /, 'AI ')}. <a data-action='openSelectiveNodeCreator' ${getConnectionParameterString(connectionInfo.connection)}>Insert one</a>`,
				name: 'notice',
				type: 'notice',
				default: '',
				typeOptions: {
					containerClass: 'ndv-connection-hint-notice',
				},
			};
		}
	}

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