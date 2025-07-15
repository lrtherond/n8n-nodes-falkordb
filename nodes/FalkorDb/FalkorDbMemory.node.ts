import type {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	INodeProperties,
	SupplyData,
	IDataObject,
} from 'n8n-workflow';

import { NodeConnectionType } from 'n8n-workflow';
import {
	FalkorDbChatMemory,
	getSessionId,
	getConnectionHintNoticeField,
} from './FalkorDbLangChain';

const sessionIdOption: INodeProperties = {
	displayName: 'Session ID',
	name: 'sessionIdType',
	type: 'options',
	options: [
		{
			name: 'Connected Chat Trigger Node',
			value: 'fromInput',
		},
		{
			name: 'Define Below',
			value: 'customKey',
		},
	],
	default: 'fromInput',
	description: 'How to define the session ID',
};

const sessionKeyProperty: INodeProperties = {
	displayName: 'Session Key',
	name: 'sessionKey',
	type: 'string',
	default: '',
	description: 'The key to use for the session ID',
	displayOptions: {
		show: {
			sessionIdType: ['customKey'],
		},
	},
};

export class FalkorDbMemory implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FalkorDB Memory',
		name: 'falkorDbMemory',
		icon: 'file:falkordb.svg',
		group: ['transform'],
		version: 1,
		description: 'Use FalkorDB graph database for AI agent memory management',
		defaults: {
			name: 'FalkorDB Memory',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Memory'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.falkordb.com/',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionType.AiMemory],
		outputNames: ['Memory'],
		credentials: [
			{
				name: 'falkorDbApi',
				required: true,
			},
		],
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiAgent]),
			sessionIdOption,
			sessionKeyProperty,
			{
				displayName: 'Graph Name',
				name: 'graphName',
				type: 'string',
				required: true,
				default: 'memory',
				description: 'Name of the graph to store memory data in',
			},
			{
				displayName: 'Context Window Length',
				name: 'contextWindowLength',
				type: 'number',
				default: 5,
				description: 'Number of previous messages to include in context',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Return Messages',
						name: 'returnMessages',
						type: 'boolean',
						default: false,
						description: 'Whether to return messages as objects instead of strings',
					},
					{
						displayName: 'Memory Key',
						name: 'memoryKey',
						type: 'string',
						default: 'history',
						description: 'Key to use for storing memory in the context',
					},
					{
						displayName: 'Input Key',
						name: 'inputKey',
						type: 'string',
						default: 'input',
						description: 'Key to use for input messages',
					},
					{
						displayName: 'Output Key',
						name: 'outputKey',
						type: 'string',
						default: 'output',
						description: 'Key to use for output messages',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('falkorDbApi');
		const sessionId = getSessionId(this, itemIndex);
		const graphName = this.getNodeParameter('graphName', itemIndex) as string;
		const contextWindowLength = this.getNodeParameter('contextWindowLength', itemIndex) as number;

		const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

		const memory = new FalkorDbChatMemory({
			sessionId,
			graphName,
			contextWindowLength,
			credentials,
			memoryKey: (options['memoryKey'] as string) || 'history',
			inputKey: (options['inputKey'] as string) || 'input',
			outputKey: (options['outputKey'] as string) || 'output',
			returnMessages: (options['returnMessages'] as boolean) || false,
		});

		return {
			response: memory,
		};
	}
}
