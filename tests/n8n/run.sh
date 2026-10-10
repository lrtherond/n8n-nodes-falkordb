#!/bin/sh
set -eu
mkdir -p /home/node/.n8n/nodes /home/node/.n8n/custom
cd /home/node/.n8n/nodes
npm init -y >/dev/null
npm install --omit=dev --ignore-scripts --no-audit --no-fund /smoke/*.tgz
cp /smoke/FixtureChatModel.node.cjs /home/node/.n8n/custom/FixtureChatModel.node.js
n8n import:credentials --input=/smoke/credentials.json
for workflow in /smoke/query-workflow-*.json; do
  n8n import:workflow --input="$workflow"
done
node <<'NODE'
const { execFileSync } = require('node:child_process');
function execute(id) {
  const output = execFileSync('n8n', ['execute', '--id=' + id, '--rawOutput'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(output.slice(output.lastIndexOf('\n{\n'), output.lastIndexOf('\n}') + 2));
}
const executions = [];
for (const version of [2.2, 3]) {
  for (const questionMode of ['default', 'from-ai', 'fixed', 'expression']) {
    executions.push({ version, questionMode, result: execute(`graph-query-smoke-workflow-${version}-${questionMode}`) });
  }
}
console.log(JSON.stringify({ executions }, null, 2));
NODE
