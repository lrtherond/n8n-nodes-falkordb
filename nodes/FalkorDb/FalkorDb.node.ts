import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	IDataObject,
} from 'n8n-workflow';

import { NodeOperationError, NodeConnectionType } from 'n8n-workflow';

export class FalkorDb implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FalkorDB',
		name: 'falkorDb',
		group: ['database'],
		version: 1,
		icon: 'file:falkordb.svg',
		description: 'Interact with FalkorDB graph database',
		defaults: {
			name: 'FalkorDB',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Graph',
						value: 'graph',
					},
					{
						name: 'Query',
						value: 'query',
					},
					{
						name: 'Schema',
						value: 'schema',
					},
				],
				default: 'query',
				description: 'The resource to perform operations on',
			},
			// Graph Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['graph'],
					},
				},
				options: [
					{
						name: 'Count',
						value: 'count',
						description: 'Get graph node count',
						action: 'Get graph count',
					},
					{
						name: 'Create & Execute Query',
						value: 'create',
						description: 'Create a graph and execute a query',
						action: 'Create graph and execute query',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a graph',
						action: 'Delete a graph',
					},
					{
						name: 'Duplicate',
						value: 'duplicate',
						description: 'Duplicate a graph',
						action: 'Duplicate a graph',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List all graphs',
						action: 'List graphs',
					},
				],
				default: 'list',
			},
			// Query Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['query'],
					},
				},
				options: [
					{
						name: 'Execute',
						value: 'execute',
						description: 'Execute a Cypher query',
						action: 'Execute a query',
					},
				],
				default: 'execute',
			},
			// Schema Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['schema'],
					},
				},
				options: [
					{
						name: 'Query',
						value: 'query',
						description: 'Execute a Cypher query against schema',
						action: 'Query schema',
					},
				],
				default: 'query',
			},
			// Graph Name (for all operations)
			{
				displayName: 'Graph Name',
				name: 'graphName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the graph to operate on',
				displayOptions: {
					hide: {
						resource: ['graph'],
						operation: ['list'],
					},
				},
			},
			// Graph Name for graph operations (create/delete/count)
			{
				displayName: 'Graph Name',
				name: 'graphName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the graph to operate on',
				displayOptions: {
					show: {
						resource: ['graph'],
						operation: ['create', 'delete', 'count'],
					},
				},
			},
			// Query for graph creation
			{
				displayName: 'Cypher Query',
				name: 'createQuery',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				required: true,
				default: 'RETURN 1',
				description: 'Cypher query to execute when creating the graph',
				displayOptions: {
					show: {
						resource: ['graph'],
						operation: ['create'],
					},
				},
			},
			// Source Graph Name for duplicate operation
			{
				displayName: 'Source Graph Name',
				name: 'sourceGraphName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the source graph to duplicate',
				displayOptions: {
					show: {
						resource: ['graph'],
						operation: ['duplicate'],
					},
				},
			},
			// Destination Graph Name for duplicate operation
			{
				displayName: 'Destination Graph Name',
				name: 'destinationGraphName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the destination graph',
				displayOptions: {
					show: {
						resource: ['graph'],
						operation: ['duplicate'],
					},
				},
			},
			// Cypher Query
			{
				displayName: 'Cypher Query',
				name: 'cypherQuery',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				required: true,
				default: '',
				description: 'Cypher query to execute',
				displayOptions: {
					show: {
						resource: ['query'],
						operation: ['execute'],
					},
				},
			},
			// Schema Query
			{
				displayName: 'Cypher Query',
				name: 'schemaQuery',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				required: true,
				default: '',
				description: 'Cypher query to execute against schema',
				displayOptions: {
					show: {
						resource: ['schema'],
						operation: ['query'],
					},
				},
			},
			// Additional Options
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Request timeout in milliseconds',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('falkorDbApi');
		const baseUrl = `${credentials['ssl'] ? 'https' : 'http'}://${credentials['host']}:${credentials['port']}`;

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;

				const requestOptions: IHttpRequestOptions = {
					method: 'GET',
					url: '',
					headers: {
						'Content-Type': 'application/json',
					},
					timeout: (additionalOptions['timeout'] as number) || 30000,
				};

				if (credentials['username'] && credentials['password']) {
					requestOptions.auth = {
						username: credentials['username'] as string,
						password: credentials['password'] as string,
					};
				}

				if (resource === 'graph') {
					if (operation === 'list') {
						requestOptions.url = `${baseUrl}/api/graph`;
						requestOptions.method = 'GET';
					} else if (operation === 'create') {
						const graphName = this.getNodeParameter('graphName', i) as string;
						const createQuery = this.getNodeParameter('createQuery', i) as string;
						const encodedQuery = encodeURIComponent(createQuery);
						requestOptions.url = `${baseUrl}/api/graph/${graphName}?query=${encodedQuery}`;
						requestOptions.method = 'GET';
					} else if (operation === 'delete') {
						const graphName = this.getNodeParameter('graphName', i) as string;
						requestOptions.url = `${baseUrl}/api/graph/${graphName}`;
						requestOptions.method = 'DELETE';
					} else if (operation === 'count') {
						const graphName = this.getNodeParameter('graphName', i) as string;
						requestOptions.url = `${baseUrl}/api/graph/${graphName}/count`;
						requestOptions.method = 'GET';
					} else if (operation === 'duplicate') {
						const sourceGraphName = this.getNodeParameter('sourceGraphName', i) as string;
						const destinationGraphName = this.getNodeParameter('destinationGraphName', i) as string;
						requestOptions.url = `${baseUrl}/api/graph/${destinationGraphName}?sourceName=${sourceGraphName}`;
						requestOptions.method = 'POST';
					}
				} else if (resource === 'query') {
					const graphName = this.getNodeParameter('graphName', i) as string;
					const cypherQuery = this.getNodeParameter('cypherQuery', i) as string;

					if (operation === 'execute') {
						const encodedQuery = encodeURIComponent(cypherQuery);
						requestOptions.url = `${baseUrl}/api/graph/${graphName}?query=${encodedQuery}`;
						requestOptions.method = 'GET';
					}
				} else if (resource === 'schema') {
					const graphName = this.getNodeParameter('graphName', i) as string;

					if (operation === 'query') {
						const schemaQuery = this.getNodeParameter('schemaQuery', i) as string;
						const encodedQuery = encodeURIComponent(schemaQuery);
						requestOptions.url = `${baseUrl}/api/graph/${graphName}?query=${encodedQuery}`;
						requestOptions.method = 'GET';
					}
				}

				const responseData = await this.helpers.httpRequest(requestOptions);

				// Parse FalkorDB response format
				let parsedResponse: IDataObject;
				let metadata: string[] = [];

				if (responseData && typeof responseData === 'object' && 'result' in responseData) {
					// FalkorDB format: { result: { metadata: [...], data: [...] } }
					const result = responseData.result as IDataObject;
					parsedResponse = {
						data: result.data || [],
						queryMetadata: result.metadata || [],
					};
					metadata = (result.metadata as string[]) || [];
				} else {
					// Fallback for other responses (graph management, etc.)
					parsedResponse = responseData as IDataObject;
				}

				const executionData: INodeExecutionData = {
					json: {
						...parsedResponse,
						_metadata: {
							resource,
							operation,
							graphName:
								resource !== 'graph' || operation !== 'list'
									? this.getNodeParameter('graphName', i, '')
									: undefined,
							sourceGraphName:
								resource === 'graph' && operation === 'duplicate'
									? this.getNodeParameter('sourceGraphName', i, '')
									: undefined,
							destinationGraphName:
								resource === 'graph' && operation === 'duplicate'
									? this.getNodeParameter('destinationGraphName', i, '')
									: undefined,
							timestamp: new Date().toISOString(),
							queryMetadata: metadata,
						},
					},
					pairedItem: {
						item: i,
					},
				};

				returnData.push(executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData: INodeExecutionData = {
						json: {
							error: (error as Error).message,
							_metadata: {
								resource: this.getNodeParameter('resource', i),
								operation: this.getNodeParameter('operation', i),
								timestamp: new Date().toISOString(),
							},
						},
						pairedItem: {
							item: i,
						},
					};
					returnData.push(executionData);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`FalkorDB operation failed: ${(error as Error).message}`,
						{
							itemIndex: i,
							description:
								((error as IDataObject)['description'] as string) ||
								'Check your FalkorDB connection and query syntax',
						},
					);
				}
			}
		}

		return [returnData];
	}
}
