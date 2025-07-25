"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbApi = void 0;
class FalkorDbApi {
    constructor() {
        this.name = 'falkorDbApi';
        this.displayName = 'FalkorDB API';
        this.documentationUrl = 'https://docs.falkordb.com';
        this.properties = [
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
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        };
        this.test = {
            request: {
                baseURL: '={{$credentials.ssl ? "https" : "http"}}://{{$credentials.host}}:{{$credentials.port}}',
                url: '/api/auth/providers',
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                timeout: 10000,
            },
            rules: [
                {
                    type: 'responseCode',
                    properties: {
                        value: 200,
                        message: 'Failed to connect to FalkorDB server. Please verify your host, port, and SSL settings.',
                    },
                },
            ],
        };
    }
}
exports.FalkorDbApi = FalkorDbApi;
//# sourceMappingURL=FalkorDbApi.credentials.js.map