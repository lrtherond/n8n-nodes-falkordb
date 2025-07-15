"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbVectorStoreOperations = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const FalkorDbLangChain_1 = require("./FalkorDbLangChain");
const metadataFilterField = {
    displayName: 'Metadata Filter',
    name: 'metadataFilter',
    type: 'string',
    default: '',
    description: 'JSON filter for metadata (e.g., {"source": "doc1"})',
    placeholder: '{"key": "value"}',
};
class FalkorDbVectorStoreOperations {
    constructor() {
        this.description = {
            displayName: 'FalkorDB Vector Store Operations',
            name: 'falkorDbVectorStoreOperations',
            icon: 'file:falkordb.svg',
            group: ['transform'],
            version: 1,
            description: 'Perform operations on FalkorDB vector store',
            defaults: {
                name: 'FalkorDB Vector Store Operations',
            },
            inputs: ["main"],
            outputs: ["main"],
            credentials: [
                {
                    name: 'falkorDbApi',
                    required: true,
                },
            ],
            properties: [
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Insert',
                            value: 'insert',
                            description: 'Insert documents into vector store',
                            action: 'Insert documents',
                        },
                        {
                            name: 'Retrieve',
                            value: 'retrieve',
                            description: 'Retrieve similar documents',
                            action: 'Retrieve documents',
                        },
                        {
                            name: 'Delete',
                            value: 'delete',
                            description: 'Delete documents from vector store',
                            action: 'Delete documents',
                        },
                    ],
                    default: 'insert',
                },
                {
                    displayName: 'Collection Name',
                    name: 'collectionName',
                    type: 'string',
                    required: true,
                    default: 'vectors',
                    description: 'Name of the collection to operate on',
                },
                {
                    displayName: 'Document Content',
                    name: 'documentContent',
                    type: 'string',
                    required: true,
                    default: '',
                    description: 'Content of the document to insert',
                    displayOptions: {
                        show: {
                            operation: ['insert'],
                        },
                    },
                },
                {
                    displayName: 'Metadata',
                    name: 'metadata',
                    type: 'string',
                    default: '{}',
                    description: 'JSON metadata for the document',
                    displayOptions: {
                        show: {
                            operation: ['insert'],
                        },
                    },
                },
                {
                    displayName: 'Query Text',
                    name: 'queryText',
                    type: 'string',
                    required: true,
                    default: '',
                    description: 'Text to search for similar documents',
                    displayOptions: {
                        show: {
                            operation: ['retrieve'],
                        },
                    },
                },
                {
                    displayName: 'Top K',
                    name: 'topK',
                    type: 'number',
                    default: 10,
                    description: 'Number of results to return',
                    displayOptions: {
                        show: {
                            operation: ['retrieve'],
                        },
                    },
                },
                metadataFilterField,
                {
                    displayName: 'Document IDs',
                    name: 'documentIds',
                    type: 'string',
                    required: true,
                    default: '',
                    description: 'Comma-separated list of document IDs to delete',
                    displayOptions: {
                        show: {
                            operation: ['delete'],
                        },
                    },
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const operation = this.getNodeParameter('operation', 0);
        const collectionName = this.getNodeParameter('collectionName', 0);
        const credentials = await this.getCredentials('falkorDbApi');
        const vectorStore = new FalkorDbLangChain_1.FalkorDbVectorStore({
            collectionName,
            dimensions: 1536,
            credentials,
        });
        for (let i = 0; i < items.length; i++) {
            try {
                let result = {};
                if (operation === 'insert') {
                    const documentContent = this.getNodeParameter('documentContent', i);
                    const metadata = this.getNodeParameter('metadata', i, '{}');
                    let parsedMetadata = {};
                    try {
                        parsedMetadata = JSON.parse(metadata);
                    }
                    catch (error) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid metadata JSON: ${error.message}`, { itemIndex: i });
                    }
                    await vectorStore.addDocuments([
                        {
                            pageContent: documentContent,
                            metadata: parsedMetadata,
                        },
                    ]);
                    result = {
                        success: true,
                        operation: 'insert',
                        collectionName,
                        documentContent,
                        metadata: parsedMetadata,
                    };
                }
                else if (operation === 'retrieve') {
                    const queryText = this.getNodeParameter('queryText', i);
                    const topK = this.getNodeParameter('topK', i);
                    const metadataFilter = this.getNodeParameter('metadataFilter', i, '');
                    let parsedFilter;
                    if (metadataFilter) {
                        try {
                            parsedFilter = JSON.parse(metadataFilter);
                        }
                        catch (error) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid metadata filter JSON: ${error.message}`, { itemIndex: i });
                        }
                    }
                    const documents = await vectorStore.similaritySearch(queryText, topK, parsedFilter);
                    result = {
                        success: true,
                        operation: 'retrieve',
                        collectionName,
                        queryText,
                        results: documents,
                        count: documents.length,
                    };
                }
                else if (operation === 'delete') {
                    const documentIds = this.getNodeParameter('documentIds', i);
                    const ids = documentIds.split(',').map((id) => id.trim());
                    await vectorStore.delete(ids);
                    result = {
                        success: true,
                        operation: 'delete',
                        collectionName,
                        deletedIds: ids,
                        count: ids.length,
                    };
                }
                returnData.push({
                    json: result,
                    pairedItem: {
                        item: i,
                    },
                });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error.message,
                            operation,
                            collectionName,
                        },
                        pairedItem: {
                            item: i,
                        },
                    });
                }
                else {
                    throw error;
                }
            }
        }
        return [returnData];
    }
}
exports.FalkorDbVectorStoreOperations = FalkorDbVectorStoreOperations;
//# sourceMappingURL=FalkorDbVectorStoreOperations.node.js.map