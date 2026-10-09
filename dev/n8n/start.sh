#!/bin/sh
set -eu

mkdir -p /home/node/.n8n/nodes
cd /home/node/.n8n/nodes
if [ ! -f package.json ]; then
  printf '%s\n' '{"name":"local-n8n-nodes","version":"1.0.0","private":true}' > package.json
fi

# Content-addressed archives ensure a rebuild replaces the same development version.
npm install --omit=dev --ignore-scripts --no-audit --no-fund /local-node/*.tgz
exec /docker-entrypoint.sh
