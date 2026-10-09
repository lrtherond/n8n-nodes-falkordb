import type { ICredentialTestFunctions } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FalkorDbApi } from '../credentials/FalkorDbApi.credentials';
import { connectFalkorDb } from '../nodes/FalkorDb/FalkorDbClient';
import { FalkorDbQuery } from '../nodes/FalkorDb/FalkorDbQuery.node';

vi.mock('../nodes/FalkorDb/FalkorDbClient', () => ({ connectFalkorDb: vi.fn() }));

function fixture() {
	const client = {
		close: vi.fn().mockResolvedValue(undefined),
		list: vi.fn().mockResolvedValue(['projects']),
	};
	vi.mocked(connectFalkorDb).mockResolvedValue(
		client as unknown as Awaited<ReturnType<typeof connectFalkorDb>>,
	);
	return { context: {} as ICredentialTestFunctions, client };
}

beforeEach(() => vi.clearAllMocks());

describe('FalkorDB credentials', () => {
	const credentials = {
		id: 'test-credential',
		name: 'Test FalkorDB',
		type: 'falkorDbApi',
		data: { host: 'localhost', port: 6379 },
	};

	it('registers masked credentials and a working connection test for the query node', async () => {
		const credential = new FalkorDbApi();
		const node = new FalkorDbQuery();
		expect(node.description.credentials).toContainEqual({
			name: credential.name,
			required: true,
			testedBy: 'falkorDbConnectionTest',
		});
		expect(credential.properties.find((property) => property.name === 'password')).toMatchObject({
			typeOptions: { password: true },
			default: '',
		});
		const { context, client } = fixture();
		const test = node.methods.credentialTest.falkorDbConnectionTest;
		const result = await test.call(context, credentials);
		expect(result.status).toBe('OK');
		expect(client.list).toHaveBeenCalledOnce();
		expect(client.close).toHaveBeenCalledOnce();
	});

	it.each([new Error('Access denied'), 'Access denied'])(
		'reports failed access and closes the connection: %s',
		async (error) => {
			const { context, client } = fixture();
			client.list.mockRejectedValue(error);
			const test = new FalkorDbQuery().methods.credentialTest.falkorDbConnectionTest;
			expect(await test.call(context, credentials)).toEqual({
				status: 'Error',
				message: 'Access denied',
			});
			expect(client.close).toHaveBeenCalledOnce();
		},
	);
});
