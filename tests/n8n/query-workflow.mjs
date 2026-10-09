export const schema =
	'(Employee {name: STRING})-[:WORKS_ON]->(Project {title: STRING, citation: STRING})';

export function queryWorkflow(graphName) {
	const node = (name, type, typeVersion, parameters) => ({
		id: name,
		name,
		type,
		typeVersion,
		position: [0, 0],
		parameters,
	});
	const queryNode = (name, mode) => ({
		...node(name, '@lrtherond/n8n-nodes-falkordb.falkorDbQuery', 1, {
			mode,
			graphName,
			schema: "={{ $('Inputs').first().json.schema }}",
			retrievalGuidance: "={{ $('Inputs').first().json.retrievalGuidance }}",
			question: '={{ $json.question }}',
			toolDescription: 'Find employee projects with their citations',
			limit: 10,
			timeout: 10000,
		}),
		credentials: { falkorDbApi: { id: 'falkordb-smoke-credential', name: 'Smoke FalkorDB' } },
	});
	const connection = (name, type) => ({ node: name, type, index: 0 });
	return {
		id: 'graph-query-smoke-workflow',
		name: 'Graph Query Smoke Test',
		active: false,
		settings: { executionOrder: 'v1' },
		nodes: [
			node('Start', 'n8n-nodes-base.manualTrigger', 1, {}),
			node('Inputs', 'n8n-nodes-base.set', 3.4, {
				assignments: {
					assignments: [
						{ id: 'schema', name: 'schema', type: 'string', value: schema },
						{
							id: 'retrievalGuidance',
							name: 'retrievalGuidance',
							type: 'string',
							value: 'Find employees by name. Return project titles and citations.',
						},
						{ id: 'question', name: 'question', type: 'string', value: 'Find projects for Alice' },
					],
				},
				options: {},
			}),
			queryNode('FalkorDB Graph Query', 'query'),
			queryNode('FalkorDB Graph Retriever', 'retriever'),
			queryNode('FalkorDB Project Search', 'tool'),
			node('QA Chain', '@n8n/n8n-nodes-langchain.chainRetrievalQa', 1.7, {
				promptType: 'define',
				text: 'CHAIN_QUESTION: Find projects for Bob',
				options: {},
			}),
			node('Graph Agent', '@n8n/n8n-nodes-langchain.agent', 3, {
				promptType: 'define',
				text: 'AGENT_QUESTION: Find projects for Alice and Bob',
				options: {},
			}),
			node('Model', 'CUSTOM.fixtureChatModel', 1, {}),
		],
		connections: {
			Start: { main: [[connection('Inputs', 'main')]] },
			Inputs: { main: [[connection('FalkorDB Graph Query', 'main')]] },
			'FalkorDB Graph Query': { main: [[connection('QA Chain', 'main')]] },
			'QA Chain': { main: [[connection('Graph Agent', 'main')]] },
			'FalkorDB Graph Retriever': { ai_retriever: [[connection('QA Chain', 'ai_retriever')]] },
			'FalkorDB Project Search': { ai_tool: [[connection('Graph Agent', 'ai_tool')]] },
			Model: {
				ai_languageModel: [
					[
						...[
							'FalkorDB Graph Query',
							'FalkorDB Graph Retriever',
							'FalkorDB Project Search',
							'QA Chain',
							'Graph Agent',
						].map((name) => connection(name, 'ai_languageModel')),
					],
				],
			},
		},
	};
}
