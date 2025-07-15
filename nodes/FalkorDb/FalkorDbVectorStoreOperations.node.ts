import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	ISupplyDataFunctions,
	SupplyData,
	IDataObject,
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import {
	FalkorDbVectorStore as FalkorDbVectorStoreImpl,
	getConnectionHintNoticeField,
} from './FalkorDbLangChain';

// Metadata filter field for vector search
const metadataFilterField: INodeProperties = {
	displayName: 'Metadata Filter',
	name: 'metadataFilter',
	type: 'string',
	default: '',
	description: 'JSON filter for metadata (e.g., {"source": "doc1"})',
	placeholder: '{"key": "value"}',
};

// Unified Vector Store Operations Node (similar to Zep's approach)
export class FalkorDbVectorStoreOperations implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FalkorDB Vector Store Operations',
		name: 'falkorDbVectorStoreOperations',
		icon: 'file:falkordb.svg',
		group: ['transform'],
		version: 1,
		description: 'Perform operations on FalkorDB vector store',
		defaults: {
			name: 'FalkorDB Vector Store Operations',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
			// Insert operation fields
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
			// Retrieve operation fields
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
			// Delete operation fields
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const operation = this.getNodeParameter('operation', 0) as string;
		const collectionName = this.getNodeParameter('collectionName', 0) as string;
		const credentials = await this.getCredentials('falkorDbApi');

		const vectorStore = new FalkorDbVectorStoreImpl({
			collectionName,
			dimensions: 1536, // Default dimensions
			credentials,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				let result: IDataObject = {};

				if (operation === 'insert') {
					const documentContent = this.getNodeParameter('documentContent', i) as string;
					const metadata = this.getNodeParameter('metadata', i, '{}') as string;

					let parsedMetadata: IDataObject = {};
					try {
						parsedMetadata = JSON.parse(metadata);
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid metadata JSON: ${(error as Error).message}`,
							{ itemIndex: i },
						);
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
				} else if (operation === 'retrieve') {
					const queryText = this.getNodeParameter('queryText', i) as string;
					const topK = this.getNodeParameter('topK', i) as number;
					const metadataFilter = this.getNodeParameter('metadataFilter', i, '') as string;

					let parsedFilter: IDataObject | undefined;
					if (metadataFilter) {
						try {
							parsedFilter = JSON.parse(metadataFilter);
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid metadata filter JSON: ${(error as Error).message}`,
								{ itemIndex: i },
							);
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
				} else if (operation === 'delete') {
					const documentIds = this.getNodeParameter('documentIds', i) as string;
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
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
							operation,
							collectionName,
						},
						pairedItem: {
							item: i,
						},
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}
