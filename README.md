# n8n-nodes-falkordb

> ⚠️ **Development Warning**: This package is currently under active development and should **NOT** be used in production environments. Features may be incomplete, unstable, or subject to breaking changes without notice.

This is an n8n community node package that provides FalkorDB-based memory management for AI Agent workflows in n8n.

[FalkorDB](https://falkordb.com) is a graph database that provides powerful knowledge graph capabilities through its REST API, making it ideal for AI memory applications that require rich relationship modeling and context understanding.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Node

This package includes one specialized cluster node designed for AI Agent memory management:

### FalkorDB Knowledge Graph Node (AI Agent Memory)

A cluster node that leverages AI models to build and query knowledge graphs for intelligent memory management in AI workflows.

**Features:**
- AI-powered entity and relationship extraction from conversations
- Knowledge graph construction in FalkorDB
- AI-generated Cypher queries for context retrieval
- Session-based memory management
- Integration with n8n AI Agent nodes
- LangChain compatibility for seamless workflow integration

**Connection Types:**
- **Inputs**: 
  - `AiLanguageModel` (required) - AI model for entity extraction and query generation
  - `Main` (optional) - Text input for processing
- **Outputs**: 
  - `AiVectorStore` (connects to AI Agent nodes for memory)
  - `Main` - Processing results and statistics

**Key Operations:**
- Extract entities and relationships from natural language using AI
- Build knowledge graphs with rich relationship modeling
- Generate intelligent context queries for memory retrieval
- Dual functionality: standalone processing and AI Agent memory integration

## Credentials

You need to create a FalkorDB API credential with the following information:

- **Host**: FalkorDB server hostname or IP address (default: localhost)
- **Port**: FalkorDB REST API port (default: 3000)
- **Username**: Username for authentication (optional)
- **Password**: Password for authentication (optional)
- **SSL/TLS**: Whether to use SSL/TLS connection (default: false)

## Example Usage

### AI Agent Memory Integration

1. **Add AI Language Model**
   - Add your preferred AI model node (OpenAI, Claude, etc.)
   - Configure with appropriate credentials

2. **Add FalkorDB Knowledge Graph Node**
   - Drag the **FalkorDB Knowledge Graph** node into your workflow
   - Configure the FalkorDB API credentials
   - Set graph name (e.g., `ai-memory`)
   - Connect the AI model to the Knowledge Graph node

3. **Connect to AI Agent**
   - Connect the FalkorDB Knowledge Graph node output to your AI Agent node
   - The AI Agent will automatically use the knowledge graph for memory
   - Memory is persisted and enriched across workflow executions

### Sample Workflow

```
[OpenAI Model] ──┐
                 │
Chat Trigger ────┤── [FalkorDB Knowledge Graph] ──── [AI Agent] ──── Response
                 │          (Memory)
[FalkorDB Creds] ─┘
```

The AI Agent will:
- Extract entities and relationships from conversations using the connected AI model
- Build a knowledge graph in FalkorDB with rich relationship modeling
- Generate intelligent context queries for memory retrieval
- Maintain persistent, queryable memory across sessions

### Example Knowledge Graph Construction

**Human Input**: "I, Laurent, love apples and work at Google"

**AI Extraction**:
```json
{
  "entities": [
    {"name": "Laurent", "type": "Person", "id": "person_laurent"},
    {"name": "apples", "type": "Food", "id": "food_apples"},
    {"name": "Google", "type": "Company", "id": "company_google"}
  ],
  "relationships": [
    {"from": "person_laurent", "to": "food_apples", "type": "LOVES"},
    {"from": "person_laurent", "to": "company_google", "type": "WORKS_AT"}
  ]
}
```

**Knowledge Graph Result**:
```
(Laurent:Person)-[:LOVES]->(apples:Food)
(Laurent:Person)-[:WORKS_AT]->(Google:Company)
```

**Future Context Query**: "What should I eat for lunch?"

**AI-Generated Cypher Query**:
```cypher
MATCH (p:Person)-[r:LOVES|LIKES]->(f:Food) 
WHERE p.name = 'Laurent'
RETURN f.name, f.type, r.type
LIMIT 20
```

**Context Retrieved**: "Laurent loves apples"

## Configuration Options

### Knowledge Graph Settings

- **Graph Name**: FalkorDB graph name for memory storage (default: `memory`)

The node uses sensible defaults and leverages the connected AI model for intelligent processing.

### Memory Features

- **AI-Powered Extraction**: Uses connected AI models for sophisticated entity and relationship extraction
- **Knowledge Graph Construction**: Builds rich, queryable knowledge graphs in FalkorDB
- **Intelligent Querying**: AI-generated Cypher queries for context retrieval
- **Session Management**: Automatic session-based memory isolation
- **Persistent Storage**: Memory survives workflow restarts
- **Dual Functionality**: Works as both standalone processor and AI Agent memory

## API Integration

### FalkorDB REST API

This node integrates with FalkorDB's REST API available at `http://<hostname>:3000/api`:

- **Endpoint**: `/api/graph/{graph_name}`
- **Method**: POST
- **Authentication**: Cookie-based session authentication
- **Content-Type**: application/json

### Request Format

```json
{
  "query": "CYPHER_QUERY",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

## AI Workflow Integration

### LangChain Compatibility

- **Memory Interface**: Compatible with LangChain's `BaseChatMemory`
- **Message Processing**: Handles conversation flow and context
- **Session Management**: Automatic session handling for AI workflows
- **Graph Integration**: Seamless integration with n8n's AI ecosystem

### Use Cases

- **Conversational AI**: Persistent, intelligent memory across chat sessions
- **Knowledge Retention**: Long-term memory with rich relationship modeling
- **Multi-turn Conversations**: Context-aware responses with graph-based memory
- **Fact Extraction**: Automatic knowledge graph construction from conversations
- **Semantic Understanding**: AI-powered entity and relationship recognition

## Architecture

### Knowledge Graph Memory Management

- **Entities**: People, objects, concepts stored as graph nodes
- **Relationships**: Connections between entities (LOVES, WORKS_AT, KNOWS, etc.)
- **AI-Powered Processing**: Leverages connected AI models for extraction and querying
- **Rich Context**: Graph relationships provide deeper context than simple vector similarity

### Cluster Node Design

- **Multiple Inputs**: AI model and optional text input
- **Dual Outputs**: Memory interface for AI Agents and processing results
- **Flexible Integration**: Works with any LangChain-compatible AI model
- **Scalable Architecture**: Handles complex knowledge graphs efficiently

## Resources

- [FalkorDB Documentation](https://docs.falkordb.com/)
- [FalkorDB REST API](https://docs.falkordb.com/integration/rest.html)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [n8n AI Agent Documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.agent/)

## Development

### Build Instructions

To build the package for development or publishing:

```bash
# Install dependencies
npm install

# Build the package (compiles TypeScript and copies assets)
npm run build

# Run linting checks
npm run lint

# Auto-fix linting issues
npm run lintfix

# Format code
npm run format

# Development with watch mode
npm run dev
```

### Publishing to npm

To prepare and publish this package to npm:

1. **Ensure all tests pass and code is clean:**
   ```bash
   npm run build
   npm run lint
   npm run format
   ```

2. **Update version in package.json:**
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

3. **Run pre-publish checks:**
   ```bash
   npm run prepublishOnly
   ```

4. **Publish to npm:**
   ```bash
   npm publish
   ```

   For first-time publishing, you may need to login:
   ```bash
   npm login
   npm publish
   ```

### Development Guidelines

- All code must pass ESLint checks with n8n community standards
- TypeScript compilation must be error-free
- Follow existing code patterns and n8n conventions
- Test all node operations thoroughly before publishing

## License

MIT

## Version History

### 1.0.1 (Current)
- **Complete Architecture Redesign**: Cluster node with AI model integration
- **AI-Powered Knowledge Graph**: Entity and relationship extraction using connected AI models
- **Intelligent Query Generation**: AI-generated Cypher queries for context retrieval
- **Dual Functionality**: Standalone processing and AI Agent memory integration
- **LangChain Compatibility**: Proper integration with n8n's AI ecosystem
- **Session Management**: Rich session-based memory with graph relationships

### 0.1.6
- Vector store implementation (deprecated)
- Basic FalkorDB integration
- Placeholder embedding generation

### 0.1.0
- Initial release with multiple node types (consolidated)