import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

describe('local Docker test isolation', () => {
	const container = {
		State: { Running: true },
		Config: {
			Labels: {
				'com.docker.compose.project': 'n8n-falkordb-tests',
				'com.docker.compose.service': 'falkordb',
			},
		},
		NetworkSettings: { Ports: { '6379/tcp': [{ HostIp: '127.0.0.1', HostPort: '16379' }] } },
		Mounts: [],
		HostConfig: { Tmpfs: { '/data': '' } },
	};
	beforeEach(() => {
		vi.stubEnv('DOCKER_HOST', 'unix:///local/docker.sock');
		vi.stubEnv('DOCKER_CONTEXT', '');
		vi.mocked(execFileSync).mockReset();
	});
	afterEach(() => vi.unstubAllEnvs());

	it('rejects a remote Docker endpoint before starting containers', async () => {
		vi.stubEnv('DOCKER_HOST', 'ssh://acheron.axiom7.net');
		const { testDocker } = await import('./docker.mjs');
		expect(() => testDocker()).toThrow(/local Docker Unix socket/);
		expect(execFileSync).not.toHaveBeenCalled();
	});

	it('rejects a remote selected context even when DOCKER_HOST is local', async () => {
		vi.stubEnv('DOCKER_CONTEXT', 'production');
		vi.mocked(execFileSync).mockReturnValue('tcp://production.invalid:2376');
		const { testDocker } = await import('./docker.mjs');
		expect(() => testDocker()).toThrow(/local Docker Unix socket/);
		expect(execFileSync).toHaveBeenCalledTimes(1);
	});

	it('isolates Compose from production project, file, and database overrides', async () => {
		vi.stubEnv('COMPOSE_PROJECT_NAME', 'production');
		vi.stubEnv('COMPOSE_FILE', 'production.yaml');
		vi.stubEnv('FALKORDB_HOST', 'production.invalid');
		vi.stubEnv('FALKORDB_PORT', '6379');
		vi.stubEnv('FALKORDB_PASSWORD', 'production-secret');
		vi.mocked(execFileSync).mockReturnValue('');
		const { testDocker } = await import('./docker.mjs');
		testDocker().compose(['up', '-d', '--wait']);
		const [command, args, options] = vi.mocked(execFileSync).mock.calls[0];
		expect(command).toBe('docker');
		expect(args).toEqual([
			'--host',
			'unix:///local/docker.sock',
			'compose',
			'--project-name',
			'n8n-falkordb-tests',
			'--env-file',
			'/dev/null',
			'-f',
			expect.stringMatching(/\/compose\.test\.yaml$/),
			'up',
			'-d',
			'--wait',
		]);
		expect(options?.env).not.toHaveProperty('COMPOSE_PROJECT_NAME');
		expect(options?.env).not.toHaveProperty('COMPOSE_FILE');
		vi.mocked(execFileSync)
			.mockReturnValueOnce('test-container')
			.mockReturnValueOnce(JSON.stringify([container]));
		expect(testDocker().database()).toEqual({
			host: '127.0.0.1',
			port: 16379,
			password: 'revival-test-only',
		});
	});

	it('refuses a container belonging to production even with the expected port and mount', async () => {
		const foreign = structuredClone(container);
		foreign.Config.Labels['com.docker.compose.project'] = 'production';
		vi.mocked(execFileSync)
			.mockReturnValueOnce('foreign-container')
			.mockReturnValueOnce(JSON.stringify([foreign]));
		const { testDocker } = await import('./docker.mjs');
		expect(() => testDocker().database()).toThrow(/isolated test container/);
	});

	it.each([{ mounts: [] }, { mounts: [{ Type: 'volume', Destination: '/data' }] }])(
		'refuses a database without the isolated tmpfs mount: %j',
		async ({ mounts }) => {
			vi.mocked(execFileSync)
				.mockReturnValueOnce('test-container')
				.mockReturnValueOnce(
					JSON.stringify([
						{
							...container,
							Mounts: mounts,
							HostConfig: { Tmpfs: mounts.length ? { '/data': '' } : {} },
						},
					]),
				);
			const { testDocker } = await import('./docker.mjs');
			expect(() => testDocker().database()).toThrow(/isolated test container/);
		},
	);
});
