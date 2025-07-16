# n8n-nodes-falkordb

> ⚠️ **Development Warning**: This package is currently under active development and should **NOT** be used in production environments. Features may be incomplete, unstable, or subject to breaking changes without notice.

This is an n8n community node package that provides comprehensive integration with FalkorDB, a graph database that supports Cypher queries and AI workflows.

[FalkorDB](https://falkordb.com) is a graph database that provides a Redis-compatible interface while supporting advanced graph operations through Cypher query language and vector similarity search.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Nodes

This package includes three specialized nodes designed for different use cases:

### 1. FalkorDB Node (Traditional Database Operations)
Core database operations for graph management and Cypher queries.

**Operations:**
- **Graph Operations**: Create, delete, and list graphs
- **Query Operations**: Execute Cypher queries and get execution plans
- **Schema Operations**: Retrieve schema, create/drop indexes

### 2. FalkorDB Memory Node (AI Agent Integration)
Specialized node for AI agent memory management with LangChain integration.

**Features:**
- Session-based conversation memory
- Context window management
- Integration with AI agents and chat workflows
- Automatic message history storage in graph format
- Supports custom session management

**Connection Types:**
- **Output**: `AiMemory` (connects to AI agents)
- **Input**: None (supply node)

### 3. FalkorDB Vector Store Node (Embedding & Similarity Search)
Vector store implementation for embeddings and similarity search.

**Features:**
- Document embedding storage
- Vector similarity search
- Metadata filtering
- Collection management
- Integration with LangChain vector stores

**Connection Types:**
- **Output**: `AiVectorStore` (connects to AI agents)
- **Input**: None (supply node)

**Operations Node:**
- **Insert**: Add documents with embeddings
- **Retrieve**: Perform similarity search
- **Delete**: Remove documents by ID

## Credentials

You need to create a FalkorDB API credential with the following information:

- **Host**: FalkorDB server hostname or IP address (default: localhost)
- **Port**: FalkorDB server port (default: 6379)
- **Username**: Username for authentication (optional)
- **Password**: Password for authentication (optional)
- **SSL/TLS**: Whether to use SSL/TLS connection (default: false)

## Example Usage

### Traditional Database Operations

#### Create a Graph
1. Use **FalkorDB** node
2. Select Resource: `Graph`
3. Select Operation: `Create`
4. Enter Graph Name: `my-graph`

#### Execute a Cypher Query
1. Use **FalkorDB** node
2. Select Resource: `Query`
3. Select Operation: `Execute`
4. Enter Graph Name: `my-graph`
5. Enter Cypher Query: `MATCH (n) RETURN n LIMIT 10`

### AI Agent Integration

#### Memory Management
1. Use **FalkorDB Memory** node
2. Connect to AI Agent node
3. Configure session management
4. Set context window length
5. Memory is automatically stored in graph format

#### Vector Store Operations
1. Use **FalkorDB Vector Store** node
2. Connect to AI Agent or embedding model
3. Configure collection name and dimensions
4. Use **FalkorDB Vector Store Operations** for manual operations:
   - Insert documents with metadata
   - Retrieve similar documents
   - Delete specific documents

### Advanced Cypher Queries

#### Create Nodes and Relationships
```cypher
CREATE (p:Person {name: 'Alice', age: 30})-[:KNOWS]->(q:Person {name: 'Bob', age: 25})
RETURN p, q
```

#### Memory Storage (handled automatically by Memory node)
```cypher
MERGE (s:Session {id: $sessionId})
CREATE (s)-[:HAS_MESSAGE]->(m:Message {
  type: 'human',
  content: $content,
  timestamp: datetime()
})
```

#### Vector Storage (handled automatically by Vector Store node)
```cypher
MERGE (c:Collection {name: $collectionName})
CREATE (c)-[:CONTAINS]->(d:Document {
  content: $content,
  metadata: $metadata,
  embedding: $embedding,
  created_at: datetime()
})
```

## AI Workflow Integration

### LangChain Compatibility
- **Memory Interface**: Compatible with LangChain's `BaseChatMemory`
- **Vector Store Interface**: Compatible with LangChain's `VectorStore`
- **Session Management**: Automatic session handling for chat workflows
- **Document Processing**: Supports document chunking and embedding

### Use Cases
- **Conversational AI**: Persistent memory across chat sessions
- **RAG (Retrieval Augmented Generation)**: Vector similarity search for context
- **Knowledge Graphs**: Store and query structured knowledge
- **Multi-turn Conversations**: Context-aware responses with memory
- **Semantic Search**: Find relevant documents based on meaning

## Architecture

### Graph-Based Memory
- Messages stored as nodes with timestamps
- Relationships capture conversation flow
- Rich metadata and context preservation
- Efficient querying with Cypher

### Vector Storage
- Documents stored with vector embeddings
- Metadata filtering for precise search
- Configurable similarity thresholds
- Scalable collection management

## Resources

- [FalkorDB Documentation](https://docs.falkordb.com/)
- [Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [LangChain Integration](https://docs.langchain.com/docs/)

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

### 0.1.0
- Initial release with three specialized nodes
- FalkorDB node for traditional database operations
- FalkorDB Memory node for AI agent integration
- FalkorDB Vector Store node for embeddings and similarity search
- LangChain compatibility layer
- Session management for chat workflows
- Vector operations for RAG applications
- Comprehensive Cypher query support