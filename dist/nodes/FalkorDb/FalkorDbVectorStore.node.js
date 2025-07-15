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
                    displayName: 'Collection Name',
                    name: 'collectionName',
                    type: 'string',
                    required: true,
                    default: 'vectors',
                    description: 'Name of the collection to store vectors in',
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
        const credentials = await this.getCredentials('falkorDbApi');
        const collectionName = this.getNodeParameter('collectionName', itemIndex);
        const dimensions = this.getNodeParameter('dimensions', itemIndex);
        const metadataFilter = this.getNodeParameter('metadataFilter', itemIndex, '');
        const options = this.getNodeParameter('options', itemIndex, {});
        if (metadataFilter) {
            try {
                JSON.parse(metadataFilter);
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invalid metadata filter JSON: ${error.message}`, { itemIndex });
            }
        }
        const vectorStore = new FalkorDbLangChain_1.FalkorDbVectorStore({
            collectionName,
            dimensions,
            credentials,
            distanceMetric: options['distanceMetric'] || 'cosine',
            similarityThreshold: options['similarityThreshold'] || 0.7,
        });
        return {
            response: vectorStore,
        };
    }
}
exports.FalkorDbVectorStore = FalkorDbVectorStore;
//# sourceMappingURL=FalkorDbVectorStore.node.js.map