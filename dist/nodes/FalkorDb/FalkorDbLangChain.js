"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbKnowledgeGraphMemory = exports.FalkorDbKnowledgeGraphStore = exports.SimpleNLPExtractor = exports.AIEntityExtractor = void 0;
exports.getSessionCookies = getSessionCookies;
exports.getSessionId = getSessionId;
exports.getConnectionHintNoticeField = getConnectionHintNoticeField;
const chat_memory_1 = require("@langchain/community/memory/chat_memory");
const messages_1 = require("@langchain/core/messages");
class AIEntityExtractor {
    constructor(aiModel, logger) {
        this.aiModel = aiModel;
        this.logger = logger || {
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
        };
    }
    async extractEntitiesAndRelationships(text) {
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
            const parsed = JSON.parse(aiResponse);
            const entities = (parsed.entities || []).map((e) => ({
                id: e.id || `${e.type.toLowerCase()}_${e.name.replace(/\s+/g, '_').toLowerCase()}`,
                type: e.type,
                name: e.name,
                properties: { confidence: e.confidence || 0.8 }
            }));
            const relationships = (parsed.relationships || []).map((r) => ({
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
        }
        catch (error) {
            this.logger.error('AIEntityExtractor: Extraction failed', {
                error: error.message,
                stack: error.stack,
                textLength: text.length,
            });
            return SimpleNLPExtractor.extractEntitiesAndRelationships(text);
        }
    }
    async generateContextQuery(inputText, availableEntityTypes, availableRelationships) {
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
        }
        catch (error) {
            this.logger.error('AIEntityExtractor: Query generation failed', {
                error: error.message,
                stack: error.stack,
                inputText: inputText.substring(0, 100) + '...',
            });
            return `MATCH (e) WHERE e.name CONTAINS '${inputText.split(' ')[0]}' OPTIONAL MATCH (e)-[r]-(related) RETURN e.name, e.type, r.type, related.name, related.type LIMIT 10`;
        }
    }
}
exports.AIEntityExtractor = AIEntityExtractor;
class SimpleNLPExtractor {
    static extractEntitiesAndRelationships(text) {
        const entities = [];
        const relationships = [];
        const entityMap = new Map();
        this.ENTITY_PATTERNS.forEach(({ pattern, type, getValue }) => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const entityName = getValue(match[0]);
                const entityKey = `${type}:${entityName}`;
                if (!entityMap.has(entityKey)) {
                    const entity = {
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
        this.RELATIONSHIP_PATTERNS.forEach(({ pattern, type }) => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const relationshipIndex = match.index;
                const beforeText = text.substring(Math.max(0, relationshipIndex - 50), relationshipIndex);
                const afterText = text.substring(relationshipIndex + match[0].length, Math.min(text.length, relationshipIndex + match[0].length + 50));
                const subjectEntities = entities.filter(e => beforeText.toLowerCase().includes(e.name.toLowerCase()) ||
                    (e.name === 'User' && beforeText.match(/\b(I|me|my)\b/i)));
                const objectEntities = entities.filter(e => afterText.toLowerCase().includes(e.name.toLowerCase()));
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
exports.SimpleNLPExtractor = SimpleNLPExtractor;
SimpleNLPExtractor.ENTITY_PATTERNS = [
    { pattern: /\b(I|me|my|myself)\b/gi, type: 'Person', getValue: () => 'User' },
    { pattern: /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, type: 'Person', getValue: (match) => match.trim() },
    { pattern: /\b([A-Z][a-z]+)\b(?=\s+(?:loves|likes|hates|enjoys|eats|drinks|works|lives))/g, type: 'Person', getValue: (match) => match.trim() },
    { pattern: /\b(apples?|oranges?|bananas?|pizza|coffee|tea|water|food)\b/gi, type: 'Food', getValue: (match) => match.toLowerCase() },
    { pattern: /\b(music|movies?|books?|sports?|games?|art)\b/gi, type: 'Interest', getValue: (match) => match.toLowerCase() },
    { pattern: /\b(work|job|career|profession)\b/gi, type: 'Occupation', getValue: (match) => match.toLowerCase() },
];
SimpleNLPExtractor.RELATIONSHIP_PATTERNS = [
    { pattern: /\b(loves?|really likes?|enjoys?)\b/gi, type: 'LOVES' },
    { pattern: /\b(likes?|prefers?)\b/gi, type: 'LIKES' },
    { pattern: /\b(hates?|dislikes?|despises?)\b/gi, type: 'HATES' },
    { pattern: /\b(works? (?:as|at)|employed (?:as|at))\b/gi, type: 'WORKS_AS' },
    { pattern: /\b(lives? (?:in|at)|resides? (?:in|at))\b/gi, type: 'LIVES_IN' },
    { pattern: /\b(knows?|friends? with|acquainted with)\b/gi, type: 'KNOWS' },
    { pattern: /\b(owns?|has|possesses?)\b/gi, type: 'OWNS' },
];
class FalkorDbKnowledgeGraphStore {
    constructor(config) {
        this.graphName = config.graphName;
        this._credentials = config.credentials;
        this.httpRequest = config.httpRequest;
        this.logger = config.logger || {
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
        };
        if (config.aiModel) {
            this.aiExtractor = new AIEntityExtractor(config.aiModel, this.logger);
        }
    }
    async processText(text) {
        try {
            this.logger.debug('FalkorDB Knowledge Graph: Processing text', {
                textLength: text.length,
                graphName: this.graphName,
                hasAiExtractor: !!this.aiExtractor,
            });
            const extraction = this.aiExtractor
                ? await this.aiExtractor.extractEntitiesAndRelationships(text)
                : SimpleNLPExtractor.extractEntitiesAndRelationships(text);
            for (const entity of extraction.entities) {
                await this.createOrUpdateEntity(entity);
            }
            for (const relationship of extraction.relationships) {
                await this.createRelationship(relationship);
            }
            this.logger.debug('FalkorDB Knowledge Graph: Text processed successfully', {
                entityCount: extraction.entities.length,
                relationshipCount: extraction.relationships.length,
                extractorType: this.aiExtractor ? 'AI' : 'Simple',
            });
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph: Failed to process text', {
                error: error.message,
                stack: error.stack,
                textLength: text.length,
                graphName: this.graphName,
            });
            throw error;
        }
    }
    async createOrUpdateEntity(entity) {
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
    async createRelationship(relationship) {
        var _a;
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
            extractedFrom: ((_a = relationship.properties) === null || _a === void 0 ? void 0 : _a.extractedFrom) || '',
        });
    }
    async queryGraph(cypherQuery, parameters = {}) {
        return await this.executeQuery(cypherQuery, parameters);
    }
    async enrichFromMessage(message, sessionId) {
        try {
            this.logger.debug('FalkorDB Knowledge Graph Store: Enriching from message', {
                messageLength: message.length,
                sessionId,
                hasAiExtractor: !!this.aiExtractor,
            });
            const extraction = this.aiExtractor
                ? await this.aiExtractor.extractEntitiesAndRelationships(message)
                : SimpleNLPExtractor.extractEntitiesAndRelationships(message);
            for (const entity of extraction.entities) {
                await this.createOrUpdateEntityWithSession(entity, sessionId);
            }
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
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph Store: Failed to enrich from message', {
                error: error.message,
                stack: error.stack,
                messageLength: message.length,
            });
            throw error;
        }
    }
    async getContextForMessage(message, maxResults = 10) {
        try {
            this.logger.debug('FalkorDB Knowledge Graph Store: Getting context for message', {
                messageLength: message.length,
                maxResults,
                hasAiExtractor: !!this.aiExtractor,
            });
            let query;
            let parameters = { maxResults };
            if (this.aiExtractor) {
                const availableEntityTypes = ['Person', 'Food', 'Company', 'Interest', 'Location', 'Object'];
                const availableRelationships = ['LOVES', 'LIKES', 'HATES', 'WORKS_AT', 'LIVES_IN', 'KNOWS', 'OWNS'];
                query = await this.aiExtractor.generateContextQuery(message, availableEntityTypes, availableRelationships);
                if (!query.toLowerCase().includes('limit')) {
                    query += ` LIMIT ${maxResults}`;
                }
            }
            else {
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
            const contextStrings = [];
            for (const result of results) {
                if (result.relationship_type && result.related_name) {
                    contextStrings.push(`${result.entity_name} ${result.relationship_type.toLowerCase()} ${result.related_name}`);
                }
                else if (result.entity_name) {
                    contextStrings.push(`${result.entity_name} (${result.entity_type})`);
                }
            }
            this.logger.debug('FalkorDB Knowledge Graph Store: Context retrieval completed', {
                resultCount: results.length,
                contextStrings: contextStrings.length,
                extractorType: this.aiExtractor ? 'AI' : 'Simple',
            });
            return contextStrings;
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph Store: Failed to get context for message', {
                error: error.message,
                stack: error.stack,
                messageLength: message.length,
            });
            return [];
        }
    }
    async createOrUpdateEntityWithSession(entity, sessionId) {
        const query = `
			MERGE (e:${entity.type} {id: $entityId})
			SET e.name = $name,
				e.type = $type,
				e.updated_at = datetime()
				${sessionId ? ', e.last_session_id = $sessionId' : ''}
			ON CREATE SET e.created_at = datetime()
				${sessionId ? ', e.created_in_session = $sessionId' : ''}
		`;
        const parameters = {
            entityId: entity.id,
            name: entity.name,
            type: entity.type,
        };
        if (sessionId) {
            parameters.sessionId = sessionId;
        }
        await this.executeQuery(query, parameters);
    }
    async createRelationshipWithSession(relationship, sessionId) {
        var _a;
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
        const parameters = {
            fromId: relationship.from,
            toId: relationship.to,
            extractedFrom: ((_a = relationship.properties) === null || _a === void 0 ? void 0 : _a.extractedFrom) || '',
        };
        if (sessionId) {
            parameters.sessionId = sessionId;
        }
        await this.executeQuery(query, parameters);
    }
    async executeQuery(query, parameters) {
        const host = this._credentials.host;
        const port = this._credentials.port;
        const ssl = this._credentials.ssl;
        const username = this._credentials.username;
        const password = this._credentials.password;
        const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;
        try {
            const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest, this.logger);
            const endpoint = `/api/graph/${this.graphName}`;
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
            const response = await this.httpRequest(requestOptions);
            if (response.result && response.result.data) {
                return response.result.data;
            }
            return [];
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph: Query execution failed', {
                error: error.message,
                stack: error.stack,
                query: query.substring(0, 100) + '...',
                parameters,
                baseURL,
                graphName: this.graphName,
            });
            throw new Error(`FalkorDB knowledge graph query failed: ${error.message}`);
        }
    }
}
exports.FalkorDbKnowledgeGraphStore = FalkorDbKnowledgeGraphStore;
class FalkorDbKnowledgeGraphMemory extends chat_memory_1.BaseChatMemory {
    constructor(config) {
        super({ returnMessages: config.returnMessages || false });
        this.memoryKeys = ['history'];
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
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
        };
    }
    async loadMemoryVariables(values) {
        try {
            const messages = await this.getMessages();
            const currentInput = values[this.inputKey];
            const relevantContext = await this.getRelevantContext(currentInput);
            const enrichedHistory = await this.enrichWithKnowledgeGraph(messages, relevantContext);
            if (this.returnMessages) {
                return {
                    [this.memoryKey]: enrichedHistory,
                    knowledge_context: relevantContext
                };
            }
            const historyString = enrichedHistory.map((msg) => `${msg.getType()}: ${msg.content}`).join('\n');
            const contextString = this.formatContextAsString(relevantContext);
            return {
                [this.memoryKey]: historyString,
                knowledge_context: contextString
            };
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph Memory: Failed to load memory variables', {
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
            await this.addMessage(new messages_1.HumanMessage(inputText));
            await this.addMessage(new messages_1.AIMessage(outputText));
            await this.extractKnowledgeFromConversation(inputText, outputText);
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph Memory: Failed to save context', {
                error: error.message,
                stack: error.stack,
                sessionId: this.sessionId,
                graphName: this._graphName,
            });
        }
    }
    async clear() {
        try {
            await this.executeQuery('MATCH (s:Session {id: $sessionId})-[:HAS_MESSAGE]->(m:Message) DETACH DELETE m', { sessionId: this.sessionId });
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph Memory: Failed to clear memory', {
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
            .map((row) => {
            if (row.type === 'human') {
                return new messages_1.HumanMessage(row.content);
            }
            else if (row.type === 'ai') {
                return new messages_1.AIMessage(row.content);
            }
            return null;
        })
            .filter(msg => msg !== null)
            .reverse();
    }
    async addMessage(message) {
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
    async extractKnowledgeFromConversation(inputText, outputText) {
        const inputExtraction = SimpleNLPExtractor.extractEntitiesAndRelationships(inputText);
        const outputExtraction = SimpleNLPExtractor.extractEntitiesAndRelationships(outputText);
        for (const entity of inputExtraction.entities) {
            await this.createOrUpdateEntity(entity);
        }
        for (const relationship of inputExtraction.relationships) {
            await this.createRelationship(relationship);
        }
        for (const entity of outputExtraction.entities) {
            await this.createOrUpdateEntity(entity);
        }
        for (const relationship of outputExtraction.relationships) {
            await this.createRelationship(relationship);
        }
    }
    async getRelevantContext(inputText) {
        try {
            const extraction = SimpleNLPExtractor.extractEntitiesAndRelationships(inputText);
            if (extraction.entities.length === 0) {
                return [];
            }
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
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph Memory: Failed to get relevant context', {
                error: error.message,
                stack: error.stack,
                inputText: inputText.substring(0, 100) + '...',
            });
            return [];
        }
    }
    async enrichWithKnowledgeGraph(messages, context) {
        if (context.length === 0) {
            return messages;
        }
        const contextSummary = this.formatContextAsString(context);
        const contextMessage = new messages_1.AIMessage(`[Knowledge Graph Context]: ${contextSummary}`);
        const enrichedMessages = [...messages];
        if (enrichedMessages.length > 0) {
            enrichedMessages.splice(-2, 0, contextMessage);
        }
        else {
            enrichedMessages.push(contextMessage);
        }
        return enrichedMessages;
    }
    formatContextAsString(context) {
        if (context.length === 0) {
            return "No relevant knowledge found.";
        }
        const facts = [];
        const entities = new Set();
        const relationships = new Set();
        for (const item of context) {
            if (item.entity && item.direct_relationship && item.direct_related) {
                const fact = `${item.entity.name} ${item.direct_relationship.type.toLowerCase()} ${item.direct_related.name}`;
                facts.push(fact);
                entities.add(item.entity.name);
                entities.add(item.direct_related.name);
                relationships.add(item.direct_relationship.type);
            }
            if (item.direct_related && item.indirect_relationship && item.indirect_related) {
                const fact = `${item.direct_related.name} ${item.indirect_relationship.type.toLowerCase()} ${item.indirect_related.name}`;
                facts.push(fact);
                entities.add(item.direct_related.name);
                entities.add(item.indirect_related.name);
                relationships.add(item.indirect_relationship.type);
            }
            if (item.entity && item.shared_relationship_1 && item.shared_entity && item.shared_relationship_2 && item.other_entity) {
                const fact = `${item.entity.name} and ${item.other_entity.name} both ${item.shared_relationship_1.type.toLowerCase()} ${item.shared_entity.name}`;
                facts.push(fact);
                entities.add(item.entity.name);
                entities.add(item.other_entity.name);
                entities.add(item.shared_entity.name);
            }
        }
        const uniqueFacts = [...new Set(facts)];
        if (uniqueFacts.length === 0) {
            return "Entities recognized but no specific relationships found.";
        }
        return `Relevant facts: ${uniqueFacts.slice(0, 5).join('; ')}.`;
    }
    async createOrUpdateEntity(entity) {
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
    async createRelationship(relationship) {
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
    async executeQuery(query, parameters) {
        const host = this._credentials.host;
        const port = this._credentials.port;
        const ssl = this._credentials.ssl;
        const username = this._credentials.username;
        const password = this._credentials.password;
        const baseURL = `${ssl ? 'https' : 'http'}://${host}:${port}`;
        try {
            const cookies = await getSessionCookies(baseURL, username, password, this.httpRequest, this.logger);
            const endpoint = `/api/graph/${this._graphName}`;
            const requestOptions = {
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
        }
        catch (error) {
            this.logger.error('FalkorDB Knowledge Graph Memory: Query execution failed', {
                error: error.message,
                stack: error.stack,
                query: query.substring(0, 100) + '...',
                parameters,
                baseURL,
                graphName: this._graphName,
            });
            throw new Error(`FalkorDB knowledge graph memory query failed: ${error.message}`);
        }
    }
}
exports.FalkorDbKnowledgeGraphMemory = FalkorDbKnowledgeGraphMemory;
async function getSessionCookies(baseURL, username, password, httpRequest, logger) {
    var _a, _b;
    const log = logger || { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
    try {
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
        const signinUrl = (_a = providersResponse.credentials) === null || _a === void 0 ? void 0 : _a.signinUrl;
        if (!signinUrl) {
            throw new Error('Failed to get signin URL from FalkorDB auth providers');
        }
        const signinPath = signinUrl.replace(/^https?:\/\/[^\/]+/, '');
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
        const setCookieHeaders = ((_b = signinResponse.headers) === null || _b === void 0 ? void 0 : _b['set-cookie']) || [];
        const cookies = setCookieHeaders.map((cookie) => cookie.split(';')[0]).join('; ');
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
function getConnectionHintNoticeField(connectionTypes) {
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
    function determineArticle(nextWord) {
        const vowels = /^[aeiouAEIOU]/;
        return vowels.test(nextWord) ? 'an' : 'a';
    }
    const getConnectionParameterString = (connectionType) => {
        if (connectionType === '')
            return "data-action-parameter-creatorview='AI'";
        return `data-action-parameter-connectiontype='${connectionType}'`;
    };
    if (connectionTypes.length === 1) {
        const connectionType = connectionTypes[0];
        const connectionInfo = connectionsString[connectionType];
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
//# sourceMappingURL=FalkorDbLangChain.js.map