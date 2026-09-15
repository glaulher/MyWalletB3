import { Asset } from '../entities/Asset.ts';
import { Operation } from '../entities/Operation.ts';
import { ImportBatch } from '../entities/ImportBatch.ts';
import { IOperationRepository } from '../repositories/IOperationRepository.ts';
import { IAssetRepository } from '../repositories/IAssetRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { PersistentAssetRepository } from '../../infrastructure/repositories/PersistentAssetRepository.ts';

export interface BackupPayload {
  appName: string;
  version: string;
  exportedAt: string;
  stats: {
    assetCount: number;
    operationCount: number;
    batchCount: number;
  };
  data: {
    assets: { ticker: string; type: string; sector?: string }[];
    batches: { id: string; fileName: string; importedAt: string; operationCount: number }[];
    operations: {
      id: string;
      date: string;
      asset: string;
      type: string;
      quantity: number;
      unitPrice: number;
      fees: number;
      institution?: string;
      batchId?: string;
    }[];
  };
}

export class BackupService {
  constructor(
    private operationRepo: IOperationRepository = new PersistentOperationRepository(),
    private assetRepo: IAssetRepository = new PersistentAssetRepository(),
  ) {}

  /**
   * Generates a formatted JSON string representing a complete database snapshot.
   */
  async exportBackup(): Promise<string> {
    const assets = await this.assetRepo.getAll();
    const operations = await this.operationRepo.getAll();
    const batches = await this.operationRepo.getBatches();

    const payload: BackupPayload = {
      appName: 'MyWalletB3',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      stats: {
        assetCount: assets.length,
        operationCount: operations.length,
        batchCount: batches.length,
      },
      data: {
        assets: assets.map((a) => ({
          ticker: a.ticker,
          type: a.type,
          sector: a.sector,
        })),
        batches: batches.map((b) => ({
          id: b.id,
          fileName: b.fileName,
          importedAt: b.importedAt.toISOString(),
          operationCount: b.operationCount,
        })),
        operations: operations.map((op) => ({
          id: op.id,
          date: op.date.toISOString(),
          asset: op.asset,
          type: op.type,
          quantity: op.quantity,
          unitPrice: op.unitPrice,
          fees: op.fees,
          institution: op.institution,
          batchId: op.batchId,
        })),
      },
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Restores a database snapshot from a JSON backup string.
   */
  async importBackup(
    jsonString: string,
    mode: 'overwrite' | 'merge' = 'overwrite',
  ): Promise<{ assetsRestored: number; operationsRestored: number; batchesRestored: number }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Arquivo de backup inválido: formato JSON corrompido.');
    }

    const payload = parsed as Partial<BackupPayload>;
    if (
      !payload.data ||
      !Array.isArray(payload.data.operations) ||
      !Array.isArray(payload.data.assets)
    ) {
      throw new Error('Estrutura de dados de backup incompatível ou ausente.');
    }

    if (mode === 'overwrite') {
      await this.operationRepo.clear();
    }

    // Restore Assets
    const restoredAssets = payload.data.assets.map(
      (a) => new Asset(a.ticker, a.type as 'stock' | 'fii' | 'bdr', a.sector || ''),
    );
    await this.assetRepo.saveAll(restoredAssets);

    // Restore Batches
    const restoredBatches = (payload.data.batches || []).map(
      (b) => new ImportBatch(b.id, b.fileName, new Date(b.importedAt), b.operationCount),
    );
    for (const batch of restoredBatches) {
      await this.operationRepo.saveBatch(batch);
    }

    // Restore Operations
    const restoredOperations = payload.data.operations.map(
      (op) =>
        new Operation(
          op.id,
          new Date(op.date),
          op.asset,
          op.type as 'buy' | 'sell',
          op.quantity,
          op.unitPrice,
          op.fees || 0,
          op.institution,
          op.batchId,
        ),
    );
    await this.operationRepo.addAll(restoredOperations);

    return {
      assetsRestored: restoredAssets.length,
      operationsRestored: restoredOperations.length,
      batchesRestored: restoredBatches.length,
    };
  }

  /**
   * Helper to trigger a browser file download of the backup JSON file.
   */
  downloadBackupFile(jsonString: string, filename?: string): void {
    const defaultName = `mywalletb3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
