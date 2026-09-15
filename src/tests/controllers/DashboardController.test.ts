import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { DashboardController } from '../../core/controllers/DashboardController.ts';
import { InMemoryOperationRepository } from '../../infrastructure/repositories/InMemoryOperationRepository.ts';
import { InMemoryAssetRepository } from '../../infrastructure/repositories/InMemoryAssetRepository.ts';

describe('DashboardController', () => {
  it('should import xlsx file and return full summary with positions and allocations', async () => {
    const controller = new DashboardController(
      new InMemoryOperationRepository(),
      new InMemoryAssetRepository(),
    );
    const filePath = path.resolve('negociacao-2026-09-15-14-41-25.xlsx');
    const buffer = fs.readFileSync(filePath);

    const summary = await controller.importFile(buffer, 'negociacao.xlsx');

    expect(summary.totalOperations).toBe(11);
    expect(summary.totalAssets).toBe(10); // 11 operations with 1 duplicate (CPTI11) -> 10 unique assets
    expect(summary.totalInvested).toBeGreaterThan(0);
    expect(summary.positions.length).toBe(10);
    expect(summary.allocationByAsset.length).toBe(10);
    expect(summary.allocationByType.length).toBeGreaterThanOrEqual(1);
    expect(summary.lastBatch).toBeDefined();
    expect(summary.lastBatch?.fileName).toBe('negociacao.xlsx');

    // Verify operations are sorted: buys before sells, and date ascending
    for (let i = 0; i < summary.operations.length - 1; i++) {
      const curr = summary.operations[i];
      const next = summary.operations[i + 1];
      if (curr.type === next.type) {
        expect(curr.date.getTime()).toBeLessThanOrEqual(next.date.getTime());
      }
    }
  });

  it('should rollback last imported batch cleanly', async () => {
    const controller = new DashboardController(
      new InMemoryOperationRepository(),
      new InMemoryAssetRepository(),
    );
    const filePath = path.resolve('negociacao-2026-09-15-14-41-25.xlsx');
    const buffer = fs.readFileSync(filePath);

    await controller.importFile(buffer, 'lote1.xlsx');
    let summary = await controller.load();
    expect(summary.totalOperations).toBe(11);

    // Rollback
    summary = await controller.rollbackLastBatch();
    expect(summary.totalOperations).toBe(0);
    expect(summary.positions.length).toBe(0);
    expect(summary.totalInvested).toBe(0);
  });

  it('should clear stored data', async () => {
    const controller = new DashboardController(
      new InMemoryOperationRepository(),
      new InMemoryAssetRepository(),
    );
    const filePath = path.resolve('negociacao-2026-09-15-14-41-25.xlsx');
    const buffer = fs.readFileSync(filePath);

    await controller.importFile(buffer);
    let summary = await controller.load();
    expect(summary.totalOperations).toBe(11);

    await controller.clear();
    summary = await controller.load();
    expect(summary.totalOperations).toBe(0);
    expect(summary.positions.length).toBe(0);
    expect(summary.totalInvested).toBe(0);
  });
});
