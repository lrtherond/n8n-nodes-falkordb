import type { IDataObject, IRequestOptions } from 'n8n-workflow';
export interface Document {
    pageContent: string;
    metadata?: IDataObject;
}
export interface ChatMessage {
    type: 'human' | 'ai' | 'system';
    content: string;
    timestamp?: Date;
}
export interface MemoryVariables {
    [key: string]: string | ChatMessage[];
}
export interface InputValues {
    [key: string]: any;
}
export interface OutputValues {
    [key: string]: any;
}
export declare abstract class BaseChatMemory {
    abstract loadMemoryVariables(values: InputValues): Promise<MemoryVariables>;
    abstract saveContext(input: InputValues, output: OutputValues): Promise<void>;
    abstract clear(): Promise<void>;
}
export declare abstract class VectorStore {
    abstract addDocuments(documents: Document[]): Promise<void>;
    abstract similaritySearch(query: string, k: number, filter?: IDataObject): Promise<Document[]>;
    abstract delete(ids: string[]): Promise<void>;
}
export declare class FalkorDbChatMemory extends BaseChatMemory {
    private sessionId;
    private _graphName;
    private contextWindowLength;
    private _credentials;
    private memoryKey;
    private inputKey;
    private outputKey;
    private returnMessages;
    private httpRequest;
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
    });
    loadMemoryVariables(_values: InputValues): Promise<MemoryVariables>;
    saveContext(input: InputValues, output: OutputValues): Promise<void>;
    clear(): Promise<void>;
    private getMessages;
    private addMessage;
    private executeQuery;
    private getSessionCookies;
}
export declare class FalkorDbVectorStore extends VectorStore {
    private graphName;
    private nodeLabel;
    private _dimensions;
    private _credentials;
    private _distanceMetric;
    private similarityThreshold;
    private httpRequest;
    constructor(config: {
        graphName: string;
        nodeLabel: string;
        dimensions: number;
        credentials: IDataObject;
        distanceMetric?: string;
        similarityThreshold?: number;
        httpRequest: (options: IRequestOptions) => Promise<any>;
    });
    addDocuments(documents: Document[]): Promise<void>;
    similaritySearch(query: string, k: number, filter?: IDataObject): Promise<Document[]>;
    delete(ids: string[]): Promise<void>;
    private generatePlaceholderEmbedding;
    static fromDocuments(documents: Document[], _embeddings: any, config: any): Promise<FalkorDbVectorStore>;
    private executeQuery;
    private getSessionCookies;
}
export declare function getSessionId(context: any, itemIndex: number): string;
export declare function getConnectionHintNoticeField(_connectionTypes: string[]): any;
export declare function logWrapper(instance: any, _context: any): any;
