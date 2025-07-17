import type {
	ISupplyDataFunctions,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	SupplyData,
	IDataObject,
	INodeExecutionData,
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import {
	FalkorDbKnowledgeGraphStore,
	getConnectionHintNoticeField,
} from './FalkorDbLangChain';

export class FalkorDbVectorStore implements INodeType {
	description: INodeTypeDescription = {
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
				type: NodeConnectionType.AiLanguageModel,
				required: true,
			},
			{
				displayName: 'Main',
				type: NodeConnectionType.Main,
				required: false,
			},
		],
		outputs: [NodeConnectionType.AiVectorStore, NodeConnectionType.Main],
		outputNames: ['Knowledge Graph', 'Results'],
		credentials: [
			{
				name: 'falkorDbApi',
				required: true,
			},
		],
		properties: [
			getConnectionHintNoticeField(['ai_agent']),
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const credentials = await this.getCredentials('falkorDbApi');
				const graphName = this.getNodeParameter('graphName', itemIndex) as string;
				const inputText = String(items[itemIndex].json.text || items[itemIndex].json.input || JSON.stringify(items[itemIndex].json));

				// Get connected AI model
				const aiModel = await this.getInputConnectionData(NodeConnectionType.AiLanguageModel, itemIndex);
				if (!aiModel) {
					throw new NodeOperationError(this.getNode(), 'AI Language Model is required for entity extraction', { itemIndex });
				}

				this.logger.debug('FalkorDB Knowledge Graph: Processing item', {
					itemIndex,
					graphName,
					inputLength: inputText.length,
					hasAiModel: !!aiModel,
				});

				const knowledgeGraphStore = new FalkorDbKnowledgeGraphStore({
					graphName,
					credentials,
					aiModel,
					httpRequest: (options: any) => this.helpers.httpRequest(options),
					logger: this.logger,
				});

				// Process the input text
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
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							...items[itemIndex].json,
							error: (error as Error).message,
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

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		try {
			this.logger.debug('FalkorDB Vector Store: Starting data supply', {
				itemIndex,
				nodeType: this.getNode().type,
				nodeName: this.getNode().name,
			});

			const credentials = await this.getCredentials('falkorDbApi');
			const graphName = this.getNodeParameter('graphName', itemIndex) as string;

			this.logger.debug('FalkorDB Knowledge Graph Store: Configuration loaded', {
				graphName,
			});

			const knowledgeGraphStore = new FalkorDbKnowledgeGraphStore({
				graphName,
				credentials,
				httpRequest: (options: any) => this.helpers.httpRequest(options),
				logger: this.logger,
			});

			this.logger.debug('FalkorDB Knowledge Graph Store: Store instance created successfully', {
				graphName,
			});

			return {
				response: knowledgeGraphStore,
			};
		} catch (error) {
			this.logger.error('FalkorDB Vector Store: Failed to supply data', {
				error: (error as Error).message,
				stack: (error as Error).stack,
				itemIndex,
				nodeData: this.getNode(),
				executionId: this.getExecutionId(),
			});
			throw error;
		}
	}
}
