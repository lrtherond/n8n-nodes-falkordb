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
			const prompt = `§ **Task**:

Extract entities and relationships from the provided text using universal, open-schema extraction principles that leverage Large Language Model capabilities to identify any entity type or relationship without predefined limitations.

§ **Input**:

<input_text>
${text}
</input_text>

§ **Context**:

Traditional knowledge graph extraction limited to fixed entity types (Person, Company, Location) and predefined relationships is inadequate for capturing the rich diversity of real-world knowledge. Research demonstrates that LLM-based open extraction with fine-grained typing and entity linking significantly outperforms classical OpenIE tools, achieving higher precision and recall in knowledge graph construction. This approach embraces universal extraction by identifying any relevant entity type or relationship as needed, rather than being confined to a small vocabulary.

§ **Instructions**:

1. **Universal Entity Identification**:
   - Extract ALL entities present in the text (\`input_text\`) regardless of category
   - Do not limit extraction to predefined entity types
   - Identify both explicit entities and implied entities that emerge from context

2. **Fine-Grained Entity Typing**:
   - Use descriptive, specific entity types rather than coarse categories
   - Examples: "TechnologyCompany" instead of "Company", "ItalianRestaurant" instead of "Location", "SoftwareEngineer" instead of "Person"
   - Create new entity types as needed to accurately represent the semantic meaning
   - Consider entity types that would align with large knowledge bases like Wikidata or DBpedia

3. **Open-Ended Relationship Extraction**:
   - Generate relationship types that capture the actual semantic connection
   - Use descriptive relationship names (e.g., "FOUNDED_BY", "SPECIALIZES_IN", "COLLABORATES_WITH", "PREFERS_CUISINE_TYPE")
   - Extract direct relationships explicitly stated in text
   - Identify indirect relationships and implied connections
   - Capture temporal, causal, hierarchical, and associative relationships

4. **Entity Standardization and Linking Preparation**:
   - Generate unique, descriptive identifiers using format: "type_descriptor_name" (e.g., "tech_company_google", "person_engineer_sarah_chen")
   - Use standardized property names from controlled vocabulary when possible
   - Include disambiguation hints (aliases, context) that facilitate future entity linking and deduplication
   - Add only properties explicitly stated or strongly implied in the text

5. **Evidence-Based Relationship Assessment**:
   - Classify relationship evidence as "explicit" (directly stated) or "inferred" (reasonably implied from context)
   - Include direct text support for each relationship when available
   - Note linguistic certainty markers present in the text ("definitely", "might", "always")

§ **Output**:

**Format**: Valid JSON only, with no additional text or explanations.

\`\`\`json
{
  "entities": [
    {
      "name": "entity_name",
      "type": "fine_grained_type",
      "id": "unique_descriptive_id",
      "properties": {
        "canonical_name": "standardized_name",
        "description": "brief_description_from_text",
        "aliases": ["alternative_name1", "alternative_name2"],
        "context_hint": "disambiguation_context"
      },
      "standard_properties": {
        "industry": "value_if_applicable",
        "location": "value_if_mentioned",
        "role": "value_if_specified",
        "specialization": "value_if_stated"
      }
    }
  ],
  "relationships": [
    {
      "from": "source_entity_id",
      "to": "target_entity_id",
      "type": "STANDARDIZED_RELATIONSHIP_TYPE",
      "evidence": {
        "type": "explicit|inferred",
        "text_support": "direct_quote_or_paraphrase",
        "certainty_markers": ["linguistic_indicators"]
      },
      "properties": {
        "context": "relationship_context_from_text",
        "temporal_info": "time_information_if_available"
      }
    }
  ]
}
\`\`\`

**Example Input Text 2**: "John likes pizza and works at Google."

**Example Output 2**:
\`\`\`json
{
  "entities": [
    {
      "name": "John",
      "type": "Person",
      "id": "person_john",
      "properties": {
        "canonical_name": "John",
        "description": "Person"
      },
      "standard_properties": {}
    },
    {
      "name": "pizza",
      "type": "Food",
      "id": "food_pizza",
      "properties": {
        "canonical_name": "Pizza",
        "description": "Food item"
      },
      "standard_properties": {}
    },
    {
      "name": "Google",
      "type": "Company",
      "id": "company_google",
      "properties": {
        "canonical_name": "Google",
        "description": "Company"
      },
      "standard_properties": {}
    }
  ],
  "relationships": [
    {
      "from": "person_john",
      "to": "food_pizza",
      "type": "LIKES",
      "evidence": {
        "type": "explicit",
        "text_support": "John likes pizza",
        "certainty_markers": []
      },
      "properties": {
        "context": "food preference"
      }
    },
    {
      "from": "person_john",
      "to": "company_google",
      "type": "EMPLOYED_BY",
      "evidence": {
        "type": "explicit",
        "text_support": "works at Google",
        "certainty_markers": []
      },
      "properties": {
        "context": "employment"
      }
    }
  ]
}
\`\`\`

§ **Evaluation Criteria**:

- **Completeness**: All relevant entities and relationships in the text must be extracted
- **Precision**: Entity types must be fine-grained and semantically accurate
- **Universality**: No artificial limitations on entity types or relationship categories
- **Standardization**: Must use controlled vocabulary for common properties while allowing extensions
- **Linkability**: Entity identifiers and disambiguation hints must facilitate future linking and deduplication
- **Evidence Quality**: Evidence classification must accurately reflect whether relationships are explicit or inferred
- **Relationship Consistency**: Must use standardized relationship types where applicable (e.g., EMPLOYED_BY, SPECIALIZES_IN, COLLABORATES_WITH)
- **JSON Validity**: Output must be valid, parseable JSON with no syntax errors

§ **Constraints**:

- Do not restrict extraction to any predefined ontology or schema for entity types
- Use standardized property names and relationship types where common patterns exist
- Maintain objectivity - extract what is present in the text without adding external knowledge
- Ensure all entity IDs referenced in relationships exist in the entities array
- Classify evidence conservatively - only mark as "explicit" when directly stated in text
- Include only properties that have direct textual support - avoid inferring information not stated
- Use controlled vocabulary for standard properties only when explicitly mentioned: industry, location, role, specialization, temporal_info
- Do not add aliases, locations, or other details unless explicitly mentioned in the text

§ **Examples**:

**Example Input Text**: "Sarah Chen, a senior machine learning engineer at DeepMind, recently published groundbreaking research on transformer architectures. She collaborates frequently with researchers at Stanford University and specializes in natural language processing."

**Example Output**:
\`\`\`json
{
  "entities": [
    {
      "name": "Sarah Chen",
      "type": "MachineLearningEngineer",
      "id": "person_ml_engineer_sarah_chen",
      "properties": {
        "canonical_name": "Sarah Chen",
        "description": "Senior machine learning engineer",
        "context_hint": "DeepMind researcher specializing in NLP"
      },
      "standard_properties": {
        "role": "senior_engineer",
        "specialization": "machine_learning"
      }
    },
    {
      "name": "DeepMind",
      "type": "AIResearchCompany",
      "id": "ai_company_deepmind",
      "properties": {
        "canonical_name": "DeepMind",
        "description": "AI research company"
      },
      "standard_properties": {
        "industry": "artificial_intelligence"
      }
    },
    {
      "name": "transformer architectures",
      "type": "AIResearchTopic",
      "id": "research_topic_transformer_architectures",
      "properties": {
        "canonical_name": "Transformer Architectures",
        "description": "Machine learning model architecture",
        "context_hint": "deep learning research area"
      },
      "standard_properties": {
        "specialization": "deep_learning"
      }
    },
    {
      "name": "Stanford University",
      "type": "ResearchUniversity",
      "id": "university_stanford",
      "properties": {
        "canonical_name": "Stanford University",
        "description": "Research university"
      },
      "standard_properties": {}
    },
    {
      "name": "natural language processing",
      "type": "AISpecialization",
      "id": "specialization_nlp",
      "properties": {
        "canonical_name": "Natural Language Processing",
        "description": "AI field focused on language understanding",
        "aliases": ["NLP"]
      },
      "standard_properties": {
        "specialization": "artificial_intelligence"
      }
    }
  ],
  "relationships": [
    {
      "from": "person_ml_engineer_sarah_chen",
      "to": "ai_company_deepmind",
      "type": "EMPLOYED_BY",
      "evidence": {
        "type": "explicit",
        "text_support": "senior machine learning engineer at DeepMind",
        "certainty_markers": []
      },
      "properties": {
        "context": "employment as senior engineer"
      }
    },
    {
      "from": "person_ml_engineer_sarah_chen",
      "to": "research_topic_transformer_architectures",
      "type": "PUBLISHED_RESEARCH_ON",
      "evidence": {
        "type": "explicit",
        "text_support": "recently published groundbreaking research on transformer architectures",
        "certainty_markers": ["recently", "groundbreaking"]
      },
      "properties": {
        "context": "recent publication",
        "temporal_info": "recent"
      }
    },
    {
      "from": "person_ml_engineer_sarah_chen",
      "to": "university_stanford",
      "type": "COLLABORATES_WITH",
      "evidence": {
        "type": "explicit",
        "text_support": "collaborates frequently with researchers at Stanford University",
        "certainty_markers": ["frequently"]
      },
      "properties": {
        "context": "research collaboration"
      }
    },
    {
      "from": "person_ml_engineer_sarah_chen",
      "to": "specialization_nlp",
      "type": "SPECIALIZES_IN",
      "evidence": {
        "type": "explicit",
        "text_support": "specializes in natural language processing",
        "certainty_markers": []
      },
      "properties": {
        "context": "professional specialization"
      }
    }
  ]
}
\`\`\`
`;

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
				properties: { confidence: e.confidence || 0.8 },
			}));

			const relationships: GraphRelationship[] = (parsed.relationships || []).map((r: any) => ({
				id: `${r.from}_${r.type}_${r.to}`,
				type: r.type,
				from: r.from,
				to: r.to,
				properties: {
					confidence: r.confidence || 0.8,
					extractedFrom: text.substring(0, 100) + '...',
				},
			}));

			this.logger.debug('AIEntityExtractor: Extraction completed', {
				entityCount: entities.length,
				relationshipCount: relationships.length,
				entities: entities.map((e) => e.name),
				relationships: relationships.map((r) => `${r.from} ${r.type} ${r.to}`),
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

	async generateContextQuery(
		inputText: string,
		availableEntityTypes: string[],
		availableRelationships: string[],
	): Promise<string> {
		try {
			const prompt = `§ **Task**:

Generate a sophisticated, schema-aware Cypher query that dynamically retrieves comprehensive and relevant context from the knowledge graph based on the user's natural language message, leveraging the full breadth of available entities and relationships without artificial limitations.

§ **Input**:

<user_message>
${inputText}
</user_message>

<available_entity_types>
${availableEntityTypes.join(', ')}
</available_entity_types>

<available_relationships>
${availableRelationships.join(', ')}
</available_relationships>

§ **Context**:

Research demonstrates that effective knowledge graph querying requires moving beyond hardcoded patterns to dynamic, schema-aware approaches. Traditional methods that restrict queries to a few known labels and relationships fail to capture the rich connections available in complex graphs. Fine-tuned models with schema awareness significantly outperform zero-shot approaches for NL-to-Cypher translation. The most effective strategy involves analyzing the user's natural language directly to identify relevant entities and concepts, then leveraging the full graph schema to construct queries that find all relevant connections and context.

§ **Instructions**:

1. **Entity-Guided Query Construction**:
   - Analyze the \`user_message\` to identify key concepts, entities, and intent
   - Create flexible entity identification patterns that can match entity names, aliases, and canonical names in the graph
   - Use case-insensitive pattern matching to find entities mentioned or implied in the user's query
   - Consider both explicit entity mentions and conceptually related entities relevant to the user's intent

2. **Dynamic Schema Utilization**:
   - Leverage the actual \`available_entity_types\` and \`available_relationships\` rather than assuming fixed patterns
   - Construct queries that can work with any entity type present in the schema
   - Use relationship type filtering based on actual available relationships
   - Avoid hardcoding specific entity labels or relationship types

3. **Comprehensive Relationship Exploration**:
   - Design patterns for both direct (1-hop) and indirect (multi-hop) connections
   - Use variable-length path patterns to discover relevant connections at different depths
   - Include bidirectional relationship exploration to capture all relevant context
   - Implement optional matching to ensure partial results when some patterns don't match

4. **Evidence-Based Filtering and Ranking**:
   - Incorporate evidence quality filtering when available (explicit vs inferred relationships)
   - Use relationship metadata (context, temporal_info) for result ranking when present
   - Implement graceful fallbacks when evidence structure is not available
   - Prioritize connection strength and path length for relevance scoring

5. **Context-Rich Result Construction**:
   - Return comprehensive entity information including properties and standard_properties
   - Include relationship metadata and evidence information
   - Provide connection paths to understand how entities relate
   - Structure results to facilitate easy interpretation and follow-up queries

§ **Output**:

**Format**: Return only a valid Cypher query with no additional text, explanations, or markdown formatting.

The query must be executable and should return results in this structure:

- Entity information (name, type, properties, standard_properties)
- Relationship information (type, evidence, properties)
- Connection context (path information, relevance indicators)
- Ordered by relevance and evidence quality

§ **Evaluation Criteria**:

- **Schema Compliance**: Query must use only entity types and relationships present in the provided schema
- **Entity Coverage**: Must attempt to match all relevant entities identified in the user message
- **Relationship Breadth**: Must explore both direct and indirect connections without artificial type limitations
- **Evidence Integration**: Should incorporate evidence quality (explicit vs inferred) when available, with fallbacks for graphs without evidence metadata
- **Executability**: Query must be syntactically correct and executable Cypher
- **Relevance Ranking**: Results must be ordered by relevance to the user's query intent
- **Comprehensive Context**: Must return sufficient information for meaningful context understanding
- **Performance Consideration**: Query should be efficient and include appropriate limits

§ **Constraints**:

- Use only entity types and relationships specified in the schema inputs
- Do not hardcode specific entity names, types, or relationship patterns
- Ensure query handles cases where no entities match (graceful degradation)
- Include appropriate LIMIT clauses to prevent overwhelming results
- Use case-insensitive matching for entity identification (prefer \`toLower()\` over regex)
- Maintain query efficiency with appropriate WHERE clause optimization
- Handle potential null values in optional matching patterns
- Provide fallbacks when evidence metadata or complex property structures are unavailable
- Prioritize query reliability and executability over complexity

§ **Examples**:

**Example User Message**: "What should I eat for lunch today?"

**Example Available Entity Types**: ["Person", "Food", "Restaurant", "Cuisine", "Meal", "Location", "Preference"]

**Example Available Relationships**: ["LIKES", "PREFERS", "LOCATED_AT", "SERVES", "CATEGORY_OF", "SUITABLE_FOR"]

**Example Generated Query**:
\`\`\`cypher
MATCH (user:Person)
OPTIONAL MATCH (user)-[pref:LIKES|PREFERS]->(food:Food)
  WHERE pref.evidence.type = 'explicit' OR pref.evidence.type = 'inferred'
OPTIONAL MATCH (food)-[:CATEGORY_OF]->(meal:Meal)
  WHERE meal.name =~ '(?i).*lunch.*' OR meal.canonical_name =~ '(?i).*lunch.*'
OPTIONAL MATCH (user)-[locPref:PREFERS]->(cuisine:Cuisine)
OPTIONAL MATCH (food)-[:SERVED_AT]->(restaurant:Restaurant)-[:LOCATED_AT]->(location:Location)
OPTIONAL MATCH (user)-[r*1..2]-(related)
  WHERE any(rel in r WHERE rel.evidence.type = 'explicit')
RETURN DISTINCT
  user.name as user_name,
  food.name as food_name,
  food.type as food_type,
  food.properties as food_properties,
  pref.type as preference_type,
  pref.evidence as preference_evidence,
  cuisine.name as preferred_cuisine,
  restaurant.name as restaurant_name,
  location.name as location_name,
  related.name as additional_context,
  [rel in r | rel.type] as connection_path
ORDER BY
  CASE WHEN pref.evidence.type = 'explicit' THEN 1 ELSE 2 END,
  size([rel in r WHERE rel.evidence.type = 'explicit']) DESC,
  food.name
LIMIT 15
\`\`\`

**Example User Message**: "Tell me about Sarah's research collaborations"

**Example Available Entity Types**: ["Person", "ResearchTopic", "University", "Publication", "Project"]

**Example Available Relationships**: ["COLLABORATES_WITH", "WORKS_WITH", "PUBLISHED_RESEARCH_ON", "RESEARCHES", "AFFILIATED_WITH"]

**Example Generated Query**:
\`\`\`cypher
MATCH (sarah:Person)
  WHERE sarah.name =~ '(?i).*sarah.*' OR sarah.canonical_name =~ '(?i).*sarah.*'
OPTIONAL MATCH (sarah)-[collab:COLLABORATES_WITH|WORKS_WITH]->(collaborator)
  WHERE collab.evidence.type = 'explicit' OR collab.evidence.type = 'inferred'
OPTIONAL MATCH (sarah)-[research_rel:PUBLISHED_RESEARCH_ON|RESEARCHES|STUDIES]->(research_topic)
OPTIONAL MATCH (collaborator)-[shared_research:PUBLISHED_RESEARCH_ON|RESEARCHES]->(research_topic)
OPTIONAL MATCH (sarah)-[r*1..3]-(related)
  WHERE any(rel in r WHERE rel.type IN ['COLLABORATES_WITH', 'WORKS_WITH', 'PUBLISHED_RESEARCH_ON', 'AFFILIATED_WITH'])
RETURN DISTINCT
  sarah.name as researcher_name,
  sarah.standard_properties.role as researcher_role,
  collaborator.name as collaborator_name,
  collaborator.type as collaborator_type,
  collab.type as collaboration_type,
  collab.evidence as collaboration_evidence,
  collab.properties.context as collaboration_context,
  research_topic.name as research_area,
  related.name as additional_context,
  [rel in r | rel.type] as connection_types
ORDER BY
  CASE WHEN collab.evidence.type = 'explicit' THEN 1 ELSE 2 END,
  collaborator.name,
  research_topic.name
LIMIT 20
\`\`\`
`;

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
		{
			pattern: /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
			type: 'Person',
			getValue: (match: string) => match.trim(),
		},
		{
			pattern: /\b([A-Z][a-z]+)\b(?=\s+(?:loves|likes|hates|enjoys|eats|drinks|works|lives))/g,
			type: 'Person',
			getValue: (match: string) => match.trim(),
		},

		// Object/Concept patterns
		{
			pattern: /\b(apples?|oranges?|bananas?|pizza|coffee|tea|water|food)\b/gi,
			type: 'Food',
			getValue: (match: string) => match.toLowerCase(),
		},
		{
			pattern: /\b(music|movies?|books?|sports?|games?|art)\b/gi,
			type: 'Interest',
			getValue: (match: string) => match.toLowerCase(),
		},
		{
			pattern: /\b(work|job|career|profession)\b/gi,
			type: 'Occupation',
			getValue: (match: string) => match.toLowerCase(),
		},
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
						properties: {},
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
				const afterText = text.substring(
					relationshipIndex + match[0].length,
					Math.min(text.length, relationshipIndex + match[0].length + 50),
				);

				// Find subject (entity before relationship)
				const subjectEntities = entities.filter(
					(e) =>
						beforeText.toLowerCase().includes(e.name.toLowerCase()) ||
						(e.name === 'User' && beforeText.match(/\b(I|me|my)\b/i)),
				);

				// Find object (entity after relationship)
				const objectEntities = entities.filter((e) =>
					afterText.toLowerCase().includes(e.name.toLowerCase()),
				);

				// Create relationships
				subjectEntities.forEach((subject) => {
					objectEntities.forEach((object) => {
						if (subject.id !== object.id) {
							relationships.push({
								id: `${subject.id}_${type}_${object.id}`,
								type,
								from: subject.id,
								to: object.id,
								properties: {
									extractedFrom: text.substring(
										Math.max(0, relationshipIndex - 20),
										Math.min(text.length, relationshipIndex + match[0].length + 20),
									),
								},
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

	async enrichFromMessage(
		message: string,
		sessionId?: string,
	): Promise<{ entities: number; relationships: number }> {
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
				const availableEntityTypes = [
					'Person',
					'Food',
					'Company',
					'Interest',
					'Location',
					'Object',
				];
				const availableRelationships = [
					'LOVES',
					'LIKES',
					'HATES',
					'WORKS_AT',
					'LIVES_IN',
					'KNOWS',
					'OWNS',
				];

				query = await this.aiExtractor.generateContextQuery(
					message,
					availableEntityTypes,
					availableRelationships,
				);

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

				const entityNames = extraction.entities.map((e) => e.name);
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
						`${result.entity_name} ${result.relationship_type.toLowerCase()} ${result.related_name}`,
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

	private async createOrUpdateEntityWithSession(
		entity: GraphEntity,
		sessionId?: string,
	): Promise<void> {
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

	private async createRelationshipWithSession(
		relationship: GraphRelationship,
		sessionId?: string,
	): Promise<void> {
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
					knowledge_context: relevantContext,
				};
			}

			// Convert to string format with knowledge context
			const historyString = enrichedHistory
				.map((msg) => `${msg.getType()}: ${msg.content}`)
				.join('\n');
			const contextString = this.formatContextAsString(relevantContext);

			return {
				[this.memoryKey]: historyString,
				knowledge_context: contextString,
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
			.filter((msg) => msg !== null)
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

	private async extractKnowledgeFromConversation(
		inputText: string,
		outputText: string,
	): Promise<void> {
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
			const entityNames = extraction.entities.map((e) => e.name);
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

	private async enrichWithKnowledgeGraph(
		messages: BaseMessage[],
		context: any[],
	): Promise<BaseMessage[]> {
		if (context.length === 0) {
			return messages;
		}

		// Create a context summary message
		const contextSummary = this.formatContextAsString(context);
		const contextMessage = new AIMessage(`[Knowledge Graph Context]: ${contextSummary}`);

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
			return 'No relevant knowledge found.';
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
			if (
				item.entity &&
				item.shared_relationship_1 &&
				item.shared_entity &&
				item.shared_relationship_2 &&
				item.other_entity
			) {
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
			return 'Entities recognized but no specific relationships found.';
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
		ai_agent: {
			connection: '',
			locale: 'AI Agent',
		},
		ai_vectorStore: {
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
