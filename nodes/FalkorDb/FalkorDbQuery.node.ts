import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type {
	ICredentialTestFunction,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName } from 'n8n-workflow';
import { z } from 'zod';
import { connectFalkorDb } from './FalkorDbClient';
import { FalkorDbQueryEngine, FalkorDbRetriever } from './FalkorDbQuery';

const falkorDbConnectionTest: ICredentialTestFunction = async function (credentials) {
	try {
		const client = await connectFalkorDb(credentials.data);
		try {
			await client.list();
		} finally {
			await client.close();
		}
		return { status: 'OK', message: 'Connected to FalkorDB successfully' };
	} catch (error) {
		return { status: 'Error', message: error instanceof Error ? error.message : String(error) };
	}
};

const settingsSchema = z.object({
	graphName: z.string().trim().min(1, 'Graph Name is required'),
	schema: z.string().trim().min(1, 'Schema is required'),
	retrievalGuidance: z.string().trim().default(''),
	limit: z.number().int().min(1).max(1000),
	timeout: z.number().int().min(1).max(60000),
});

async function createEngine(context: IExecuteFunctions | ISupplyDataFunctions, itemIndex: number) {
	const settings = settingsSchema.parse({
		graphName: context.getNodeParameter('graphName', itemIndex),
		schema: context.getNodeParameter('schema', itemIndex),
		retrievalGuidance: context.getNodeParameter('retrievalGuidance', itemIndex, ''),
		limit: context.getNodeParameter('limit', itemIndex),
		timeout: context.getNodeParameter('timeout', itemIndex),
	});
	const model = (await context.getInputConnectionData(
		NodeConnectionTypes.AiLanguageModel,
		itemIndex,
	)) as BaseChatModel | undefined;
	if (!model || typeof model.invoke !== 'function')
		throw new NodeOperationError(context.getNode(), 'Connect a Chat Model to generate Cypher');
	const client = await connectFalkorDb(await context.getCredentials('falkorDbApi'));
	try {
		const graph = client.selectGraph(settings.graphName);
		// Check access without creating a graph or using the supplied schema as DDL.
		await graph.roQuery('RETURN 1', { TIMEOUT: settings.timeout });
		return {
			engine: new FalkorDbQueryEngine({ ...settings, graph, model }),
			close: async () => await client.close(),
		};
	} catch (error) {
		await client.close();
		throw new NodeOperationError(
			context.getNode(),
			error instanceof Error ? error : new Error(String(error)),
		);
	}
}

export class FalkorDbQuery implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FalkorDB Graph Query',
		name: 'falkorDbQuery',
		icon: { light: 'file:graph-query.png', dark: 'file:graph-query.png' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["graphName"]}}',
		description: 'Generate Cypher from your schema and query a FalkorDB graph',
		defaults: { name: 'FalkorDB Graph Query' },
		usableAsTool: true,
		codex: {
			categories: ['AI'],
			subcategories: { AI: ['Tools', 'Retrievers'] },
			resources: {
				primaryDocumentation: [{ url: 'https://github.com/lrtherond/n8n-nodes-falkordb' }],
			},
		},
		inputs:
			'={{ $parameter.mode === "query" ? ["main", {type: "ai_languageModel", displayName: "Chat Model", required: true, maxConnections: 1}] : [{type: "ai_languageModel", displayName: "Chat Model", required: true, maxConnections: 1}] }}',
		outputs:
			'={{ $parameter.mode === "tool" ? ["ai_tool"] : $parameter.mode === "retriever" ? ["ai_retriever"] : ["main"] }}',
		credentials: [{ name: 'falkorDbApi', required: true, testedBy: 'falkorDbConnectionTest' }],
		properties: [
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				default: 'query',
				options: [
					{
						name: 'Query',
						value: 'query',
						description: 'Ask a question and return database results',
					},
					{
						name: 'Retriever for Chain',
						value: 'retriever',
						description: 'Supply graph context to a question and answer chain',
					},
					{
						name: 'Tool for AI Agent',
						value: 'tool',
						description: 'Let an agent ask questions of the graph',
					},
				],
			},
			{
				displayName: 'Graph Name',
				name: 'graphName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the existing FalkorDB graph to query',
			},
			{
				displayName: 'Schema',
				name: 'schema',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 10 },
				description:
					'Your graph definition: labels, properties, relationship directions, and indexes, as YAML, JSON, or plain text. Sent to the connected Chat Model.',
			},
			{
				displayName: 'Retrieval Guidance',
				name: 'retrievalGuidance',
				type: 'string',
				default: '',
				typeOptions: { rows: 6 },
				description:
					'Optional search strategy, ranking rules, fields to return, and example queries. Sent to the connected Chat Model separately from the schema.',
			},
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				required: true,
				default: '={{ $json.chatInput }}',
				typeOptions: { rows: 3 },
				displayOptions: { show: { mode: ['query'] } },
				description: 'Natural-language question to answer using the supplied graph schema',
			},
			{
				displayName: 'Tool Description',
				name: 'toolDescription',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 3 },
				displayOptions: { show: { mode: ['tool'] } },
				description: 'Describe what this graph contains and when the agent should query it',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit -- Ten rows is a conservative default for model context.
				default: 10,
				typeOptions: { minValue: 1, maxValue: 1000, numberPrecision: 0 },
				description: 'Max number of results to return',
			},
			{
				displayName: 'Query Timeout (Milliseconds)',
				name: 'timeout',
				type: 'number',
				default: 10000,
				typeOptions: { minValue: 1, maxValue: 60000, numberPrecision: 0 },
				description: 'Maximum time for FalkorDB to execute each query, in milliseconds',
			},
		],
	};
	methods = { credentialTest: { falkorDbConnectionTest } };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		const items = this.getInputData();
		const isTool = this.getNodeParameter('mode', 0) === 'tool';
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Current n8n Agents schedule tools through execute() with their arguments as input.
				const question = z
					.string()
					.trim()
					.min(1, 'Question is required')
					.parse(
						isTool ? items[itemIndex].json.question : this.getNodeParameter('question', itemIndex),
					);
				const { engine, close } = await createEngine(this, isTool ? 0 : itemIndex);
				try {
					output.push({
						json: { ...(await engine.query(question)) },
						pairedItem: { item: itemIndex },
					});
				} finally {
					await close();
				}
			} catch (error) {
				if (this.continueOnFail()) {
					output.push({
						json: { error: error instanceof Error ? error.message : String(error) },
						pairedItem: { item: itemIndex },
					});
				} else {
					throw new NodeOperationError(
						this.getNode(),
						error instanceof Error ? error : new Error(String(error)),
						{ itemIndex },
					);
				}
			}
		}
		return [output];
	}

	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		try {
			// n8n sub-node expressions resolve against the first input item.
			const mode = this.getNodeParameter('mode', 0);
			if (mode !== 'tool' && mode !== 'retriever')
				throw new NodeOperationError(
					this.getNode(),
					'Choose Retriever for Chain or Tool for AI Agent mode',
				);
			const description =
				mode === 'tool'
					? z
							.string()
							.trim()
							.min(1, 'Tool Description is required')
							.parse(this.getNodeParameter('toolDescription', 0))
					: '';
			const { engine, close } = await createEngine(this, 0);
			try {
				const response =
					mode === 'retriever'
						? new FalkorDbRetriever({
								query: async (question, config) => {
									const { index } = this.addInputData(NodeConnectionTypes.AiRetriever, [
										[{ json: { query: question } }],
									]);
									try {
										const result = await engine.query(question, config);
										this.addOutputData(NodeConnectionTypes.AiRetriever, index, [
											[{ json: { ...result } }],
										]);
										return result;
									} catch (error) {
										const nodeError = new NodeOperationError(
											this.getNode(),
											error instanceof Error ? error : new Error(String(error)),
											{ functionality: 'configuration-node' },
										);
										this.addOutputData(NodeConnectionTypes.AiRetriever, index, nodeError);
										throw nodeError;
									}
								},
							})
						: new DynamicStructuredTool({
								name: nodeNameToToolName(this.getNode()),
								description,
								// n8n normalizes foreign Zod instances as JSON Schema. Cross the package
								// boundary with plain JSON so the required argument survives normalization.
								schema: {
									type: 'object',
									properties: {
										question: {
											type: 'string',
											minLength: 1,
											description: 'Natural-language question about the graph',
										},
									},
									required: ['question'],
									additionalProperties: false,
								},
								func: async (input, runManager) => {
									const { question } = z
										.object({ question: z.string().trim().min(1) })
										.parse(input);
									return JSON.stringify(
										await engine.query(question, { callbacks: runManager?.getChild() }),
									);
								},
							});
				return { response, closeFunction: close };
			} catch (error) {
				await close();
				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error : new Error(String(error)),
				);
			}
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}
}
