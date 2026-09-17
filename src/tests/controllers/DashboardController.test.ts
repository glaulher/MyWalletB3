import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { DashboardController } from '../../core/controllers/DashboardController.ts';
import { InMemoryOperationRepository } from '../../infrastructure/repositories/InMemoryOperationRepository.ts';
import { InMemoryAssetRepository } from '../../infrastructure/repositories/InMemoryAssetRepository.ts';
import { InMemoryMovementRepository } from '../../infrastructure/repositories/InMemoryMovementRepository.ts';

describe('DashboardController', () => {
  it('should import xlsx file and return full summary with positions and allocations', async () => {
    const controller = new DashboardController(
      new InMemoryOperationRepository(),
      new InMemoryAssetRepository(),
      new InMemoryMovementRepository(),
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
      new InMemoryMovementRepository(),
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
      new InMemoryMovementRepository(),
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

  it('should import movement csv and return income metrics with Yield on Cost', async () => {
    const opRepo = new InMemoryOperationRepository();
    const assetRepo = new InMemoryAssetRepository();
    const movRepo = new InMemoryMovementRepository();
    const controller = new DashboardController(opRepo, assetRepo, movRepo);

    // Import trade first to have custody position
    const tradeCsv = `Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor
10/01/2024;Compra;Mercado à Vista;;XP INVESTIMENTOS;CPTI11;100;10,00;1.000,00`;
    await controller.importFile(tradeCsv, 'trade.csv');

    // Import movement CSV
    const movCsv = `Entrada/Saída;Data;Movimentação;Produto;Instituição;Quantidade;Preço unitário;Valor da Operação
Credito;15/02/2024;Rendimento;CPTI11 - CAPITÂNIA SECURITIES II FII;XP INVESTIMENTOS;100;1,05;105,00
Credito;15/03/2024;Rendimento;CPTI11 - CAPITÂNIA SECURITIES II FII;XP INVESTIMENTOS;100;1,10;110,00`;

    const movResult = await controller.importMovementFile(movCsv, 'mov.csv');
    expect(movResult.totalMovements).toBe(2);
    expect(movResult.totalIncomes).toBe(2);
    expect(movResult.totalReceived).toBe(215);

    const metrics = await controller.loadIncomeMetrics();
    expect(metrics.totalReceived).toBe(215);
    expect(metrics.totalYields).toBe(215);
    expect(metrics.monthlyEvolution.length).toBe(2);

    const cptiSummary = metrics.assetSummaries.find((a) => a.ticker === 'CPTI11');
    expect(cptiSummary).toBeDefined();
    expect(cptiSummary!.totalIncome).toBe(215);
    expect(cptiSummary!.currentTotalCost).toBe(1000);
    expect(cptiSummary!.yieldOnCost).toBeCloseTo(21.5, 1); // 215 / 1000 = 21.5%
  });

  it('should import multiple files simultaneously with progress callback and register batches individually', async () => {
    const opRepo = new InMemoryOperationRepository();
    const assetRepo = new InMemoryAssetRepository();
    const movRepo = new InMemoryMovementRepository();
    const controller = new DashboardController(opRepo, assetRepo, movRepo);

    const tradeCsv = `Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor
10/01/2024;Compra;Mercado à Vista;;XP INVESTIMENTOS;CPTI11;100;10,00;1.000,00
11/01/2024;Compra;Mercado à Vista;;XP INVESTIMENTOS;PETR4;50;30,00;1.500,00`;

    const movCsv = `Entrada/Saída;Data;Movimentação;Produto;Instituição;Quantidade;Preço unitário;Valor da Operação
Credito;15/02/2024;Rendimento;CPTI11 - CAPITÂNIA SECURITIES II FII;XP INVESTIMENTOS;100;1,05;105,00
Credito;15/03/2024;Rendimento;CPTI11 - CAPITÂNIA SECURITIES II FII;XP INVESTIMENTOS;100;1,10;110,00`;

    const progressLog: Array<{ current: number; total: number; fileName: string }> = [];

    const res = await controller.importMultipleFiles(
      [
        { buffer: tradeCsv, name: 'negociacao_2024.csv' },
        { buffer: movCsv, name: 'movimentacao_2024.csv' },
      ],
      (current, total, fileName) => {
        progressLog.push({ current, total, fileName });
      },
    );

    expect(progressLog.length).toBe(2);
    expect(progressLog[0]).toEqual({ current: 1, total: 2, fileName: 'negociacao_2024.csv' });
    expect(progressLog[1]).toEqual({ current: 2, total: 2, fileName: 'movimentacao_2024.csv' });

    expect(res.totalFiles).toBe(2);
    expect(res.tradeFiles).toBe(1);
    expect(res.movementFiles).toBe(1);
    expect(res.totalOperations).toBe(2);
    expect(res.totalMovements).toBe(2);
    expect(res.totalIncomes).toBe(2);
    expect(res.totalReceived).toBe(215);
    expect(res.errors.length).toBe(0);

    // Consolidated summary should have 2 positions and 2 operations
    expect(res.summary.totalOperations).toBe(2);
    expect(res.summary.positions.length).toBe(2);
    expect(res.summary.totalInvested).toBe(2500); // 1000 + 1500

    // Batches should be recorded individually
    const opBatches = await opRepo.getBatches();
    expect(opBatches.length).toBe(1);
    expect(opBatches[0].fileName).toBe('negociacao_2024.csv');

    const movBatches = await movRepo.getBatches();
    expect(movBatches.length).toBe(1);
    expect(movBatches[0].fileName).toBe('movimentacao_2024.csv');
  });

  it('should deduplicate operations when the same file or identical trades are reimported', async () => {
    const opRepo = new InMemoryOperationRepository();
    const assetRepo = new InMemoryAssetRepository();
    const movRepo = new InMemoryMovementRepository();
    const controller = new DashboardController(opRepo, assetRepo, movRepo);

    const tradeCsv = `Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor
10/01/2024;Compra;Mercado à Vista;;XP INVESTIMENTOS;CPTI11;100;10,00;1.000,00
11/01/2024;Compra;Mercado à Vista;;XP INVESTIMENTOS;PETR4;50;30,00;1.500,00`;

    // First import
    await controller.importFile(tradeCsv, 'trade1.csv');
    let summary = await controller.load();
    expect(summary.totalOperations).toBe(2);
    expect(summary.positions.length).toBe(2);

    // Reimporting the exact same operations in a new file (or duplicate file)
    await controller.importFile(tradeCsv, 'trade1_duplicate.csv');
    summary = await controller.load();

    // Idempotent: deterministic IDs prevent duplicate counting of operations
    expect(summary.totalOperations).toBe(2);
    expect(summary.positions.length).toBe(2);
    expect(summary.totalInvested).toBe(2500);
  });

  it('should allow rolling back an individual batch when multiple files were imported', async () => {
    const opRepo = new InMemoryOperationRepository();
    const assetRepo = new InMemoryAssetRepository();
    const movRepo = new InMemoryMovementRepository();
    const controller = new DashboardController(opRepo, assetRepo, movRepo);

    const tradeCsv1 = `Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor
10/01/2024;Compra;Mercado à Vista;;XP INVESTIMENTOS;CPTI11;100;10,00;1.000,00`;

    const tradeCsv2 = `Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor
11/01/2024;Compra;Mercado à Vista;;XP INVESTIMENTOS;PETR4;50;30,00;1.500,00`;

    // Import multiple files
    await controller.importMultipleFiles([
      { buffer: tradeCsv1, name: 'lote_cpti.csv' },
      { buffer: tradeCsv2, name: 'lote_petr.csv' },
    ]);

    let summary = await controller.load();
    expect(summary.totalOperations).toBe(2);
    expect(summary.positions.length).toBe(2);

    // Rollback the last batch (lote_petr.csv)
    summary = await controller.rollbackLastBatch();
    expect(summary.totalOperations).toBe(1);
    expect(summary.positions.length).toBe(1);
    expect(summary.positions[0].ticker).toBe('CPTI11');
    expect(summary.totalInvested).toBe(1000);

    // Rollback the remaining batch (lote_cpti.csv)
    summary = await controller.rollbackLastBatch();
    expect(summary.totalOperations).toBe(0);
    expect(summary.positions.length).toBe(0);
    expect(summary.totalInvested).toBe(0);
  });
});
