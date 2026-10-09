import { FalkorDB } from 'falkordb';
import { beforeEach, expect, it, vi } from 'vitest';
import { connectFalkorDb } from '../nodes/FalkorDb/FalkorDbClient';

vi.mock('falkordb', () => ({ FalkorDB: { connect: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it('passes TLS and ACL credentials to the native client with bounded connection attempts', async () => {
	const client = { on: vi.fn() };
	vi.mocked(FalkorDB.connect).mockResolvedValue(client as unknown as FalkorDB);
	await connectFalkorDb({
		host: 'db.example.com',
		port: 6380,
		username: 'alice',
		password: 'secret',
		ssl: true,
	});
	expect(FalkorDB.connect).toHaveBeenCalledWith({
		socket: {
			host: 'db.example.com',
			port: 6380,
			tls: true,
			connectTimeout: 10000,
			reconnectStrategy: false,
		},
		disableOfflineQueue: true,
		username: 'alice',
		password: 'secret',
	});
	expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
});

it('rejects invalid connection settings before opening a socket', async () => {
	await expect(connectFalkorDb({ host: '', port: 6379 })).rejects.toThrow();
	await expect(connectFalkorDb({ host: 'localhost', port: 99999 })).rejects.toThrow();
	expect(FalkorDB.connect).not.toHaveBeenCalled();
});

it('connects without optional authentication or TLS and handles client error events', async () => {
	const client = new EventEmitter();
	vi.mocked(FalkorDB.connect).mockResolvedValue(client as unknown as FalkorDB);
	expect(await connectFalkorDb({ host: 'localhost', port: 6379 })).toBe(client);
	const [options] = vi.mocked(FalkorDB.connect).mock.calls[0];
	expect(options).not.toHaveProperty('username');
	expect(options).not.toHaveProperty('password');
	expect(options?.socket).not.toHaveProperty('tls');
	expect(() => client.emit('error', new Error('Connection lost'))).not.toThrow();
});
import { EventEmitter } from 'node:events';
