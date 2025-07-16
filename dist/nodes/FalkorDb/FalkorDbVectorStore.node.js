"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbVectorStore = void 0;
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
class FalkorDbVectorStore {
    constructor() {
        this.description = {
            displayName: 'FalkorDB Vector Store',
            name: 'falkorDbVectorStore',
            icon: 'file:falkordb.svg',
            group: ['transform'],
            version: 1,
            description: 'Use FalkorDB as a vector store for embeddings and similarity search',
            defaults: {
                name: 'FalkorDB Vector Store',
            },
            codex: {
                categories: ['AI'],
                subcategories: {
                    AI: ['Vector Stores'],
                },
                resources: {
                    primaryDocumentation: [
                        {
                            url: 'https://docs.falkordb.com/',
                        },
                    ],
                },
            },
            inputs: [],
            outputs: ["ai_vectorStore"],
            outputNames: ['Vector Store'],
            credentials: [
                {
                    name: 'falkorDbApi',
                    required: true,
                },
            ],
            properties: [
                (0, FalkorDbLangChain_1.getConnectionHintNoticeField)(["ai_agent"]),
                {
                    displayName: 'Graph Name',
                    name: 'graphName',
                    type: 'string',
                    required: true,
                    default: 'vectors',
                    description: 'Name of the FalkorDB graph to use',
                },
                {
                    displayName: 'Node Label',
                    name: 'nodeLabel',
                    type: 'string',
                    required: true,
                    default: 'Document',
                    description: 'Label for document nodes in the graph',
                },
                {
                    displayName: 'Dimensions',
                    name: 'dimensions',
                    type: 'number',
                    required: true,
                    default: 1536,
                    description: 'Number of dimensions for the vector embeddings',
                },
                metadataFilterField,
                {
                    displayName: 'Options',
                    name: 'options',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    options: [
                        {
                            displayName: 'Distance Metric',
                            name: 'distanceMetric',
                            type: 'options',
                            options: [
                                {
                                    name: 'Cosine',
                                    value: 'cosine',
                                },
                                {
                                    name: 'Euclidean',
                                    value: 'euclidean',
                                },
                                {
                                    name: 'Dot Product',
                                    value: 'dotproduct',
                                },
                            ],
                            default: 'cosine',
                            description: 'Distance metric to use for similarity search',
                        },
                        {
                            displayName: 'Similarity Threshold',
                            name: 'similarityThreshold',
                            type: 'number',
                            default: 0.7,
                            description: 'Minimum similarity score to include in results',
                        },
                        {
                            displayName: 'Top K',
                            name: 'topK',
                            type: 'number',
                            default: 10,
                            description: 'Number of top results to return',
                        },
                    ],
                },
            ],
        };
    }
    async supplyData(itemIndex) {
        try {
            this.logger.debug('FalkorDB Vector Store: Starting data supply', {
                itemIndex,
                nodeType: this.getNode().type,
                nodeName: this.getNode().name,
            });
            const credentials = await this.getCredentials('falkorDbApi');
            const graphName = this.getNodeParameter('graphName', itemIndex);
            const nodeLabel = this.getNodeParameter('nodeLabel', itemIndex);
            const dimensions = this.getNodeParameter('dimensions', itemIndex);
            const metadataFilter = this.getNodeParameter('metadataFilter', itemIndex, '');
            const options = this.getNodeParameter('options', itemIndex, {});
            this.logger.debug('FalkorDB Vector Store: Configuration loaded', {
                graphName,
                nodeLabel,
                dimensions,
                hasMetadataFilter: !!metadataFilter,
                options,
            });
            if (metadataFilter) {
                try {
                    JSON.parse(metadataFilter);
                    this.logger.debug('FalkorDB Vector Store: Metadata filter validated', {
                        metadataFilter,
                    });
                }
                catch (error) {
                    this.logger.error('FalkorDB Vector Store: Invalid metadata filter JSON', {
                        error: error.message,
                        stack: error.stack,
                        metadataFilter,
                        itemIndex,
                        nodeData: this.getNode(),
                    });
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid metadata filter JSON: ${error.message}`, { itemIndex });
                }
            }
            const vectorStore = new FalkorDbLangChain_1.FalkorDbVectorStore({
                graphName,
                nodeLabel,
                dimensions,
                credentials,
                distanceMetric: options['distanceMetric'] || 'cosine',
                similarityThreshold: options['similarityThreshold'] || 0.7,
                httpRequest: (options) => this.helpers.httpRequest(options),
                logger: this.logger,
            });
            this.logger.debug('FalkorDB Vector Store: Vector store instance created successfully', {
                graphName,
                nodeLabel,
                dimensions,
            });
            return {
                response: vectorStore,
            };
        }
        catch (error) {
            this.logger.error('FalkorDB Vector Store: Failed to supply data', {
                error: error.message,
                stack: error.stack,
                itemIndex,
                nodeData: this.getNode(),
                executionId: this.getExecutionId(),
            });
            throw error;
        }
    }
}
exports.FalkorDbVectorStore = FalkorDbVectorStore;
//# sourceMappingURL=FalkorDbVectorStore.node.js.map