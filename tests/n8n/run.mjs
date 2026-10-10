import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FalkorDB } from 'falkordb';
import { queryWorkflow } from './query-workflow.mjs';

const directory = mkdtempSync(join(tmpdir(), 'falkordb-n8n-smoke-'));
const queryGraphName = `n8n_query_smoke_${crypto.randomUUID()}`;
let client;
try {
	// mkdtemp uses 0700; the container's node user can differ from the Linux host user.
	chmodSync(directory, 0o755);
	client = await FalkorDB.connect({
		socket: { host: '127.0.0.1', port: 16379, reconnectStrategy: false, connectTimeout: 5000 },
		password: 'revival-test-only',
	});
	client.on('error', () => {});
	await client
		.selectGraph(queryGraphName)
		.query(
			'CREATE (:Employee {name: "Alice"})-[:WORKS_ON]->(:Project {title: "Apollo", citation: "P1"}), (:Employee {name: "Bob"})-[:WORKS_ON]->(:Project {title: "Zephyr", citation: "P2"})',
		);
	for (const file of ['FixtureChatModel.node.cjs', 'credentials.json', 'run.sh']) {
		cpSync(new URL(file, import.meta.url), join(directory, file));
	}
	for (const agentVersion of [2.2, 3]) {
		for (const questionMode of ['default', 'from-ai', 'fixed', 'expression']) {
			writeFileSync(
				join(directory, `query-workflow-${agentVersion}-${questionMode}.json`),
				JSON.stringify(queryWorkflow(queryGraphName, agentVersion, questionMode)),
			);
		}
	}
	const [packed] = JSON.parse(
		execFileSync('npm', ['pack', '--json', '--pack-destination', directory], { encoding: 'utf8' }),
	);
	const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
	assert.deepEqual(manifest.n8n.nodes, ['dist/nodes/FalkorDb/FalkorDbQuery.node.js']);
	assert.deepEqual(
		packed.files.map(({ path }) => path).sort(),
		[
			'LICENSE',
			'README.md',
			'package.json',
			'dist/nodes/FalkorDb/graph-query.png',
			...[
				'dist/credentials/FalkorDbApi.credentials',
				'dist/nodes/FalkorDb/FalkorDbClient',
				'dist/nodes/FalkorDb/FalkorDbQuery',
				'dist/nodes/FalkorDb/FalkorDbQuery.node',
			].flatMap((path) => ['.js', '.js.map', '.d.ts'].map((extension) => path + extension)),
		].sort(),
		'The package must contain only the current query implementation and its assets',
	);
	const output = execFileSync(
		'docker',
		['compose', '-f', 'compose.test.yaml', 'run', '--rm', 'n8n-smoke'],
		{
			env: { ...process.env, N8N_SMOKE_DIR: directory },
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	);
	const { executions } = JSON.parse(
		output.slice(output.lastIndexOf('\n{\n'), output.lastIndexOf('\n}') + 2),
	);
	for (const { version, questionMode, result } of executions) {
		const fromAI = questionMode === 'default' || questionMode === 'from-ai';
		assert.equal(result.status, 'success');
		const runs = result.data.resultData.runData;
		assert.deepEqual(runs['FalkorDB Graph Query'][0].data.main[0][0].json.rows, [
			{ text: 'Apollo', citation: 'P1' },
		]);
		assert.equal(runs['QA Chain'][0].data.main[0][0].json.response, 'chain used Zephyr (P2)');
		const retrieval = runs['FalkorDB Graph Retriever'][0];
		assert.equal(
			retrieval.inputOverride.ai_retriever[0][0].json.query,
			'CHAIN_QUESTION: Find projects for Bob',
		);
		assert.deepEqual(retrieval.data.ai_retriever[0][0].json.rows, [
			{ text: 'Zephyr', citation: 'P2' },
		]);
		assert.equal(
			version === 3
				? result.data.resultData.metadata.response_graph_agent
				: runs['Graph Agent'][0].data.main[0][0].json.output,
			fromAI ? 'agent used Apollo (P1) and Zephyr (P2)' : 'agent used Apollo (P1)',
		);
		const toolRuns = runs['FalkorDB Project Search'];
		assert.ok(toolRuns, `Agent ${version} must record its tool calls in n8n`);
		assert.deepEqual(
			toolRuns.map((run) => run.executionStatus),
			fromAI ? ['success', 'success'] : ['success'],
		);
		assert.deepEqual(
			toolRuns.map((run) => run.inputOverride.ai_tool[0][0].json),
			questionMode === 'default'
				? [{ question: 'Find projects for Alice' }, { question: 'Find projects for Bob' }]
				: questionMode === 'from-ai'
					? [
							{ search: 'Find projects for Alice', resultLimit: 2 },
							{ search: 'Find projects for Bob', resultLimit: 2 },
						]
					: [{}],
		);
		assert.deepEqual(
			toolRuns.map((run) => run.data.ai_tool[0][0].json.parameters.name),
			fromAI ? ['Alice', 'Bob'] : ['Alice'],
		);
		assert.deepEqual(
			toolRuns.map((run) => run.data.ai_tool[0][0].json.rows),
			fromAI
				? [[{ text: 'Apollo', citation: 'P1' }], [{ text: 'Zephyr', citation: 'P2' }]]
				: [[{ text: 'Apollo', citation: 'P1' }]],
		);
		assert.ok(
			toolRuns.every(
				(run) =>
					run.data.ai_tool[0][0].json.parameters.limit === (questionMode === 'from-ai' ? 2 : 10),
			),
		);
	}
	console.log(
		'n8n 2.42.6: package contents, workflow query, QA retriever, Agent 2.2 and 3 tool results and execution records, and schema and retrieval guidance expressions passed.',
	);
} catch (error) {
	if (error.stdout) process.stderr.write(error.stdout);
	if (error.stderr) process.stderr.write(error.stderr);
	throw error;
} finally {
	try {
		if (client) {
			try {
				const graphs = await client.list();
				if (graphs.includes(queryGraphName)) await client.selectGraph(queryGraphName).delete();
			} finally {
				await client.close();
			}
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
