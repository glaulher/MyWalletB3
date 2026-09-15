import { Asset } from '../../core/entities/Asset.ts';
import { IAssetRepository } from '../../core/repositories/IAssetRepository.ts';

export class InMemoryAssetRepository implements IAssetRepository {
  private assets: Map<string, Asset> = new Map();

  async getAll(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }

  async findByTicker(ticker: string): Promise<Asset | null> {
    return this.assets.get(ticker.toUpperCase()) ?? null;
  }

  async save(asset: Asset): Promise<void> {
    this.assets.set(asset.ticker.toUpperCase(), asset);
  }

  async saveAll(assets: Asset[]): Promise<void> {
    for (const asset of assets) {
      await this.save(asset);
    }
  }
}
