import { Asset } from '../../core/entities/Asset.ts';
import { IAssetRepository } from '../../core/repositories/IAssetRepository.ts';
import { AppDatabase, IDatabaseAdapter } from '../database/DatabaseAdapter.ts';

export class PersistentAssetRepository implements IAssetRepository {
  private static cachedAssets: Asset[] | null = null;

  private db: IDatabaseAdapter;
  private initialized = false;

  constructor(db?: IDatabaseAdapter) {
    this.db = db || new AppDatabase();
  }

  static invalidateCache(): void {
    PersistentAssetRepository.cachedAssets = null;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.db.init();
      this.initialized = true;
    }
  }

  async getAll(): Promise<Asset[]> {
    if (PersistentAssetRepository.cachedAssets !== null) {
      return PersistentAssetRepository.cachedAssets;
    }
    await this.ensureInit();
    const assets = await this.db.getAssets();
    PersistentAssetRepository.cachedAssets = assets;
    return assets;
  }

  async findByTicker(ticker: string): Promise<Asset | null> {
    const assets = await this.getAll();
    return assets.find((a) => a.ticker.toUpperCase() === ticker.toUpperCase()) || null;
  }

  async save(asset: Asset): Promise<void> {
    await this.ensureInit();
    await this.db.saveAssets([asset]);
    PersistentAssetRepository.invalidateCache();
  }

  async saveAll(assets: Asset[]): Promise<void> {
    await this.ensureInit();
    await this.db.saveAssets(assets);
    PersistentAssetRepository.invalidateCache();
  }
}
