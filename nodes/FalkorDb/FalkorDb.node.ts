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
						name: 'Create',
						value: 'create',
						description: 'Create a new graph',
						action: 'Create a graph',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a graph',
						action: 'Delete a graph',
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
					{
						name: 'Explain',
						value: 'explain',
						description: 'Explain a query execution plan',
						action: 'Explain a query',
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
						name: 'Get',
						value: 'get',
						description: 'Get graph schema',
						action: 'Get schema',
					},
					{
						name: 'Create Index',
						value: 'createIndex',
						description: 'Create an index on a property',
						action: 'Create index',
					},
					{
						name: 'Drop Index',
						value: 'dropIndex',
						description: 'Drop an index',
						action: 'Drop index',
					},
				],
				default: 'get',
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
			// Graph Name for graph operations (create/delete)
			{
				displayName: 'Graph Name',
				name: 'graphName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the graph to create or delete',
				displayOptions: {
					show: {
						resource: ['graph'],
						operation: ['create', 'delete'],
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
						operation: ['execute', 'explain'],
					},
				},
			},
			// Query Parameters
			{
				displayName: 'Parameters',
				name: 'parameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: 'Parameters for the Cypher query',
				options: [
					{
						name: 'parameter',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Parameter name',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Parameter value',
							},
						],
					},
				],
				displayOptions: {
					show: {
						resource: ['query'],
						operation: ['execute', 'explain'],
					},
				},
			},
			// Index Properties
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				required: true,
				default: '',
				description: 'Node label for the index',
				displayOptions: {
					show: {
						resource: ['schema'],
						operation: ['createIndex', 'dropIndex'],
					},
				},
			},
			{
				displayName: 'Property',
				name: 'property',
				type: 'string',
				required: true,
				default: '',
				description: 'Property name for the index',
				displayOptions: {
					show: {
						resource: ['schema'],
						operation: ['createIndex', 'dropIndex'],
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
					{
						displayName: 'Read Only',
						name: 'readOnly',
						type: 'boolean',
						default: false,
						description: 'Whether to execute query in read-only mode',
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
						requestOptions.url = `${baseUrl}/api/graphs`;
						requestOptions.method = 'GET';
					} else if (operation === 'create') {
						const graphName = this.getNodeParameter('graphName', i) as string;
						requestOptions.url = `${baseUrl}/api/graph/${graphName}`;
						requestOptions.method = 'POST';
					} else if (operation === 'delete') {
						const graphName = this.getNodeParameter('graphName', i) as string;
						requestOptions.url = `${baseUrl}/api/graph/${graphName}`;
						requestOptions.method = 'DELETE';
					}
				} else if (resource === 'query') {
					const graphName = this.getNodeParameter('graphName', i) as string;
					const cypherQuery = this.getNodeParameter('cypherQuery', i) as string;
					const parameters = this.getNodeParameter('parameters', i, {}) as IDataObject;
					const readOnly = (additionalOptions['readOnly'] as boolean) || false;

					const queryParams: IDataObject = {
						query: cypherQuery,
					};

					if (parameters['parameter'] && Array.isArray(parameters['parameter'])) {
						const paramObj: IDataObject = {};
						for (const param of parameters['parameter'] as Array<{ name: string; value: string }>) {
							paramObj[param.name] = param.value;
						}
						queryParams['parameters'] = paramObj;
					}

					if (readOnly) {
						queryParams['readonly'] = true;
					}

					if (operation === 'execute') {
						requestOptions.url = `${baseUrl}/api/graph/${graphName}/query`;
						requestOptions.method = 'POST';
						requestOptions.body = queryParams;
					} else if (operation === 'explain') {
						requestOptions.url = `${baseUrl}/api/graph/${graphName}/explain`;
						requestOptions.method = 'POST';
						requestOptions.body = queryParams;
					}
				} else if (resource === 'schema') {
					const graphName = this.getNodeParameter('graphName', i) as string;

					if (operation === 'get') {
						requestOptions.url = `${baseUrl}/api/graph/${graphName}/schema`;
						requestOptions.method = 'GET';
					} else if (operation === 'createIndex') {
						const label = this.getNodeParameter('label', i) as string;
						const property = this.getNodeParameter('property', i) as string;

						requestOptions.url = `${baseUrl}/api/graph/${graphName}/index`;
						requestOptions.method = 'POST';
						requestOptions.body = {
							label,
							property,
						};
					} else if (operation === 'dropIndex') {
						const label = this.getNodeParameter('label', i) as string;
						const property = this.getNodeParameter('property', i) as string;

						requestOptions.url = `${baseUrl}/api/graph/${graphName}/index`;
						requestOptions.method = 'DELETE';
						requestOptions.body = {
							label,
							property,
						};
					}
				}

				const responseData = await this.helpers.httpRequest(requestOptions);

				const executionData: INodeExecutionData = {
					json: {
						...responseData,
						_metadata: {
							resource,
							operation,
							graphName:
								resource !== 'graph' || operation !== 'list'
									? this.getNodeParameter('graphName', i, '')
									: undefined,
							timestamp: new Date().toISOString(),
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
