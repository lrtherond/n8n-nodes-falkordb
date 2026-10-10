import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testDocker } from './docker.mjs';

const mode = process.argv[2];
if (!['integration', 'n8n'].includes(mode)) throw new Error('Expected integration or n8n');
const docker = testDocker();
try {
	docker.compose(['up', '-d', '--wait', 'falkordb']);
	docker.database();
	execFileSync(
		process.execPath,
		mode === 'integration'
			? ['node_modules/vitest/vitest.mjs', 'run', '--project', 'integration']
			: ['tests/n8n/run.mjs'],
		{
			cwd: fileURLToPath(new URL('..', import.meta.url)),
			stdio: 'inherit',
		},
	);
} catch (error) {
	if (error.stdout) process.stderr.write(error.stdout);
	if (error.stderr) process.stderr.write(error.stderr);
	throw error;
} finally {
	docker.compose(['--profile', 'smoke', 'down', '--volumes']);
}
