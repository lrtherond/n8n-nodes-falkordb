import type {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
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

export class FalkorDbVectorStore implements INodeType {
	description: INodeTypeDescription = {
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
		outputs: [NodeConnectionType.AiVectorStore],
		outputNames: ['Vector Store'],
		credentials: [
			{
				name: 'falkorDbApi',
				required: true,
			},
		],
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiAgent]),
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

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('falkorDbApi');
		const collectionName = this.getNodeParameter('collectionName', itemIndex) as string;
		const dimensions = this.getNodeParameter('dimensions', itemIndex) as number;
		const metadataFilter = this.getNodeParameter('metadataFilter', itemIndex, '') as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

		if (metadataFilter) {
			try {
				JSON.parse(metadataFilter); // Validate JSON format
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid metadata filter JSON: ${(error as Error).message}`,
					{ itemIndex },
				);
			}
		}

		const vectorStore = new FalkorDbVectorStoreImpl({
			collectionName,
			dimensions,
			credentials,
			distanceMetric: (options['distanceMetric'] as string) || 'cosine',
			similarityThreshold: (options['similarityThreshold'] as number) || 0.7,
		});

		return {
			response: vectorStore,
		};
	}
}
