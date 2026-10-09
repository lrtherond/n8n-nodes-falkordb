import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
	...configWithoutCloudSupport,
	{
		files: ['**/*.ts'],
		rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
	},
	{
		files: ['package.json'],
		rules: {
			// This self-hosted database node needs the native client and LangChain at runtime.
			'@n8n/community-nodes/no-runtime-dependencies': 'off',
			// Restrict installation to the n8n workflow API used and tested by this major version.
			'@n8n/community-nodes/valid-peer-dependencies': 'off',
		},
	},
];
