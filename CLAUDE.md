# FalkorDB n8n Node Package - Development Context

## Project Overview

This is a comprehensive n8n community node package for FalkorDB, a graph database with AI integration capabilities. The package provides full integration with n8n workflows and LangChain for AI applications.

## Package Structure

### Core Components
- **1 Node Type**: FalkorDB Vector Store for AI workflows
- **1 Credential Type**: FalkorDB API authentication with cookie-based sessions
- **LangChain Integration**: Complete AI workflow support with vector store and memory utilities
- **TypeScript**: Full type safety and modern development

### Node Types
1. **FalkorDB Vector Store Node** (`FalkorDbVectorStore.node.ts`)
   - Vector store supply node for AI agents
   - Embedding storage and similarity search
   - LangChain VectorStore integration
   - Outputs: `NodeConnectionType.AiVectorStore`
   - Supports metadata filtering and configurable similarity thresholds

## Development Standards

### Configuration Files
- **package.json**: Follows n8n community standards (Node.js >=20.15)
- **tsconfig.json**: Strict TypeScript configuration with proper compilation
- **eslintrc.js**: Complete n8n rule set (155+ rules) for code quality
- **eslintrc.prepublish.js**: Pre-publish validation with stricter rules
- **prettierrc.js**: Consistent code formatting
- **gulpfile.js**: Asset management and build optimization

### Code Quality
- ✅ **Passes all n8n linting rules** (155+ specific rules)
- ✅ **TypeScript compliant** with strict type checking
- ✅ **Properly formatted** with Prettier
- ✅ **Error-free builds** with clean compilation
- ✅ **Node JSON documentation** files for all nodes

### Build Process
```bash
npm run build      # Clean build with TypeScript + asset copying
npm run lint       # Comprehensive n8n linting
npm run lintfix    # Auto-fix linting issues
npm run format     # Code formatting with Prettier
npm run dev        # Development with watch mode
```

## Technical Implementation

### LangChain Integration
- **FalkorDbChatMemory**: Custom BaseChatMemory implementation
- **FalkorDbVectorStore**: Custom VectorStore implementation
- **Session Management**: Multi-source session ID handling
- **Connection Utilities**: Helper functions for AI integration

### Key Features
- **Graph-native memory**: Leverages graph relationships for rich context
- **Vector similarity search**: Embedding-based document retrieval
- **Session persistence**: Conversation history across chat sessions
- **Metadata filtering**: Advanced document filtering capabilities
- **AI agent compatibility**: Full n8n AI workflow integration

### API Integration
- **FalkorDB REST API**: Complete HTTP client implementation with cookie-based authentication
- **Authentication**: Session-based authentication using `/api/auth/providers` and signin flow
- **Session Management**: Automatic cookie extraction and inclusion in all API requests
- **Error handling**: Comprehensive error management with user-friendly messages
- **Security**: Proper authentication flow following FalkorDB's documented API patterns

## File Organization

```
/
├── credentials/
│   └── FalkorDbApi.credentials.ts     # API authentication with cookie-based sessions
├── nodes/
│   └── FalkorDb/
│       ├── FalkorDbVectorStore.node.ts # Vector store supply node
│       ├── FalkorDbVectorStore.node.json # Documentation metadata
│       ├── FalkorDbLangChain.ts       # LangChain integration utilities
│       └── falkordb.svg               # Custom node icon
├── dist/                              # Build output (auto-generated)
├── package.json                       # Project configuration
├── tsconfig.json                      # TypeScript configuration
├── gulpfile.js                        # Build process
├── .eslintrc.js                       # Main linting rules
├── .eslintrc.prepublish.js            # Pre-publish validation
├── .prettierrc.js                     # Code formatting
├── index.js                           # Package entry point
└── README.md                          # User documentation
```

## Development Guidelines

### Adding New Features
1. **Follow n8n patterns**: Use existing nodes as reference
2. **Maintain type safety**: Ensure all TypeScript definitions are correct
3. **Add proper linting**: Run `npm run lint` before committing
4. **Include documentation**: Add JSON metadata files for new nodes
5. **Test thoroughly**: Verify build, lint, and functionality

### Code Style
- **Use TypeScript**: All code should be properly typed
- **Follow n8n conventions**: Property names, descriptions, and structure
- **Maintain consistency**: Use existing patterns and naming conventions
- **Document everything**: Clear descriptions for all parameters and operations

### Testing
- **Build verification**: `npm run build` should complete without errors
- **Linting compliance**: `npm run lint` should pass all rules
- **Format consistency**: `npm run format` should not change any files
- **Functionality testing**: Test all node operations manually

## Deployment

### Package Publication
1. **Pre-publish check**: `npm run prepublishOnly`
2. **Version bump**: Update version in package.json
3. **Build package**: `npm run build`
4. **Publish**: `npm publish`

### Installation
```bash
# In n8n instance
npm install n8n-nodes-falkordb
```

## Known Limitations

### Current Implementation
- **Single node implementation**: Only vector store node is currently implemented
- **Cookie-based authentication**: Fully implemented FalkorDB session authentication
- **LangChain integration**: Complete vector store and memory utilities with placeholder embeddings
- **Limited testing**: No automated test suite currently

### Future Improvements
- **Additional node types**: Implement database operations, memory, and vector operations nodes
- **Real embedding integration**: Replace placeholder embeddings with actual embedding models
- **Comprehensive testing**: Add Jest test suite
- **Performance optimization**: Implement connection pooling and session caching
- **Advanced features**: Add more FalkorDB-specific operations and graph querying capabilities

## Dependencies

### Production Dependencies
- **n8n-workflow**: Core n8n node interfaces and utilities (peer dependency)

### Development Dependencies
- **TypeScript**: Language and compilation
- **ESLint**: Code quality and n8n-specific rules
- **Prettier**: Code formatting
- **Gulp**: Build process and asset management
- **Rimraf**: Clean build directory

## Troubleshooting

### Common Issues
1. **Build errors**: Check TypeScript configuration and dependencies
2. **Linting failures**: Run `npm run lintfix` for auto-fixes
3. **Asset missing**: Verify gulp build:icons task
4. **Type errors**: Ensure all imports are properly typed

### Development Tips
- **Use watch mode**: `npm run dev` for continuous development
- **Check output**: Verify dist/ directory after builds
- **Test locally**: Link package for local n8n testing
- **Follow patterns**: Use existing n8n nodes as reference

## Version History

### 0.1.0 (Current)
- Initial release with 1 node type (FalkorDB Vector Store)
- Complete n8n best practices compliance
- Cookie-based authentication implementation
- LangChain integration framework with vector store and memory utilities
- Comprehensive ESLint configuration
- Production-ready package structure

---

*This context document should be updated whenever significant changes are made to the package structure, build process, or development guidelines.*