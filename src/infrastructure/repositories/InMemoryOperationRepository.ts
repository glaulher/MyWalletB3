import { Operation } from '../../core/entities/Operation.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';

export class InMemoryOperationRepository implements IOperationRepository {
  private operations: Operation[] = [];
  private batches: ImportBatch[] = [];

  async getAll(): Promise<Operation[]> {
    return [...this.operations];
  }

  async add(operation: Operation): Promise<void> {
    this.operations.push(operation);
  }

  async addAll(operations: Operation[]): Promise<void> {
    this.operations.push(...operations);
  }

  async clear(): Promise<void> {
    this.operations = [];
    this.batches = [];
  }

  async removeByBatchId(batchId: string): Promise<void> {
    this.operations = this.operations.filter((op) => op.batchId !== batchId);
  }

  async removeOperation(id: string): Promise<void> {
    this.operations = this.operations.filter((op) => op.id !== id);
  }

  async removeOperations(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.operations = this.operations.filter((op) => !idSet.has(op.id));
  }

  async getBatches(): Promise<ImportBatch[]> {
    return [...this.batches].sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());
  }

  async saveBatch(batch: ImportBatch): Promise<void> {
    this.batches.push(batch);
  }

  async getLastBatch(): Promise<ImportBatch | null> {
    if (this.batches.length === 0) return null;
    const sorted = await this.getBatches();
    return sorted[0];
  }

  async removeBatch(batchId: string): Promise<void> {
    this.batches = this.batches.filter((b) => b.id !== batchId);
    await this.removeByBatchId(batchId);
  }
}
