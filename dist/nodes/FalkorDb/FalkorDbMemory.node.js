"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FalkorDbMemory = void 0;
const FalkorDbLangChain_1 = require("./FalkorDbLangChain");
const sessionIdOption = {
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
const sessionKeyProperty = {
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
class FalkorDbMemory {
    constructor() {
        this.description = {
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
            outputs: ["ai_memory"],
            outputNames: ['Memory'],
            credentials: [
                {
                    name: 'falkorDbApi',
                    required: true,
                },
            ],
            properties: [
                (0, FalkorDbLangChain_1.getConnectionHintNoticeField)(["ai_agent"]),
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
    }
    async supplyData(itemIndex) {
        const credentials = await this.getCredentials('falkorDbApi');
        const sessionId = (0, FalkorDbLangChain_1.getSessionId)(this, itemIndex);
        const graphName = this.getNodeParameter('graphName', itemIndex);
        const contextWindowLength = this.getNodeParameter('contextWindowLength', itemIndex);
        const options = this.getNodeParameter('options', itemIndex, {});
        const memory = new FalkorDbLangChain_1.FalkorDbChatMemory({
            sessionId,
            graphName,
            contextWindowLength,
            credentials,
            memoryKey: options['memoryKey'] || 'history',
            inputKey: options['inputKey'] || 'input',
            outputKey: options['outputKey'] || 'output',
            returnMessages: options['returnMessages'] || false,
        });
        return {
            response: memory,
        };
    }
}
exports.FalkorDbMemory = FalkorDbMemory;
//# sourceMappingURL=FalkorDbMemory.node.js.map