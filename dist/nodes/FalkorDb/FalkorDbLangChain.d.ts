import type { IDataObject } from 'n8n-workflow';
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
    constructor(config: {
        sessionId: string;
        graphName: string;
        contextWindowLength: number;
        credentials: IDataObject;
        memoryKey?: string;
        inputKey?: string;
        outputKey?: string;
        returnMessages?: boolean;
    });
    loadMemoryVariables(_values: InputValues): Promise<MemoryVariables>;
    saveContext(input: InputValues, output: OutputValues): Promise<void>;
    clear(): Promise<void>;
    private getMessages;
    private addMessage;
    private executeQuery;
}
export declare class FalkorDbVectorStore extends VectorStore {
    private collectionName;
    private _dimensions;
    private _credentials;
    private _distanceMetric;
    private similarityThreshold;
    constructor(config: {
        collectionName: string;
        dimensions: number;
        credentials: IDataObject;
        distanceMetric?: string;
        similarityThreshold?: number;
    });
    addDocuments(documents: Document[]): Promise<void>;
    similaritySearch(_query: string, k: number, filter?: IDataObject): Promise<Document[]>;
    delete(ids: string[]): Promise<void>;
    static fromDocuments(documents: Document[], _embeddings: any, config: any): Promise<FalkorDbVectorStore>;
    private executeQuery;
}
export declare function getSessionId(context: any, itemIndex: number): string;
export declare function getConnectionHintNoticeField(_connectionTypes: string[]): any;
export declare function logWrapper(instance: any, _context: any): any;
