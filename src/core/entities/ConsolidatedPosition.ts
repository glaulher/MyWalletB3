import { AssetType } from './Asset.ts';

export class ConsolidatedPosition {
  constructor(
    public readonly ticker: string,
    public readonly quantity: number,
    public readonly averagePrice: number,
    public readonly totalCost: number,
    public readonly type?: AssetType,
  ) {}
}
