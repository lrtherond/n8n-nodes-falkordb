const { createRequire } = require('node:module');
const dependency = createRequire('/home/node/.n8n/nodes/package.json');
const { BaseChatModel } = dependency('@langchain/core/language_models/chat_models');
const { AIMessage } = dependency('@langchain/core/messages');
class FixtureModel extends BaseChatModel {
	_llmType() {
		return 'falkordb-smoke-fixture';
	}
	bindTools(tools) {
		const search = tools.find((tool) => tool.name === 'FalkorDB_Project_Search');
		this.questionArgument = search?.schema.shape.search
			? 'search'
			: search?.schema.shape.question
				? 'question'
				: undefined;
		if (this.questionArgument && search.schema.safeParse({}).success !== false)
			throw new Error('Agent tool schema lost its required question argument');
		this.tools = tools;
		return this;
	}
	async _generate(messages) {
		const text = messages.map((m) => m.text).join('\n');
		const finish = (message) => ({ generations: [{ text: message.text, message }] });
		if (text.includes('Generate one read-only FalkorDB openCypher query')) {
			const input = JSON.parse(messages.at(-1).text);
			if (
				input.schema !==
				'(Employee {name: STRING})-[:WORKS_ON]->(Project {title: STRING, citation: STRING})'
			)
				throw new Error('Schema expression was not resolved');
			if (
				input.retrievalGuidance !== 'Find employees by name. Return project titles and citations.'
			)
				throw new Error('Retrieval guidance expression was not resolved separately');
			const name = input.question.includes('Bob') ? 'Bob' : 'Alice';
			if (!input.question.includes(name))
				throw new Error('Question was not passed to query generation');
			return finish(
				new AIMessage(
					JSON.stringify({
						cypher:
							'MATCH (e:Employee {name: $name})-[:WORKS_ON]->(p:Project) RETURN p.title AS text, p.citation AS citation LIMIT $limit',
						parameters: { name, limit: input.limit },
					}),
				),
			);
		}
		if (text.includes('AGENT_QUESTION')) {
			const results = messages.filter((message) => message.getType() === 'tool');
			for (const [index, result] of results.entries()) {
				const parsed = JSON.parse(result.text);
				const data = Array.isArray(parsed) ? parsed[0] : parsed;
				const expected = index === 0 ? ['Apollo', 'P1'] : ['Zephyr', 'P2'];
				if (data.rows?.[0]?.text !== expected[0] || data.rows?.[0]?.citation !== expected[1])
					throw new Error('Agent did not receive graph results');
			}
			if (!this.questionArgument && results.length === 1)
				return finish(new AIMessage('agent used Apollo (P1)'));
			if (results.length === 2)
				return finish(new AIMessage('agent used Apollo (P1) and Zephyr (P2)'));
			const tool = this.tools.find((tool) => tool.name === 'FalkorDB_Project_Search');
			if (!tool) throw new Error('Graph query tool was not bound to the agent');
			return finish(
				new AIMessage({
					content: '',
					tool_calls: [
						{
							id: `project-lookup-${results.length}`,
							name: tool.name,
							args: this.questionArgument
								? {
										[this.questionArgument]:
											results.length === 0 ? 'Find projects for Alice' : 'Find projects for Bob',
										...(this.questionArgument === 'search' ? { resultLimit: 2 } : {}),
									}
								: {},
						},
					],
				}),
			);
		}
		if (text.includes('CHAIN_QUESTION')) {
			if (!text.includes('Zephyr') || !text.includes('P2'))
				throw new Error('Chain did not receive graph documents with citations');
			return finish(new AIMessage('chain used Zephyr (P2)'));
		}
		throw new Error('Unexpected query workflow prompt');
	}
}
class FixtureChatModel {
	description = {
		displayName: 'Fixture Chat Model',
		name: 'fixtureChatModel',
		group: ['transform'],
		version: 1,
		description: 'Deterministic integration test model',
		defaults: { name: 'Fixture Chat Model' },
		inputs: [],
		outputs: ['ai_languageModel'],
		properties: [],
	};
	async supplyData() {
		return { response: new FixtureModel({}) };
	}
}
module.exports = { FixtureChatModel };
