import { AIMessage } from '@langchain/core/messages';
import { describe, expect, it, vi } from 'vitest';
import { FalkorDbQueryEngine, queryResultToDocuments } from '../nodes/FalkorDb/FalkorDbQuery';

const schema = '(Employee {name: STRING})-[:WORKS_ON]->(Project {title: STRING})';
const generated = {
	cypher:
		'MATCH (e:Employee {name: $name})-[:WORKS_ON]->(p:Project) RETURN p.title AS text LIMIT $limit',
	parameters: { name: 'Alice', limit: 10 },
};

function fixture(response: unknown = generated, rows: Record<string, unknown>[] = []) {
	const model = { invoke: vi.fn().mockResolvedValue(new AIMessage(JSON.stringify(response))) };
	const graph = { roQuery: vi.fn().mockResolvedValue({ data: rows }) };
	const engine = new FalkorDbQueryEngine({ model, graph, schema, limit: 10, timeout: 10000 });
	return { engine, model, graph };
}

describe('schema-guided queries', () => {
	it('grounds generation in the supplied schema and question and passes parameters separately', async () => {
		const { engine, model, graph } = fixture(generated, [{ text: 'Apollo' }]);
		const result = await engine.query('What does Alice work on?');
		const messages = model.invoke.mock.calls[0][0];
		expect(messages[0].text).toContain('FalkorDB');
		expect(JSON.parse(messages[1].text)).toEqual({
			schema,
			retrievalGuidance: '',
			question: 'What does Alice work on?',
			limit: 10,
		});
		expect(graph.roQuery).toHaveBeenCalledWith(generated.cypher, {
			params: generated.parameters,
			TIMEOUT: 10000,
		});
		expect(result).toEqual({ ...generated, rows: [{ text: 'Apollo' }], truncated: false });
	});

	it('accepts fenced JSON and text-block responses from chat models', async () => {
		const { engine, model } = fixture();
		model.invoke.mockResolvedValue(
			new AIMessage({
				content: [{ type: 'text', text: '```json\n' + JSON.stringify(generated) + '\n```' }],
			}),
		);
		expect((await engine.query('Find projects')).cypher).toBe(generated.cypher);
	});

	it.each([
		{ cypher: '', parameters: {} },
		{ cypher: 'RETURN 1', parameters: { 'bad) RETURN 1 //': 'value' } },
		{ cypher: 'RETURN $value', parameters: { value: { 'bad-key': 1 } } },
		{ cypher: 'RETURN 1', parameters: {}, unexpected: true },
		{ cypher: 'RETURN 1', parameters: 'not an object' },
	])('rejects invalid generation before database execution: %j', async (response) => {
		const { engine, graph } = fixture(response);
		await expect(engine.query('Find projects')).rejects.toThrow('Chat Model');
		expect(graph.roQuery).not.toHaveBeenCalled();
	});

	it('reports unanswerable questions and malformed JSON without guessing a query', async () => {
		const { engine, model, graph } = fixture({ error: 'The schema has no sales data' });
		await expect(engine.query('Total sales?')).rejects.toThrow('The schema has no sales data');
		model.invoke.mockResolvedValue(new AIMessage('MATCH (n) RETURN n'));
		await expect(engine.query('Anything')).rejects.toThrow('Chat Model');
		expect(graph.roQuery).not.toHaveBeenCalled();
	});

	it('returns empty results as empty and preserves database ranking while enforcing the output limit', async () => {
		const { engine, graph } = fixture();
		expect((await engine.query('No match')).rows).toEqual([]);
		const rows = Array.from({ length: 12 }, (_, rank) => ({
			text: `Result ${rank}`,
			score: 12 - rank,
		}));
		graph.roQuery.mockResolvedValue({ data: rows });
		const result = await engine.query('Ranked matches');
		expect(result.rows).toEqual(rows.slice(0, 10));
		expect(result.truncated).toBe(true);
	});

	it('treats a database response without data as an empty result', async () => {
		const { engine, graph } = fixture();
		graph.roQuery.mockResolvedValue({});
		expect(await engine.query('Find projects')).toMatchObject({ rows: [], truncated: false });
	});

	it('propagates database errors without retrying with a write-capable command', async () => {
		const { engine, graph } = fixture();
		graph.roQuery.mockRejectedValue(new Error('graph is read-only'));
		await expect(engine.query('Change the graph')).rejects.toThrow('graph is read-only');
		expect(graph.roQuery).toHaveBeenCalledTimes(1);
	});

	it('rejects an empty question before invoking the model', async () => {
		const { engine, model } = fixture();
		await expect(engine.query('   ')).rejects.toThrow('Question');
		expect(model.invoke).not.toHaveBeenCalled();
	});

	it('keeps citations and scores in retriever context, and supports arbitrary result rows', () => {
		const documents = queryResultToDocuments({
			...generated,
			rows: [
				{ text: 'A passage', metadata: { citation: 'Work 1.2' }, score: 0.9 },
				{ total: 7, departments: ['Research'] },
			],
			truncated: false,
		});
		expect(documents[0].pageContent).toContain('A passage');
		expect(documents[0].pageContent).toContain('Work 1.2');
		expect(documents[0].metadata).toMatchObject({ score: 0.9, metadata: { citation: 'Work 1.2' } });
		expect(JSON.parse(documents[1].pageContent)).toEqual({ total: 7, departments: ['Research'] });
	});
});
