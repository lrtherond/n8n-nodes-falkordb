"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbVectorStore = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const FalkorDbLangChain_1 = require("./FalkorDbLangChain");
class FalkorDbVectorStore {
    constructor() {
        this.description = {
            displayName: 'FalkorDB Knowledge Graph',
            name: 'falkorDbKnowledgeGraph',
            icon: 'file:falkordb.svg',
            group: ['transform'],
            version: 1,
            description: 'Use FalkorDB to build knowledge graphs from conversations with entity and relationship extraction',
            defaults: {
                name: 'FalkorDB Knowledge Graph',
            },
            codex: {
                categories: ['AI'],
                subcategories: {
                    AI: ['Knowledge Graphs'],
                },
                resources: {
                    primaryDocumentation: [
                        {
                            url: 'https://docs.falkordb.com/',
                        },
                    ],
                },
            },
            inputs: [
                {
                    displayName: 'AI Language Model',
                    type: "ai_languageModel",
                    required: true,
                },
                {
                    displayName: 'Main',
                    type: "main",
                    required: false,
                },
            ],
            outputs: ["ai_vectorStore", "main"],
            outputNames: ['Knowledge Graph', 'Results'],
            credentials: [
                {
                    name: 'falkorDbApi',
                    required: true,
                },
            ],
            properties: [
                (0, FalkorDbLangChain_1.getConnectionHintNoticeField)(['ai_agent']),
                {
                    displayName: 'Graph Name',
                    name: 'graphName',
                    type: 'string',
                    required: true,
                    default: 'memory',
                    description: 'Name of the FalkorDB graph to use for vector storage',
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const credentials = await this.getCredentials('falkorDbApi');
                const graphName = this.getNodeParameter('graphName', itemIndex);
                const inputText = String(items[itemIndex].json.text || items[itemIndex].json.input || JSON.stringify(items[itemIndex].json));
                const aiModel = await this.getInputConnectionData("ai_languageModel", itemIndex);
                if (!aiModel) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'AI Language Model is required for entity extraction', { itemIndex });
                }
                this.logger.debug('FalkorDB Knowledge Graph: Processing item', {
                    itemIndex,
                    graphName,
                    inputLength: inputText.length,
                    hasAiModel: !!aiModel,
                });
                const knowledgeGraphStore = new FalkorDbLangChain_1.FalkorDbKnowledgeGraphStore({
                    graphName,
                    credentials,
                    aiModel,
                    httpRequest: (options) => this.helpers.httpRequest(options),
                    logger: this.logger,
                });
                const result = await knowledgeGraphStore.enrichFromMessage(inputText);
                const context = await knowledgeGraphStore.getContextForMessage(inputText);
                returnData.push({
                    json: {
                        ...items[itemIndex].json,
                        entities_extracted: result.entities,
                        relationships_extracted: result.relationships,
                        context_found: context,
                        graph_name: graphName,
                        processed_at: new Date().toISOString(),
                    },
                    pairedItem: { item: itemIndex },
                });
                this.logger.debug('FalkorDB Knowledge Graph: Item processed successfully', {
                    itemIndex,
                    entitiesExtracted: result.entities,
                    relationshipsExtracted: result.relationships,
                    contextItems: context.length,
                });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            ...items[itemIndex].json,
                            error: error.message,
                            processed_at: new Date().toISOString(),
                        },
                        pairedItem: { item: itemIndex },
                    });
                    continue;
                }
                throw error;
            }
        }
        return [returnData];
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
            this.logger.debug('FalkorDB Knowledge Graph Store: Configuration loaded', {
                graphName,
            });
            const knowledgeGraphStore = new FalkorDbLangChain_1.FalkorDbKnowledgeGraphStore({
                graphName,
                credentials,
                httpRequest: (options) => this.helpers.httpRequest(options),
                logger: this.logger,
            });
            this.logger.debug('FalkorDB Knowledge Graph Store: Store instance created successfully', {
                graphName,
            });
            return {
                response: knowledgeGraphStore,
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
//# sourceMappingURL=FalkorDbKnowledgeGraph.node.js.map