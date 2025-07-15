import type { ISupplyDataFunctions, INodeType, INodeTypeDescription, SupplyData } from 'n8n-workflow';
export declare class FalkorDbMemory implements INodeType {
    description: INodeTypeDescription;
    supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData>;
}
