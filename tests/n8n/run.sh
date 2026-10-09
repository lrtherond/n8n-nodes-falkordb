#!/bin/sh
set -eu
mkdir -p /home/node/.n8n/nodes /home/node/.n8n/custom
cd /home/node/.n8n/nodes
npm init -y >/dev/null
npm install --omit=dev --ignore-scripts --no-audit --no-fund /smoke/*.tgz
cp /smoke/FixtureChatModel.node.cjs /home/node/.n8n/custom/FixtureChatModel.node.js
n8n import:credentials --input=/smoke/credentials.json
n8n import:workflow --input=/smoke/query-workflow.json
node <<'NODE'
const { execFileSync } = require('node:child_process');
function execute(id) {
  const output = execFileSync('n8n', ['execute', '--id=' + id, '--rawOutput'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(output.slice(output.lastIndexOf('\n{\n'), output.lastIndexOf('\n}') + 2));
}
console.log(JSON.stringify(execute('graph-query-smoke-workflow'), null, 2));
NODE
