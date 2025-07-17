import type { IDataObject, IRequestOptions } from 'n8n-workflow';
import { BaseChatMemory } from '@langchain/community/memory/chat_memory';
import type { InputValues, MemoryVariables, OutputValues } from '@langchain/core/memory';
export interface GraphEntity {
    id: string;
    type: string;
    name: string;
    properties?: IDataObject;
}
export interface GraphRelationship {
    id: string;
    type: string;
    from: string;
    to: string;
    properties?: IDataObject;
}
export interface EntityExtractionResult {
    entities: GraphEntity[];
    relationships: GraphRelationship[];
}
export declare class AIEntityExtractor {
    private aiModel;
    private logger;
    constructor(aiModel: any, logger?: any);
    extractEntitiesAndRelationships(text: string): Promise<EntityExtractionResult>;
    generateContextQuery(inputText: string, availableEntityTypes: string[], availableRelationships: string[]): Promise<string>;
}
export declare class SimpleNLPExtractor {
    private static readonly ENTITY_PATTERNS;
    private static readonly RELATIONSHIP_PATTERNS;
    static extractEntitiesAndRelationships(text: string): EntityExtractionResult;
}
export declare class FalkorDbKnowledgeGraphStore {
    private graphName;
    private _credentials;
    private httpRequest;
    private logger;
    private aiExtractor?;
    constructor(config: {
        graphName: string;
        credentials: IDataObject;
        aiModel?: any;
        httpRequest: (options: IRequestOptions) => Promise<any>;
        logger?: any;
    });
    processText(text: string): Promise<void>;
    private createOrUpdateEntity;
    private createRelationship;
    queryGraph(cypherQuery: string, parameters?: IDataObject): Promise<any[]>;
    enrichFromMessage(message: string, sessionId?: string): Promise<{
        entities: number;
        relationships: number;
    }>;
    getContextForMessage(message: string, maxResults?: number): Promise<string[]>;
    private createOrUpdateEntityWithSession;
    private createRelationshipWithSession;
    private executeQuery;
}
export declare class FalkorDbKnowledgeGraphMemory extends BaseChatMemory {
    memoryKeys: string[];
    returnMessages: boolean;
    inputKey: string;
    outputKey: string;
    private sessionId;
    private _graphName;
    private contextWindowLength;
    private _credentials;
    private memoryKey;
    private httpRequest;
    private logger;
    constructor(config: {
        sessionId: string;
        graphName: string;
        contextWindowLength: number;
        credentials: IDataObject;
        memoryKey?: string;
        inputKey?: string;
        outputKey?: string;
        returnMessages?: boolean;
        httpRequest: (options: IRequestOptions) => Promise<any>;
        logger?: any;
    });
    loadMemoryVariables(values: InputValues): Promise<MemoryVariables>;
    saveContext(input: InputValues, output: OutputValues): Promise<void>;
    clear(): Promise<void>;
    private getMessages;
    private addMessage;
    private extractKnowledgeFromConversation;
    private getRelevantContext;
    private enrichWithKnowledgeGraph;
    private formatContextAsString;
    private createOrUpdateEntity;
    private createRelationship;
    private executeQuery;
}
export declare function getSessionCookies(baseURL: string, username: string, password: string, httpRequest: (options: IRequestOptions) => Promise<any>, logger?: any): Promise<string>;
export declare function getSessionId(context: any, itemIndex: number): string;
export declare function getConnectionHintNoticeField(connectionTypes: string[]): any;
