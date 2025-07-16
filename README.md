# n8n-nodes-falkordb

> ⚠️ **Development Warning**: This package is currently under active development and should **NOT** be used in production environments. Features may be incomplete, unstable, or subject to breaking changes without notice.

This is an n8n community node package that provides FalkorDB vector store integration specifically designed for AI Agent memory in n8n workflows.

[FalkorDB](https://falkordb.com) is a graph database that provides vector similarity search capabilities through its REST API, making it ideal for AI memory applications.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Node

This package includes one specialized node designed for AI Agent memory:

### FalkorDB Vector Store Node (AI Agent Memory)

Vector store implementation for AI Agent memory with embedding storage and similarity search.

**Features:**
- Document embedding storage in FalkorDB graph database
- Vector similarity search for AI memory retrieval
- Metadata filtering for enhanced search capabilities
- Session-based memory management
- Integration with n8n AI Agent nodes
- LangChain compatibility

**Connection Types:**
- **Output**: `AiVectorStore` (connects to AI Agent nodes)
- **Input**: None (supply node)

**Key Operations:**
- Automatic document storage with embeddings
- Similarity search for memory retrieval
- Memory persistence across AI Agent sessions
- Graph-based relationships for rich context

## Credentials

You need to create a FalkorDB API credential with the following information:

- **Host**: FalkorDB server hostname or IP address (default: localhost)
- **Port**: FalkorDB REST API port (default: 3000)
- **Username**: Username for authentication (optional)
- **Password**: Password for authentication (optional)
- **SSL/TLS**: Whether to use SSL/TLS connection (default: false)

## Example Usage

### AI Agent Memory Integration

1. **Add FalkorDB Vector Store Node**
   - Drag the **FalkorDB Vector Store** node into your workflow
   - Configure the FalkorDB API credentials
   - Set graph name (e.g., `ai-memory`)
   - Set node label (e.g., `Document`)
   - Configure dimensions (default: 1536 for OpenAI embeddings)

2. **Connect to AI Agent**
   - Connect the FalkorDB Vector Store node output to your AI Agent node
   - The AI Agent will automatically use the vector store for memory
   - Memory is persisted across workflow executions

3. **Configure Memory Settings**
   - **Graph Name**: Database graph to store memory (e.g., `ai-sessions`)
   - **Node Label**: Label for memory documents (e.g., `Memory`)
   - **Dimensions**: Vector embedding dimensions (match your embedding model)
   - **Distance Metric**: `cosine`, `euclidean`, or `dotproduct`
   - **Similarity Threshold**: Minimum similarity score for memory retrieval

### Sample Workflow

```
Chat Trigger → AI Agent → Response
                ↑
    FalkorDB Vector Store (Memory)
```

The AI Agent will:
- Store conversation context in FalkorDB
- Retrieve relevant memory during conversations
- Maintain persistent memory across sessions

## Configuration Options

### Vector Store Settings

- **Graph Name**: FalkorDB graph name for memory storage
- **Node Label**: Graph node label for memory documents
- **Dimensions**: Vector embedding dimensions
- **Distance Metric**: Similarity calculation method
- **Similarity Threshold**: Minimum score for memory retrieval
- **Top K**: Maximum number of memory items to retrieve

### Memory Features

- **Session Management**: Automatic session-based memory isolation
- **Context Preservation**: Rich metadata storage for conversation context
- **Semantic Search**: Vector similarity for intelligent memory retrieval
- **Persistent Storage**: Memory survives workflow restarts

## API Integration

### FalkorDB REST API

This node integrates with FalkorDB's REST API available at `http://<hostname>:3000/api`:

- **Endpoint**: `/api/graph/{graph_name}`
- **Method**: POST
- **Authentication**: HTTP Basic Auth (username/password)
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

- **Vector Store Interface**: Compatible with LangChain's `VectorStore`
- **Memory Interface**: Supports AI Agent memory patterns
- **Document Processing**: Handles embedding generation and storage
- **Session Management**: Automatic session handling for AI workflows

### Use Cases

- **Conversational AI**: Persistent memory across chat sessions
- **RAG (Retrieval Augmented Generation)**: Vector similarity search for context
- **Knowledge Retention**: Long-term memory for AI agents
- **Multi-turn Conversations**: Context-aware responses with memory
- **Semantic Search**: Find relevant conversation history

## Architecture

### Graph-Based Memory Storage

- Documents stored as graph nodes with vector embeddings
- Relationships capture conversation flow and context
- Rich metadata for filtering and search
- Efficient querying with Cypher and vector operations

### Vector Similarity Search

- Embedding-based similarity calculation
- Configurable distance metrics (cosine, euclidean, dot product)
- Threshold-based filtering for relevant memories
- Scalable storage for large conversation histories

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

### 0.1.6 (Current)
- Focused implementation for AI Agent memory
- FalkorDB Vector Store node for AI memory integration
- REST API integration with FalkorDB (port 3000)
- LangChain compatibility layer
- Placeholder embedding generation for development
- Streamlined codebase for AI Agent focus

### 0.1.0
- Initial release with multiple node types
- Comprehensive FalkorDB integration (deprecated)
- Multiple nodes for different use cases (consolidated)