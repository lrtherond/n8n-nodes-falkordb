"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDb = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class FalkorDb {
    constructor() {
        this.description = {
            displayName: 'FalkorDB',
            name: 'falkorDb',
            group: ['database'],
            version: 1,
            icon: 'file:falkordb.svg',
            description: 'Interact with FalkorDB graph database',
            defaults: {
                name: 'FalkorDB',
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
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('falkorDbApi');
        const baseUrl = `${credentials['ssl'] ? 'https' : 'http'}://${credentials['host']}:${credentials['port']}`;
        for (let i = 0; i < items.length; i++) {
            try {
                const resource = this.getNodeParameter('resource', i);
                const operation = this.getNodeParameter('operation', i);
                const additionalOptions = this.getNodeParameter('additionalOptions', i, {});
                const requestOptions = {
                    method: 'GET',
                    url: '',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: additionalOptions['timeout'] || 30000,
                };
                if (credentials['username'] && credentials['password']) {
                    requestOptions.auth = {
                        username: credentials['username'],
                        password: credentials['password'],
                    };
                }
                if (resource === 'graph') {
                    if (operation === 'list') {
                        requestOptions.url = `${baseUrl}/api/graph`;
                        requestOptions.method = 'GET';
                    }
                    else if (operation === 'create') {
                        const graphName = this.getNodeParameter('graphName', i);
                        const createQuery = this.getNodeParameter('createQuery', i);
                        const encodedQuery = encodeURIComponent(createQuery);
                        requestOptions.url = `${baseUrl}/api/graph/${graphName}?query=${encodedQuery}`;
                        requestOptions.method = 'GET';
                    }
                    else if (operation === 'delete') {
                        const graphName = this.getNodeParameter('graphName', i);
                        requestOptions.url = `${baseUrl}/api/graph/${graphName}`;
                        requestOptions.method = 'DELETE';
                    }
                    else if (operation === 'count') {
                        const graphName = this.getNodeParameter('graphName', i);
                        requestOptions.url = `${baseUrl}/api/graph/${graphName}/count`;
                        requestOptions.method = 'GET';
                    }
                    else if (operation === 'duplicate') {
                        const sourceGraphName = this.getNodeParameter('sourceGraphName', i);
                        const destinationGraphName = this.getNodeParameter('destinationGraphName', i);
                        requestOptions.url = `${baseUrl}/api/graph/${destinationGraphName}?sourceName=${sourceGraphName}`;
                        requestOptions.method = 'POST';
                    }
                }
                else if (resource === 'query') {
                    const graphName = this.getNodeParameter('graphName', i);
                    const cypherQuery = this.getNodeParameter('cypherQuery', i);
                    if (operation === 'execute') {
                        const encodedQuery = encodeURIComponent(cypherQuery);
                        requestOptions.url = `${baseUrl}/api/graph/${graphName}?query=${encodedQuery}`;
                        requestOptions.method = 'GET';
                    }
                }
                else if (resource === 'schema') {
                    const graphName = this.getNodeParameter('graphName', i);
                    if (operation === 'query') {
                        const schemaQuery = this.getNodeParameter('schemaQuery', i);
                        const encodedQuery = encodeURIComponent(schemaQuery);
                        requestOptions.url = `${baseUrl}/api/graph/${graphName}?query=${encodedQuery}`;
                        requestOptions.method = 'GET';
                    }
                }
                const responseData = await this.helpers.httpRequest(requestOptions);
                let parsedResponse;
                let metadata = [];
                if (responseData && typeof responseData === 'object' && 'result' in responseData) {
                    const result = responseData.result;
                    parsedResponse = {
                        data: result.data || [],
                        queryMetadata: result.metadata || [],
                    };
                    metadata = result.metadata || [];
                }
                else {
                    parsedResponse = responseData;
                }
                const executionData = {
                    json: {
                        ...parsedResponse,
                        _metadata: {
                            resource,
                            operation,
                            graphName: resource !== 'graph' || operation !== 'list'
                                ? this.getNodeParameter('graphName', i, '')
                                : undefined,
                            sourceGraphName: resource === 'graph' && operation === 'duplicate'
                                ? this.getNodeParameter('sourceGraphName', i, '')
                                : undefined,
                            destinationGraphName: resource === 'graph' && operation === 'duplicate'
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
            }
            catch (error) {
                if (this.continueOnFail()) {
                    const executionData = {
                        json: {
                            error: error.message,
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
                }
                else {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `FalkorDB operation failed: ${error.message}`, {
                        itemIndex: i,
                        description: error['description'] ||
                            'Check your FalkorDB connection and query syntax',
                    });
                }
            }
        }
        return [returnData];
    }
}
exports.FalkorDb = FalkorDb;
//# sourceMappingURL=FalkorDb.node.js.map