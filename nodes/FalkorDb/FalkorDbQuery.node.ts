import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import type {
	FromAIArgument,
	ICredentialTestFunction,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import {
	FROM_AI_AUTO_GENERATED_MARKER,
	NodeConnectionTypes,
	NodeOperationError,
	generateZodSchema,
	nodeNameToToolName,
	traverseNodeParameters,
} from 'n8n-workflow';
import { z } from 'zod';
import { connectFalkorDb } from './FalkorDbClient';
import { FalkorDbQueryEngine, FalkorDbRetriever } from './FalkorDbQuery';

const defaultToolQuestion = `={{ ${FROM_AI_AUTO_GENERATED_MARKER} $fromAI('question', 'Natural-language question about the graph', 'string') }}`;

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
				displayName: 'Question',
				name: 'toolQuestion',
				type: 'string',
				required: true,
				default: defaultToolQuestion,
				typeOptions: { rows: 3 },
				displayOptions: { show: { mode: ['tool'] } },
				description:
					'Question to ask the graph. Let the agent supply it with From AI, or use a fixed value or expression.',
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
						isTool
							? this.getNodeParameter('toolQuestion', itemIndex, items[itemIndex].json.question)
							: this.getNodeParameter('question', itemIndex),
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
			if (mode === 'tool') {
				const description = z
					.string()
					.trim()
					.min(1, 'Tool Description is required')
					.parse(this.getNodeParameter('toolDescription', 0));
				const parameters = this.getNode().parameters;
				const argumentsFromAI: FromAIArgument[] = [];
				traverseNodeParameters(
					{
						...Object.fromEntries(
							['graphName', 'schema', 'retrievalGuidance', 'limit', 'timeout'].map((name) => [
								name,
								parameters[name],
							]),
						),
						toolQuestion: parameters.toolQuestion ?? defaultToolQuestion,
					},
					argumentsFromAI,
				);
				const argumentsByKey = new Map<string, FromAIArgument>();
				for (const argument of argumentsFromAI) {
					z.string()
						.regex(/^[a-zA-Z0-9_-]{1,64}$/, 'Invalid From AI parameter key')
						.refine((key) => !['__proto__', 'constructor', 'prototype'].includes(key))
						.parse(argument.key);
					const previous = argumentsByKey.get(argument.key);
					if (previous && JSON.stringify(previous) !== JSON.stringify(argument))
						throw new NodeOperationError(
							this.getNode(),
							`From AI parameter '${argument.key}' has conflicting definitions`,
						);
					argumentsByKey.set(argument.key, argument);
				}
				const inputSchema = z
					.object(
						Object.fromEntries(
							[...argumentsByKey].map(([key, argument]) => [key, generateZodSchema(argument)]),
						),
					)
					.strict()
					.required();
				let runIndex = this.getNextRunIndex();
				return {
					response: new DynamicStructuredTool({
						name: nodeNameToToolName(this.getNode()),
						description,
						// Cross the package boundary with JSON Schema, not a foreign Zod instance.
						schema: toJsonSchema(inputSchema),
						func: async (input: IDataObject, runManager) => {
							const index = runIndex++;
							// n8n's per-call context records input and resolves From AI expressions.
							const context = this.cloneWith({ runIndex: index, inputData: [[{ json: input }]] });
							try {
								inputSchema.parse(input);
								const question = z
									.string()
									.trim()
									.min(1, 'Question is required')
									.parse(context.getNodeParameter('toolQuestion', 0, input.question));
								const { engine, close } = await createEngine(context, 0);
								try {
									const result = await engine.query(question, {
										callbacks: runManager?.getChild(),
									});
									const response = JSON.stringify(result);
									context.addOutputData(NodeConnectionTypes.AiTool, index, [
										[{ json: { ...result } }],
									]);
									return response;
								} finally {
									await close();
								}
							} catch (error) {
								const nodeError = new NodeOperationError(
									context.getNode(),
									error instanceof Error ? error : new Error(String(error)),
									{ functionality: 'configuration-node' },
								);
								context.addOutputData(NodeConnectionTypes.AiTool, index, nodeError);
								throw nodeError;
							}
						},
					}),
				};
			}
			const { engine, close } = await createEngine(this, 0);
			try {
				const response = new FalkorDbRetriever({
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
