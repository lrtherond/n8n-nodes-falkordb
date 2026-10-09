import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class FalkorDbApi implements ICredentialType {
	name = 'falkorDbApi';
	displayName = 'FalkorDB API';
	icon = 'file:../nodes/FalkorDb/graph-query.png' as const;
	documentationUrl = 'https://docs.falkordb.com/';
	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			required: true,
			default: 'localhost',
			description: 'FalkorDB database hostname or IP address',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 65535, numberPrecision: 0 },
			required: true,
			default: 6379,
			description: 'FalkorDB database port',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'ACL username, if required by the database',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Database password, if required',
		},
		{
			displayName: 'SSL/TLS',
			name: 'ssl',
			type: 'boolean',
			default: false,
			description: 'Whether to use TLS with certificate verification',
		},
	];
}
