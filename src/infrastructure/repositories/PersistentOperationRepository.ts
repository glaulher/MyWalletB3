import { Operation } from '../../core/entities/Operation.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { AppDatabase, IDatabaseAdapter } from '../database/DatabaseAdapter.ts';

export class PersistentOperationRepository implements IOperationRepository {
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

  async getAll(): Promise<Operation[]> {
    await this.ensureInit();
    return this.db.getOperations();
  }

  async add(operation: Operation): Promise<void> {
    await this.ensureInit();
    await this.db.saveOperations([operation]);
  }

  async addAll(operations: Operation[]): Promise<void> {
    await this.ensureInit();
    await this.db.saveOperations(operations);
  }

  async clear(): Promise<void> {
    await this.ensureInit();
    await this.db.clear();
  }

  async removeByBatchId(batchId: string): Promise<void> {
    await this.ensureInit();
    await this.db.removeOperationsByBatchId(batchId);
  }

  async getBatches(): Promise<ImportBatch[]> {
    await this.ensureInit();
    return this.db.getBatches();
  }

  async saveBatch(batch: ImportBatch): Promise<void> {
    await this.ensureInit();
    await this.db.saveBatch(batch);
  }

  async getLastBatch(): Promise<ImportBatch | null> {
    await this.ensureInit();
    const batches = await this.db.getBatches();
    return batches.length > 0 ? batches[0] : null;
  }

  async removeBatch(batchId: string): Promise<void> {
    await this.ensureInit();
    await this.db.removeBatch(batchId);
  }
}
