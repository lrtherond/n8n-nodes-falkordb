import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = 'n8n-falkordb-tests';
const composeFile = fileURLToPath(new URL('../compose.test.yaml', import.meta.url));

export function testDocker() {
	const context = process.env.DOCKER_CONTEXT;
	const endpoint = (
		context || !process.env.DOCKER_HOST
			? execFileSync(
					'docker',
					[
						'context',
						'inspect',
						...(context ? [context] : []),
						'--format',
						'{{.Endpoints.docker.Host}}',
					],
					{ encoding: 'utf8' },
				)
			: process.env.DOCKER_HOST
	).trim();
	if (!endpoint.startsWith('unix://')) {
		throw new Error(
			'Tests require a local Docker Unix socket; remote Docker endpoints are rejected.',
		);
	}
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key]) =>
				!key.startsWith('COMPOSE_') &&
				!['DOCKER_CONTEXT', 'DOCKER_HOST', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'].includes(key),
		),
	);
	/** @param {string[]} args @param {Record<string, string>} extraEnv */
	function docker(args, extraEnv = {}) {
		return execFileSync('docker', ['--host', endpoint, ...args], {
			env: { ...env, ...extraEnv },
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trim();
	}
	/** @param {string[]} args @param {Record<string, string>} extraEnv */
	function compose(args, extraEnv = {}) {
		return docker(
			['compose', '--project-name', project, '--env-file', '/dev/null', '-f', composeFile, ...args],
			extraEnv,
		);
	}
	function database() {
		const id = compose(['ps', '-q', 'falkordb']);
		if (!id || id.includes('\n'))
			throw new Error(
				'Start the isolated test container with npm run test:integration or npm run test:n8n.',
			);
		const [container] = JSON.parse(docker(['inspect', id]));
		const ports = container.NetworkSettings.Ports['6379/tcp'];
		if (
			!container.State.Running ||
			container.Config.Labels['com.docker.compose.project'] !== project ||
			container.Config.Labels['com.docker.compose.service'] !== 'falkordb' ||
			ports?.length !== 1 ||
			ports[0].HostIp !== '127.0.0.1' ||
			ports[0].HostPort !== '16379' ||
			container.Mounts.some((mount) => mount.Type !== 'tmpfs') ||
			typeof container.HostConfig?.Tmpfs?.['/data'] !== 'string'
		) {
			throw new Error(
				'Refusing database access: expected the isolated test container on 127.0.0.1:16379 with tmpfs data.',
			);
		}
		return { host: '127.0.0.1', port: 16379, password: 'revival-test-only' };
	}
	return { compose, database };
}
