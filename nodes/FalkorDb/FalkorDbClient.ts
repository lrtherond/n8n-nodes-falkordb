import { FalkorDB } from 'falkordb';
import { z } from 'zod';

const credentialsSchema = z.object({
	host: z.string().trim().min(1),
	port: z.number().int().min(1).max(65535),
	username: z.string().default(''),
	password: z.string().default(''),
	ssl: z.boolean().default(false),
});

export async function connectFalkorDb(credentials: unknown): Promise<FalkorDB> {
	const { host, port, username, password, ssl } = credentialsSchema.parse(credentials);
	const options = {
		socket: {
			host,
			port,
			...(ssl ? { tls: true as const } : {}),
			connectTimeout: 10000,
			reconnectStrategy: false as const,
		},
		disableOfflineQueue: true,
		...(username ? { username } : {}),
		...(password ? { password } : {}),
	};
	const client = await FalkorDB.connect(options);
	// Commands reject on connection errors; consume the duplicate EventEmitter notification.
	client.on('error', () => {});
	return client;
}
