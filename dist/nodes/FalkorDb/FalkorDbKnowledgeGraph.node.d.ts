import type { ISupplyDataFunctions, IExecuteFunctions, INodeType, INodeTypeDescription, SupplyData, INodeExecutionData } from 'n8n-workflow';
export declare class FalkorDbVectorStore implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
    supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData>;
}
