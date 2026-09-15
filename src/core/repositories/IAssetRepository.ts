import { Asset } from '../entities/Asset.ts';

export interface IAssetRepository {
  getAll(): Promise<Asset[]>;
  findByTicker(ticker: string): Promise<Asset | null>;
  save(asset: Asset): Promise<void>;
  saveAll(assets: Asset[]): Promise<void>;
}
