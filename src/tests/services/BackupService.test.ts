import { describe, it, expect } from 'bun:test';
import { BackupService } from '../../core/services/BackupService.ts';
import { InMemoryOperationRepository } from '../../infrastructure/repositories/InMemoryOperationRepository.ts';
import { InMemoryAssetRepository } from '../../infrastructure/repositories/InMemoryAssetRepository.ts';
import { Operation } from '../../core/entities/Operation.ts';
import { Asset } from '../../core/entities/Asset.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';

describe('BackupService', () => {
  it('should export database to valid JSON string and restore cleanly', async () => {
    const opRepo = new InMemoryOperationRepository();
    const assetRepo = new InMemoryAssetRepository();
    const backupService = new BackupService(opRepo, assetRepo);

    // Seed data
    await assetRepo.save(new Asset('PETR4', 'stock', 'Petróleo'));
    await opRepo.saveBatch(new ImportBatch('b1', 'planilha1.xlsx', new Date(2026, 7, 10), 1));
    await opRepo.add(
      new Operation('op1', new Date(2026, 7, 10), 'PETR4', 'buy', 100, 30, 5, 'ITAU', 'b1'),
    );

    // Export
    const jsonString = await backupService.exportBackup();
    expect(jsonString).toContain('MyWalletB3');
    expect(jsonString).toContain('PETR4');
    expect(jsonString).toContain('planilha1.xlsx');

    // Create a new clean repo and restore
    const cleanOpRepo = new InMemoryOperationRepository();
    const cleanAssetRepo = new InMemoryAssetRepository();
    const cleanBackupService = new BackupService(cleanOpRepo, cleanAssetRepo);

    const result = await cleanBackupService.importBackup(jsonString);
    expect(result.assetsRestored).toBe(1);
    expect(result.operationsRestored).toBe(1);
    expect(result.batchesRestored).toBe(1);

    const restoredOps = await cleanOpRepo.getAll();
    expect(restoredOps.length).toBe(1);
    expect(restoredOps[0].asset).toBe('PETR4');
    expect(restoredOps[0].quantity).toBe(100);
    expect(restoredOps[0].unitPrice).toBe(30);
    expect(restoredOps[0].fees).toBe(5);
    expect(restoredOps[0].batchId).toBe('b1');

    const restoredAssets = await cleanAssetRepo.getAll();
    expect(restoredAssets.length).toBe(1);
    expect(restoredAssets[0].ticker).toBe('PETR4');
  });

  it('should throw error on invalid JSON string', async () => {
    const backupService = new BackupService(
      new InMemoryOperationRepository(),
      new InMemoryAssetRepository(),
    );

    expect(backupService.importBackup('invalid-json')).rejects.toThrow();
  });

  it('should preserve existing data and not clear if validation fails (atomic restore)', async () => {
    const opRepo = new InMemoryOperationRepository();
    const assetRepo = new InMemoryAssetRepository();
    const backupService = new BackupService(opRepo, assetRepo);

    await assetRepo.save(new Asset('VALE3', 'stock', 'Mineração'));
    await opRepo.add(
      new Operation('op_exist', new Date(2026, 5, 1), 'VALE3', 'buy', 50, 60, 0, 'BTG'),
    );

    const corruptBackup = JSON.stringify({
      appName: 'MyWalletB3',
      version: '1.0.0',
      data: {
        assets: [{ ticker: 'B3SA3', type: 'stock' }],
        operations: [{ id: 'op_bad', date: 'invalid-date', asset: 'B3SA3', type: 'buy' }],
      },
    });

    await expect(backupService.importBackup(corruptBackup)).rejects.toThrow(
      'Arquivo de backup corrompido: data de operação inválida.',
    );

    // Verify existing data was NOT wiped out
    const existingOps = await opRepo.getAll();
    expect(existingOps.length).toBe(1);
    expect(existingOps[0].asset).toBe('VALE3');
  });
});
