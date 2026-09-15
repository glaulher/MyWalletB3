import { Asset } from '../../core/entities/Asset.ts';
import { IAssetRepository } from '../../core/repositories/IAssetRepository.ts';
import { AppDatabase, IDatabaseAdapter } from '../database/DatabaseAdapter.ts';

export class PersistentAssetRepository implements IAssetRepository {
  private db: IDatabaseAdapter;
  private initialized = false;

  constructor(db?: IDatabaseAdapter) {
    this.db = db || new AppDatabase();
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.db.init();
      this.initialized = true;
    }
  }

  async getAll(): Promise<Asset[]> {
    await this.ensureInit();
    return this.db.getAssets();
  }

  async findByTicker(ticker: string): Promise<Asset | null> {
    await this.ensureInit();
    return this.db.findAssetByTicker(ticker);
  }

  async save(asset: Asset): Promise<void> {
    await this.ensureInit();
    await this.db.saveAssets([asset]);
  }

  async saveAll(assets: Asset[]): Promise<void> {
    await this.ensureInit();
    await this.db.saveAssets(assets);
  }
}
