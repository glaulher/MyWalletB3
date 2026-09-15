export type AssetType = 'stock' | 'fii' | 'fi-infra' | 'bdr' | 'unit' | 'option';

export class Asset {
  constructor(
    public readonly ticker: string,
    public readonly type: AssetType,
    public readonly sector: string,
  ) {}
}
