import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			include: ['nodes/**/*.ts', 'credentials/**/*.ts'],
			reporter: ['text', 'html', 'json-summary', 'json'],
			thresholds: { perFile: true, statements: 90, branches: 90, functions: 90, lines: 90 },
		},
		projects: [
			{
				test: { name: 'unit', include: ['tests/**/*.test.ts'], exclude: ['tests/integration/**'] },
			},
			{
				test: {
					name: 'integration',
					include: ['tests/integration/**/*.test.ts'],
					testTimeout: 15000,
					hookTimeout: 15000,
				},
			},
		],
	},
});
