import { AIMessage } from '@langchain/core/messages';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectFalkorDb } from '../nodes/FalkorDb/FalkorDbClient';
import { FalkorDbQuery } from '../nodes/FalkorDb/FalkorDbQuery.node';
import type { FalkorDbRetriever } from '../nodes/FalkorDb/FalkorDbQuery';

vi.mock('../nodes/FalkorDb/FalkorDbClient', () => ({ connectFalkorDb: vi.fn() }));

function fixture(items: Record<string, unknown>[] = [{}]) {
	const graph = {
		roQuery: vi.fn().mockResolvedValue({ data: [{ text: 'Apollo', citation: 'P1' }] }),
	};
	const client = {
		selectGraph: vi.fn().mockReturnValue(graph),
		close: vi.fn().mockResolvedValue(undefined),
	};
	vi.mocked(connectFalkorDb).mockResolvedValue(
		client as unknown as Awaited<ReturnType<typeof connectFalkorDb>>,
	);
	const model = {
		invoke: vi.fn().mockResolvedValue(
			new AIMessage(
				JSON.stringify({
					cypher: 'MATCH (p:Project) RETURN p.title AS text LIMIT $limit',
					parameters: { limit: 10 },
				}),
			),
		),
	};
	const context = {
		getNodeParameter: vi.fn(
			(name: string, itemIndex: number) =>
				({
					mode: 'query',
					graphName: 'projects',
					schema: '(Project {title: STRING})',
					question: 'Find projects',
					limit: 10,
					timeout: 10000,
					toolDescription: 'Find company projects',
					...items[itemIndex],
				})[name],
		),
		getInputData: () => items.map(() => ({ json: {} })),
		getInputConnectionData: vi.fn().mockResolvedValue(model),
		getCredentials: vi.fn().mockResolvedValue({ host: 'localhost', port: 6379 }),
		getNode: () => ({
			id: 'query-node',
			name: 'Project Search',
			type: 'falkorDbQuery',
			typeVersion: 1,
		}),
		continueOnFail: vi.fn().mockReturnValue(false),
		addInputData: vi.fn().mockReturnValue({ index: 7 }),
		addOutputData: vi.fn(),
	};
	return {
		context,
		executeContext: context as unknown as IExecuteFunctions,
		supplyContext: context as unknown as ISupplyDataFunctions,
		model,
		graph,
		client,
	};
}

beforeEach(() => vi.clearAllMocks());

describe('Graph Query n8n node', () => {
	it('requires an expression-capable schema with no built-in domain', () => {
		const description = new FalkorDbQuery().description;
		expect(description.displayName).toBe('FalkorDB Graph Query');
		expect(description.defaults.name).toBe('FalkorDB Graph Query');
		const property = description.properties.find((p) => p.name === 'schema');
		expect(property).toMatchObject({ type: 'string', required: true, default: '' });
		expect(property?.noDataExpression).not.toBe(true);
	});

	it('offers separate optional retrieval guidance supporting expressions', () => {
		const property = new FalkorDbQuery().description.properties.find(
			(p) => p.name === 'retrievalGuidance',
		);
		expect(property).toMatchObject({ type: 'string', default: '' });
		expect(property?.required).not.toBe(true);
		expect(property?.noDataExpression).not.toBe(true);
	});

	it('resolves each main input separately and closes each connection', async () => {
		const { executeContext, model, client } = fixture([
			{
				schema: '(Project {title: STRING})',
				retrievalGuidance: 'Return project titles.',
				question: 'Find projects',
			},
			{
				schema: '(Book {isbn: STRING})',
				retrievalGuidance: 'Return ISBNs.',
				question: 'Find books',
				graphName: 'library',
			},
		]);
		const [output] = await new FalkorDbQuery().execute.call(executeContext);
		expect(output.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(model.invoke.mock.calls.map((call) => JSON.parse(call[0][1].text))).toEqual([
			{
				schema: '(Project {title: STRING})',
				retrievalGuidance: 'Return project titles.',
				question: 'Find projects',
				limit: 10,
			},
			{
				schema: '(Book {isbn: STRING})',
				retrievalGuidance: 'Return ISBNs.',
				question: 'Find books',
				limit: 10,
			},
		]);
		expect(client.selectGraph.mock.calls).toEqual([['projects'], ['library']]);
		expect(client.close).toHaveBeenCalledTimes(2);
		expect(output[0].json.rows).toEqual([{ text: 'Apollo', citation: 'P1' }]);
	});

	it.each([
		{ schema: ' ' },
		{ retrievalGuidance: { invalid: 'not text' } },
		{ graphName: '' },
		{ question: '' },
		{ limit: 0 },
		{ timeout: 60001 },
	])('rejects invalid settings before connecting: %j', async (parameters) => {
		const { executeContext } = fixture([parameters]);
		await expect(new FalkorDbQuery().execute.call(executeContext)).rejects.toThrow();
		expect(connectFalkorDb).not.toHaveBeenCalled();
	});

	it.each([undefined, '', '   '])(
		'accepts omitted or blank retrieval guidance: %j',
		async (retrievalGuidance) => {
			const { executeContext, model } = fixture([{ retrievalGuidance }]);
			await new FalkorDbQuery().execute.call(executeContext);
			expect(JSON.parse(model.invoke.mock.calls[0][0][1].text).retrievalGuidance).toBe('');
		},
	);

	it('requires a connected model', async () => {
		const { executeContext, context } = fixture();
		context.getInputConnectionData.mockResolvedValue(undefined);
		await expect(new FalkorDbQuery().execute.call(executeContext)).rejects.toThrow(
			'Connect a Chat Model',
		);
		expect(connectFalkorDb).not.toHaveBeenCalled();
	});

	it.each([
		new Error('Invalid graph operation on empty key'),
		'Invalid graph operation on empty key',
	])('checks existing graph access read-only and closes on failure: %s', async (error) => {
		const { executeContext, graph, client, model } = fixture();
		graph.roQuery.mockRejectedValue(error);
		await expect(new FalkorDbQuery().execute.call(executeContext)).rejects.toThrow('empty key');
		expect(graph.roQuery).toHaveBeenCalledWith('RETURN 1', { TIMEOUT: 10000 });
		expect(client.close).toHaveBeenCalledTimes(1);
		expect(model.invoke).not.toHaveBeenCalled();
	});

	it.each([new Error('Model unavailable'), 'Model unavailable'])(
		'closes on generation and execution failures, including continue-on-fail: %s',
		async (error) => {
			const { executeContext, context, graph, model, client } = fixture();
			model.invoke.mockRejectedValueOnce(error);
			await expect(new FalkorDbQuery().execute.call(executeContext)).rejects.toThrow(
				'Model unavailable',
			);
			expect(client.close).toHaveBeenCalledTimes(1);
			context.continueOnFail.mockReturnValue(true);
			graph.roQuery
				.mockResolvedValueOnce({ data: [] })
				.mockRejectedValueOnce(
					error instanceof Error ? new Error('Query timed out') : 'Query timed out',
				);
			const [output] = await new FalkorDbQuery().execute.call(executeContext);
			expect(output).toEqual([{ json: { error: 'Query timed out' }, pairedItem: { item: 0 } }]);
			expect(client.close).toHaveBeenCalledTimes(2);
		},
	);

	it('rejects query mode when connected as an AI sub-node', async () => {
		const { supplyContext } = fixture();
		await expect(new FalkorDbQuery().supplyData.call(supplyContext)).rejects.toThrow(
			'Choose Retriever for Chain or Tool for AI Agent mode',
		);
		expect(connectFalkorDb).not.toHaveBeenCalled();
	});

	it('reports a non-Error connection failure when supplying a retriever', async () => {
		const { supplyContext } = fixture([{ mode: 'retriever' }]);
		vi.mocked(connectFalkorDb).mockRejectedValue('Connection unavailable');
		await expect(new FalkorDbQuery().supplyData.call(supplyContext)).rejects.toThrow(
			'Connection unavailable',
		);
	});

	it('supplies an invokable agent tool and cleanup function', async () => {
		const { supplyContext, model, client, context } = fixture([
			{ mode: 'tool', retrievalGuidance: 'Return project citations.' },
			{ retrievalGuidance: 'This second item must not be used.' },
		]);
		const supplied = await new FalkorDbQuery().supplyData.call(supplyContext);
		const tool = supplied.response as DynamicStructuredTool;
		expect(tool.description).toBe('Find company projects');
		expect(tool.schema).toMatchObject({
			type: 'object',
			required: ['question'],
			properties: { question: { type: 'string', minLength: 1 } },
		});
		const result = JSON.parse(await tool.invoke({ question: 'Who works on Apollo?' }));
		expect(result.rows[0].citation).toBe('P1');
		expect(JSON.parse(model.invoke.mock.calls[0][0][1].text).question).toBe('Who works on Apollo?');
		expect(JSON.parse(model.invoke.mock.calls[0][0][1].text).retrievalGuidance).toBe(
			'Return project citations.',
		);
		expect(context.getNodeParameter.mock.calls.every((call) => call[1] === 0)).toBe(true);
		await supplied.closeFunction?.();
		expect(client.close).toHaveBeenCalledTimes(1);
	});

	it('accepts agent tool arguments through n8n engine execution', async () => {
		const { executeContext, context, model, client } = fixture([
			{
				mode: 'tool',
				question: 'This UI field is hidden in tool mode',
				retrievalGuidance: 'Return project citations.',
			},
		]);
		context.getInputData = () => [{ json: { question: 'Find projects for Alice' } }];
		const [output] = await new FalkorDbQuery().execute.call(executeContext);
		expect(JSON.parse(model.invoke.mock.calls[0][0][1].text).question).toBe(
			'Find projects for Alice',
		);
		expect(output[0].json).toMatchObject({ rows: [{ text: 'Apollo', citation: 'P1' }] });
		expect(JSON.parse(model.invoke.mock.calls[0][0][1].text).retrievalGuidance).toBe(
			'Return project citations.',
		);
		expect(client.close).toHaveBeenCalledTimes(1);
	});

	it('supplies a retriever preserving source metadata in the chain context', async () => {
		const { supplyContext, client, model, context } = fixture([
			{ mode: 'retriever', retrievalGuidance: 'Return project citations.' },
			{ retrievalGuidance: 'This second item must not be used.' },
		]);
		const supplied = await new FalkorDbQuery().supplyData.call(supplyContext);
		const documents = await (supplied.response as FalkorDbRetriever).invoke('Find projects');
		expect(documents[0].metadata.citation).toBe('P1');
		expect(JSON.parse(documents[0].pageContent)).toEqual({ text: 'Apollo', citation: 'P1' });
		expect(JSON.parse(model.invoke.mock.calls[0][0][1].text).retrievalGuidance).toBe(
			'Return project citations.',
		);
		expect(context.getNodeParameter.mock.calls.every((call) => call[1] === 0)).toBe(true);
		expect(context.addInputData).toHaveBeenCalledWith('ai_retriever', [
			[{ json: { query: 'Find projects' } }],
		]);
		expect(context.addOutputData).toHaveBeenCalledWith('ai_retriever', 7, [
			[
				{
					json: {
						cypher: 'MATCH (p:Project) RETURN p.title AS text LIMIT $limit',
						parameters: { limit: 10 },
						rows: [{ text: 'Apollo', citation: 'P1' }],
						truncated: false,
					},
				},
			],
		]);
		await supplied.closeFunction?.();
		expect(client.close).toHaveBeenCalledTimes(1);
	});

	it('logs repeated retrievals, including empty results, using their own run indices', async () => {
		const { supplyContext, context, graph } = fixture([{ mode: 'retriever' }]);
		context.addInputData.mockReturnValueOnce({ index: 2 }).mockReturnValueOnce({ index: 5 });
		const supplied = await new FalkorDbQuery().supplyData.call(supplyContext);
		const retriever = supplied.response as FalkorDbRetriever;
		await retriever.invoke('Find projects');
		graph.roQuery.mockResolvedValue({ data: [] });
		expect(await retriever.invoke('Find missing projects')).toEqual([]);
		expect(context.addOutputData.mock.calls.map(([type, index]) => [type, index])).toEqual([
			['ai_retriever', 2],
			['ai_retriever', 5],
		]);
		expect(context.addOutputData.mock.calls[1][2][0][0].json.rows).toEqual([]);
		await supplied.closeFunction?.();
	});

	it.each([new Error('Query timed out'), 'Query timed out'])(
		'records retrieval failures on the retriever node and propagates them: %s',
		async (error) => {
			const { supplyContext, context, graph, client } = fixture([{ mode: 'retriever' }]);
			const supplied = await new FalkorDbQuery().supplyData.call(supplyContext);
			graph.roQuery.mockRejectedValue(error);
			await expect(
				(supplied.response as FalkorDbRetriever).invoke('Find projects'),
			).rejects.toThrow('Query timed out');
			expect(context.addOutputData).toHaveBeenCalledWith(
				'ai_retriever',
				7,
				expect.objectContaining({
					message: 'Query timed out',
					functionality: 'configuration-node',
				}),
			);
			await supplied.closeFunction?.();
			expect(client.close).toHaveBeenCalledTimes(1);
		},
	);

	it.each([{}, { question: '' }, { question: '   ' }, { question: 123 }])(
		'rejects invalid agent arguments before generation: %j',
		async (input) => {
			const { supplyContext, model } = fixture([{ mode: 'tool' }]);
			const supplied = await new FalkorDbQuery().supplyData.call(supplyContext);
			await expect((supplied.response as DynamicStructuredTool).invoke(input)).rejects.toThrow();
			expect(model.invoke).not.toHaveBeenCalled();
			await supplied.closeFunction?.();
		},
	);

	it('requires a tool description before connecting', async () => {
		const { supplyContext } = fixture([{ mode: 'tool', toolDescription: '' }]);
		await expect(new FalkorDbQuery().supplyData.call(supplyContext)).rejects.toThrow(
			'Tool Description',
		);
		expect(connectFalkorDb).not.toHaveBeenCalled();
	});
});
