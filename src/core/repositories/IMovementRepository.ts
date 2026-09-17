import { Movement } from '../entities/Movement.ts';
import { ImportBatch } from '../entities/ImportBatch.ts';

export interface IMovementRepository {
  save(movement: Movement): Promise<void>;
  addAll(movements: Movement[]): Promise<void>;
  getAll(): Promise<Movement[]>;
  getByAsset(ticker: string): Promise<Movement[]>;
  getIncomes(): Promise<Movement[]>;
  getByBatchId(batchId: string): Promise<Movement[]>;
  removeByBatchId(batchId: string): Promise<void>;
  removeAll(): Promise<void>;
  saveBatch(batch: ImportBatch): Promise<void>;
  getBatches(): Promise<ImportBatch[]>;
  getLastBatch(): Promise<ImportBatch | null>;
  removeBatch(batchId: string): Promise<void>;
}
