import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [graphName, schemaPath, retrievalGuidancePath] = process.argv.slice(2);
if (!graphName || !schemaPath)
	throw new Error(
		'Usage: node dev/n8n/seed-workflows.mjs <graph-name> <schema-file> [retrieval-guidance-file]',
	);
const schema = readFileSync(schemaPath, 'utf8');
const retrievalGuidance = retrievalGuidancePath ? readFileSync(retrievalGuidancePath, 'utf8') : '';
const quotationInstructions =
	'For every selected passage, quote its entire returned text verbatim, preserving every word, punctuation mark, and paragraph. Do not summarize, paraphrase, shorten, or replace any text with ellipses. Include the citation and work title exactly as returned. Select the requested number of passages when enough are available. If a passage cannot be quoted in full, explicitly say so instead of presenting an excerpt as complete. Never invent text or citations; report when no evidence was retrieved.';
const connect = (name, type) => ({ node: name, type, index: 0 });
const node = (name, type, typeVersion, position, parameters) => ({
	id: name,
	name,
	type,
	typeVersion,
	position,
	parameters,
});
const workflows = ['query', 'retriever', 'tool'].map((mode) => {
	const title = { query: 'Graph Query', retriever: 'RAG Chain', tool: 'Agent RAG' }[mode];
	const graphNodeName = {
		query: 'FalkorDB Graph Query',
		retriever: 'FalkorDB Graph Retriever',
		tool: 'FalkorDB Search Graph',
	}[mode];
	const rootName =
		mode === 'query'
			? graphNodeName
			: mode === 'retriever'
				? 'Question and Answer Chain'
				: 'AI Agent';
	const graphNode = {
		...node(
			graphNodeName,
			'@lrtherond/n8n-nodes-falkordb.falkorDbQuery',
			1,
			mode === 'query' ? [640, 0] : [780, 260],
			{
				mode,
				graphName,
				schema: "={{ $('Inputs').first().json.schema }}",
				retrievalGuidance: "={{ $('Inputs').first().json.retrievalGuidance }}",
				question: '={{ $json.question }}',
				toolDescription:
					'Search the configured knowledge graph for evidence relevant to the question, including text and source citations',
				limit: 5,
				timeout: 10000,
			},
		),
		credentials: { falkorDbApi: { id: 'stoa-local-falkordb', name: 'Stoa · local FalkorDB' } },
	};
	const model = node('Chat Model', '@n8n/n8n-nodes-langchain.lmChatOpenAi', 1.3, [460, 440], {
		model: { __rl: true, mode: 'id', value: 'gpt-6.1-sol' },
		responsesApiEnabled: true,
		options: { timeout: 120000, maxRetries: 0 },
	});
	model.notes =
		'Select your OpenAI credential, or replace this with another n8n Chat Model. The schema, retrieval guidance, and question are in Inputs.';
	const nodes = [
		node('Run manually', 'n8n-nodes-base.manualTrigger', 1, [0, 0], {}),
		node('Inputs', 'n8n-nodes-base.set', 3.4, [260, 0], {
			assignments: {
				assignments: [
					{
						id: 'question',
						name: 'question',
						type: 'string',
						value:
							'Find three passages about anger. Return the complete, verbatim text of each passage, its citation, and work title. Do not summarize, shorten, or replace text with ellipses.',
					},
					{ id: 'schema', name: 'schema', type: 'string', value: schema },
					{
						id: 'retrievalGuidance',
						name: 'retrievalGuidance',
						type: 'string',
						value: retrievalGuidance,
					},
				],
			},
			options: {},
		}),
		graphNode,
		model,
	];
	const connections = {
		'Run manually': { main: [[connect('Inputs', 'main')]] },
		Inputs: { main: [[connect(rootName, 'main')]] },
		'Chat Model': { ai_languageModel: [[connect(graphNodeName, 'ai_languageModel')]] },
	};
	if (mode !== 'query') {
		nodes.push(
			node(
				rootName,
				`@n8n/n8n-nodes-langchain.${mode === 'retriever' ? 'chainRetrievalQa' : 'agent'}`,
				mode === 'retriever' ? 1.7 : 3,
				[640, 0],
				{
					promptType: 'define',
					text: '={{ $json.question }}',
					options:
						mode === 'tool'
							? {
									systemMessage: `Use the graph tool to retrieve evidence before answering. ${quotationInstructions}`,
									maxIterations: 4,
								}
							: {
									systemPromptTemplate: `Answer using only the retrieved context. ${quotationInstructions}\n\nContext:\n{context}`,
								},
				},
			),
		);
		const connection = mode === 'retriever' ? 'ai_retriever' : 'ai_tool';
		connections[graphNodeName] = { [connection]: [[connect(rootName, connection)]] };
		connections['Chat Model'].ai_languageModel[0].push(connect(rootName, 'ai_languageModel'));
	}
	return {
		id: `local-graph-${mode}`,
		name: `${graphName} · ${title}`,
		nodes,
		connections,
		active: false,
		settings: { executionOrder: 'v1' },
	};
});

mkdirSync('.n8n/workflows', { recursive: true });
const filenames = ['graph-query.json', 'rag-chain.json', 'agent-rag.json'];
for (const [index, workflow] of workflows.entries()) {
	writeFileSync(`.n8n/workflows/${filenames[index]}`, `${JSON.stringify(workflow, null, 2)}\n`);
}
execFileSync(
	'docker',
	[
		'compose',
		'-f',
		'compose.dev.yaml',
		'exec',
		'-T',
		'n8n',
		'n8n',
		'import:workflow',
		'--input=/dev/stdin',
	],
	{ input: JSON.stringify(workflows), stdio: ['pipe', 'inherit', 'inherit'] },
);
console.log(
	'Imported three inactive, manually triggered graph workflows. Configure Chat Model credentials in n8n.',
);
