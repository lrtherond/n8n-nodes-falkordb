import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FalkorDbApi implements ICredentialType {
	name = 'falkorDbApi';

	displayName = 'FalkorDB API';

	documentationUrl = 'https://docs.falkordb.com';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			required: true,
			default: 'localhost',
			description: 'FalkorDB server hostname or IP address',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			required: true,
			default: 3000,
			description: 'FalkorDB REST API port number',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'Username for authentication (optional)',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Password for authentication (optional)',
		},
		{
			displayName: 'SSL/TLS',
			name: 'ssl',
			type: 'boolean',
			default: false,
			description: 'Whether to use SSL/TLS connection',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Content-Type': 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.ssl ? "https" : "http"}}://{{$credentials.host}}:{{$credentials.port}}',
			url: '/api/graph/test',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			auth: {
				username: '={{$credentials.username || ""}}',
				password: '={{$credentials.password || ""}}',
			},
			body: {
				query: 'RETURN 1 as test',
			},
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'result',
					value: '',
					message: 'Failed to connect to FalkorDB server. Please check your connection settings.',
				},
			},
		],
	};
}
