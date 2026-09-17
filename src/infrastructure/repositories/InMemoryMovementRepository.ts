import { Movement } from '../../core/entities/Movement.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';
import { IMovementRepository } from '../../core/repositories/IMovementRepository.ts';

export class InMemoryMovementRepository implements IMovementRepository {
  private movements: Movement[] = [];
  private batches: ImportBatch[] = [];

  async save(movement: Movement): Promise<void> {
    const existingIdx = this.movements.findIndex((m) => m.id === movement.id);
    if (existingIdx >= 0) {
      this.movements[existingIdx] = movement;
    } else {
      this.movements.push(movement);
    }
  }

  async addAll(movements: Movement[]): Promise<void> {
    for (const mov of movements) {
      await this.save(mov);
    }
  }

  async getAll(): Promise<Movement[]> {
    return [...this.movements];
  }

  async getByAsset(ticker: string): Promise<Movement[]> {
    const clean = ticker.toUpperCase().trim();
    return this.movements.filter((m) => m.asset.toUpperCase() === clean);
  }

  async getIncomes(): Promise<Movement[]> {
    return this.movements.filter((m) => m.isIncome);
  }

  async getByBatchId(batchId: string): Promise<Movement[]> {
    return this.movements.filter((m) => m.batchId === batchId);
  }

  async removeByBatchId(batchId: string): Promise<void> {
    this.movements = this.movements.filter((m) => m.batchId !== batchId);
  }

  async removeAll(): Promise<void> {
    this.movements = [];
    this.batches = [];
  }

  async saveBatch(batch: ImportBatch): Promise<void> {
    this.batches.push(batch);
  }

  async getBatches(): Promise<ImportBatch[]> {
    return [...this.batches]
      .reverse()
      .sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());
  }

  async getLastBatch(): Promise<ImportBatch | null> {
    const batches = await this.getBatches();
    return batches.length > 0 ? batches[0] : null;
  }

  async removeBatch(batchId: string): Promise<void> {
    this.batches = this.batches.filter((b) => b.id !== batchId);
    await this.removeByBatchId(batchId);
  }
}
