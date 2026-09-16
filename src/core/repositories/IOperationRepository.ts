import { Operation } from '../entities/Operation.ts';
import { ImportBatch } from '../entities/ImportBatch.ts';

export interface IOperationRepository {
  getAll(): Promise<Operation[]>;
  add(operation: Operation): Promise<void>;
  addAll(operations: Operation[]): Promise<void>;
  clear(): Promise<void>;
  removeByBatchId(batchId: string): Promise<void>;
  removeOperation(id: string): Promise<void>;
  removeOperations(ids: string[]): Promise<void>;
  getBatches(): Promise<ImportBatch[]>;
  saveBatch(batch: ImportBatch): Promise<void>;
  getLastBatch(): Promise<ImportBatch | null>;
  removeBatch(batchId: string): Promise<void>;
}
