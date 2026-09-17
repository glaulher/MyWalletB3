import { Operation } from '../../core/entities/Operation.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { AppDatabase, IDatabaseAdapter } from '../database/DatabaseAdapter.ts';

export class PersistentOperationRepository implements IOperationRepository {
  private static cachedOperations: Operation[] | null = null;
  private static cachedBatches: ImportBatch[] | null = null;

  private db: IDatabaseAdapter;
  private initialized = false;

  constructor(db?: IDatabaseAdapter) {
    this.db = db || new AppDatabase();
  }

  static invalidateCache(): void {
    PersistentOperationRepository.cachedOperations = null;
    PersistentOperationRepository.cachedBatches = null;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.db.init();
      this.initialized = true;
    }
  }

  async getAll(): Promise<Operation[]> {
    if (PersistentOperationRepository.cachedOperations !== null) {
      return PersistentOperationRepository.cachedOperations;
    }
    await this.ensureInit();
    const ops = await this.db.getOperations();
    PersistentOperationRepository.cachedOperations = ops;
    return ops;
  }

  async add(operation: Operation): Promise<void> {
    await this.ensureInit();
    await this.db.saveOperations([operation]);
    PersistentOperationRepository.invalidateCache();
  }

  async addAll(operations: Operation[]): Promise<void> {
    await this.ensureInit();
    await this.db.saveOperations(operations);
    PersistentOperationRepository.invalidateCache();
  }

  async clear(): Promise<void> {
    await this.ensureInit();
    await this.db.clear();
    PersistentOperationRepository.invalidateCache();
  }

  async removeByBatchId(batchId: string): Promise<void> {
    await this.ensureInit();
    await this.db.removeOperationsByBatchId(batchId);
    PersistentOperationRepository.invalidateCache();
  }

  async removeOperation(id: string): Promise<void> {
    await this.ensureInit();
    await this.db.removeOperation(id);
    PersistentOperationRepository.invalidateCache();
  }

  async removeOperations(ids: string[]): Promise<void> {
    await this.ensureInit();
    await this.db.removeOperations(ids);
    PersistentOperationRepository.invalidateCache();
  }

  async getBatches(): Promise<ImportBatch[]> {
    if (PersistentOperationRepository.cachedBatches !== null) {
      return PersistentOperationRepository.cachedBatches;
    }
    await this.ensureInit();
    const batches = await this.db.getBatches();
    PersistentOperationRepository.cachedBatches = batches;
    return batches;
  }

  async saveBatch(batch: ImportBatch): Promise<void> {
    await this.ensureInit();
    await this.db.saveBatch(batch);
    PersistentOperationRepository.cachedBatches = null;
  }

  async getLastBatch(): Promise<ImportBatch | null> {
    const batches = await this.getBatches();
    return batches.length > 0 ? batches[0] : null;
  }

  async removeBatch(batchId: string): Promise<void> {
    await this.ensureInit();
    await this.db.removeBatch(batchId);
    PersistentOperationRepository.invalidateCache();
  }
}
