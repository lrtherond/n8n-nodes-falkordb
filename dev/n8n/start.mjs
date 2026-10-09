import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve('.n8n/node-package');
mkdirSync(directory, { recursive: true });
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
const [packed] = JSON.parse(
	execFileSync('npm', ['pack', '--json', '--pack-destination', directory], { encoding: 'utf8' }),
);
const archive = resolve(directory, packed.filename);
const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
const filename = `graph-query-${hash}.tgz`;
renameSync(archive, resolve(directory, filename));
for (const previous of readdirSync(directory)) {
	if (/^graph-query-[a-f0-9]{64}\.tgz$/.test(previous) && previous !== filename)
		rmSync(resolve(directory, previous));
}
execFileSync(
	'docker',
	['compose', '-f', 'compose.dev.yaml', 'up', '-d', '--force-recreate', '--wait'],
	{ stdio: 'inherit' },
);
console.log(
	'Local n8n is ready at http://localhost:5678. Workflows and credentials persist in its Docker volume.',
);
