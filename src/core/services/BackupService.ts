import { Asset } from '../entities/Asset.ts';
import { Operation } from '../entities/Operation.ts';
import { ImportBatch } from '../entities/ImportBatch.ts';
import { Movement, MovementCategory, MovementDirection } from '../entities/Movement.ts';
import { IOperationRepository } from '../repositories/IOperationRepository.ts';
import { IAssetRepository } from '../repositories/IAssetRepository.ts';
import { IMovementRepository } from '../repositories/IMovementRepository.ts';

export interface BackupPayload {
  appName: string;
  version: string;
  exportedAt: string;
  stats: {
    assetCount: number;
    operationCount: number;
    batchCount: number;
    movementCount?: number;
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
    movements?: {
      id: string;
      date: string;
      movementType: string;
      category: string;
      direction: string;
      asset: string;
      rawProduct: string;
      quantity: number;
      unitPrice: number;
      totalValue: number;
      institution?: string;
      batchId?: string;
    }[];
  };
}

export class BackupService {
  constructor(
    private operationRepo: IOperationRepository,
    private assetRepo: IAssetRepository,
    private movementRepo?: IMovementRepository,
  ) {}

  /**
   * Generates a formatted JSON string representing a complete database snapshot.
   */
  async exportBackup(): Promise<string> {
    const assets = await this.assetRepo.getAll();
    const operations = await this.operationRepo.getAll();
    const batches = await this.operationRepo.getBatches();
    const movements = this.movementRepo ? await this.movementRepo.getAll() : [];

    const payload: BackupPayload = {
      appName: 'MyWalletB3',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      stats: {
        assetCount: assets.length,
        operationCount: operations.length,
        batchCount: batches.length,
        movementCount: movements.length,
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
        movements: movements.map((mov) => ({
          id: mov.id,
          date: mov.date.toISOString(),
          movementType: mov.movementType,
          category: mov.category,
          direction: mov.direction,
          asset: mov.asset,
          rawProduct: mov.rawProduct,
          quantity: mov.quantity,
          unitPrice: mov.unitPrice,
          totalValue: mov.totalValue,
          institution: mov.institution,
          batchId: mov.batchId,
        })),
      },
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Restores a database snapshot from a JSON backup string.
   * Validates the entire payload in memory before altering database state.
   */
  async importBackup(
    jsonString: string,
    mode: 'overwrite' | 'merge' = 'overwrite',
  ): Promise<{
    assetsRestored: number;
    operationsRestored: number;
    batchesRestored: number;
    movementsRestored: number;
  }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Arquivo de backup inválido: formato JSON corrompido.');
    }

    const payload = parsed as Partial<BackupPayload>;
    if (
      !payload ||
      payload.appName !== 'MyWalletB3' ||
      !payload.data ||
      !Array.isArray(payload.data.operations) ||
      !Array.isArray(payload.data.assets)
    ) {
      throw new Error('Estrutura de dados de backup incompatível ou não pertence ao MyWalletB3.');
    }

    // 1. Validate and construct all entities in memory first
    const restoredAssets: Asset[] = [];
    for (const a of payload.data.assets) {
      if (!a || !a.ticker || typeof a.ticker !== 'string') {
        throw new Error('Arquivo de backup corrompido: ativo sem ticker válido.');
      }
      restoredAssets.push(new Asset(a.ticker, a.type as 'stock' | 'fii' | 'bdr', a.sector || ''));
    }

    const restoredBatches: ImportBatch[] = [];
    for (const b of payload.data.batches || []) {
      if (!b || !b.id || !b.fileName) {
        throw new Error('Arquivo de backup corrompido: lote de importação inválido.');
      }
      const importedAt = new Date(b.importedAt);
      if (isNaN(importedAt.getTime())) {
        throw new Error('Arquivo de backup corrompido: data de lote inválida.');
      }
      restoredBatches.push(new ImportBatch(b.id, b.fileName, importedAt, b.operationCount || 0));
    }

    const restoredOperations: Operation[] = [];
    for (const op of payload.data.operations) {
      if (!op || !op.id || !op.asset || !op.type) {
        throw new Error('Arquivo de backup corrompido: operação com campos obrigatórios ausentes.');
      }
      const opDate = new Date(op.date);
      if (isNaN(opDate.getTime())) {
        throw new Error('Arquivo de backup corrompido: data de operação inválida.');
      }
      restoredOperations.push(
        new Operation(
          op.id,
          opDate,
          op.asset,
          op.type as 'buy' | 'sell',
          Number(op.quantity) || 0,
          Number(op.unitPrice) || 0,
          Number(op.fees) || 0,
          op.institution,
          op.batchId,
        ),
      );
    }

    const restoredMovements: Movement[] = [];
    if (Array.isArray(payload.data.movements)) {
      for (const m of payload.data.movements) {
        if (!m || !m.id || !m.movementType || !m.asset) {
          throw new Error(
            'Arquivo de backup corrompido: provento com campos obrigatórios ausentes.',
          );
        }
        const movDate = new Date(m.date);
        if (isNaN(movDate.getTime())) {
          throw new Error('Arquivo de backup corrompido: data de provento inválida.');
        }
        restoredMovements.push(
          new Movement(
            m.id,
            movDate,
            m.movementType,
            m.category as MovementCategory,
            m.direction as MovementDirection,
            m.asset,
            m.rawProduct || '',
            Number(m.quantity) || 0,
            Number(m.unitPrice) || 0,
            Number(m.totalValue) || 0,
            m.institution,
            m.batchId,
          ),
        );
      }
    }

    // 2. Clear state ONLY after all data is verified
    if (mode === 'overwrite') {
      await this.operationRepo.clear();
      if (this.movementRepo) {
        await this.movementRepo.removeAll();
      }
    }

    // 3. Persist validated records
    await this.assetRepo.saveAll(restoredAssets);
    for (const batch of restoredBatches) {
      await this.operationRepo.saveBatch(batch);
    }
    await this.operationRepo.addAll(restoredOperations);
    if (this.movementRepo && restoredMovements.length > 0) {
      await this.movementRepo.addAll(restoredMovements);
    }

    return {
      assetsRestored: restoredAssets.length,
      operationsRestored: restoredOperations.length,
      batchesRestored: restoredBatches.length,
      movementsRestored: restoredMovements.length,
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
