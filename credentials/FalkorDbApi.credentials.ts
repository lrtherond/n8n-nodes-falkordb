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

	// Note: This test only validates server connectivity and auth provider availability.
	// Full authentication (signin with username/password) is performed at runtime due to
	// n8n's ICredentialTestRequest limitation of supporting only single HTTP requests.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.ssl ? "https" : "http"}}://{{$credentials.host}}:{{$credentials.port}}',
			url: '/api/auth/providers',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'credentials.signinUrl',
					value: 'string',
					message:
						'Failed to connect to FalkorDB server or get authentication providers. Please verify your host, port, and SSL settings.',
				},
			},
		],
	};
}
