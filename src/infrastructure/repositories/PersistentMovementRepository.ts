import { Movement } from '../../core/entities/Movement.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';
import { IMovementRepository } from '../../core/repositories/IMovementRepository.ts';
import { AppDatabase, IDatabaseAdapter } from '../database/DatabaseAdapter.ts';

export class PersistentMovementRepository implements IMovementRepository {
  private static cachedMovements: Movement[] | null = null;
  private static cachedBatches: ImportBatch[] | null = null;

  private db: IDatabaseAdapter;
  private initialized = false;

  constructor(db?: IDatabaseAdapter) {
    this.db = db || new AppDatabase();
  }

  static invalidateCache(): void {
    PersistentMovementRepository.cachedMovements = null;
    PersistentMovementRepository.cachedBatches = null;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.db.init();
      this.initialized = true;
    }
  }

  async getAll(): Promise<Movement[]> {
    if (PersistentMovementRepository.cachedMovements !== null) {
      return PersistentMovementRepository.cachedMovements;
    }
    await this.ensureInit();
    const movs = await this.db.getMovements();
    PersistentMovementRepository.cachedMovements = movs;
    return movs;
  }

  async save(movement: Movement): Promise<void> {
    await this.ensureInit();
    await this.db.saveMovements([movement]);
    PersistentMovementRepository.invalidateCache();
  }

  async addAll(movements: Movement[]): Promise<void> {
    await this.ensureInit();
    await this.db.saveMovements(movements);
    PersistentMovementRepository.invalidateCache();
  }

  async getByAsset(ticker: string): Promise<Movement[]> {
    const all = await this.getAll();
    const clean = ticker.toUpperCase().trim();
    return all.filter((m) => m.asset.toUpperCase() === clean);
  }

  async getIncomes(): Promise<Movement[]> {
    const all = await this.getAll();
    return all.filter((m) => m.isIncome);
  }

  async getByBatchId(batchId: string): Promise<Movement[]> {
    const all = await this.getAll();
    return all.filter((m) => m.batchId === batchId);
  }

  async removeByBatchId(batchId: string): Promise<void> {
    await this.ensureInit();
    await this.db.removeMovementsByBatchId(batchId);
    PersistentMovementRepository.invalidateCache();
  }

  async removeAll(): Promise<void> {
    await this.ensureInit();
    const all = await this.getAll();
    if (all.length > 0) {
      await this.db.removeMovements(all.map((m) => m.id));
    }
    PersistentMovementRepository.invalidateCache();
  }

  async getBatches(): Promise<ImportBatch[]> {
    if (PersistentMovementRepository.cachedBatches !== null) {
      return PersistentMovementRepository.cachedBatches;
    }
    await this.ensureInit();
    const batches = await this.db.getBatches();
    PersistentMovementRepository.cachedBatches = batches;
    return batches;
  }

  async saveBatch(batch: ImportBatch): Promise<void> {
    await this.ensureInit();
    await this.db.saveBatch(batch);
    PersistentMovementRepository.cachedBatches = null;
  }

  async getLastBatch(): Promise<ImportBatch | null> {
    const batches = await this.getBatches();
    return batches.length > 0 ? batches[0] : null;
  }

  async removeBatch(batchId: string): Promise<void> {
    await this.ensureInit();
    await this.db.removeBatch(batchId);
    await this.removeByBatchId(batchId);
    PersistentMovementRepository.invalidateCache();
  }
}
