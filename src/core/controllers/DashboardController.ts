import { Operation } from '../entities/Operation.ts';
import { ConsolidatedPosition } from '../entities/ConsolidatedPosition.ts';
import { ImportBatch } from '../entities/ImportBatch.ts';
import { IOperationRepository } from '../repositories/IOperationRepository.ts';
import { IAssetRepository } from '../repositories/IAssetRepository.ts';
import { B3Parser } from '../services/B3Parser.ts';
import { AveragePriceCalculator } from '../services/AveragePriceCalculator.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { PersistentAssetRepository } from '../../infrastructure/repositories/PersistentAssetRepository.ts';
import { Asset } from '../entities/Asset.ts';

export interface DashboardSummary {
  positions: ConsolidatedPosition[];
  operations: Operation[];
  totalInvested: number;
  totalAssets: number;
  totalOperations: number;
  allocationByType: { type: string; label: string; totalCost: number; percentage: number }[];
  allocationByAsset: { ticker: string; totalCost: number; percentage: number }[];
  lastBatch?: ImportBatch | null;
  allBatches?: ImportBatch[];
}

export class DashboardController {
  constructor(
    private operationRepo: IOperationRepository = new PersistentOperationRepository(),
    private assetRepo: IAssetRepository = new PersistentAssetRepository(),
    private parser: B3Parser = new B3Parser(),
    private calculator: AveragePriceCalculator = new AveragePriceCalculator(),
  ) {}

  /**
   * Imports a B3 spreadsheet (XLSX or CSV) from ArrayBuffer or raw string.
   * Creates an ImportBatch snapshot to enable rollback points.
   */
  async importFile(
    input: ArrayBuffer | Uint8Array | string,
    fileName = 'planilha.xlsx',
  ): Promise<DashboardSummary> {
    const parsedOperations = await this.parser.parse(input);

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const batch = new ImportBatch(batchId, fileName, new Date(), parsedOperations.length);

    // Attach batchId to operations
    const operationsWithBatch = parsedOperations.map(
      (op) =>
        new Operation(
          op.id,
          op.date,
          op.asset,
          op.type,
          op.quantity,
          op.unitPrice,
          op.fees,
          op.institution,
          batchId,
        ),
    );

    // Save batch record
    await this.operationRepo.saveBatch(batch);

    // Save assets into asset repository
    const assetsToSave = parsedOperations.map((op) => {
      const type = this.parser.detectAssetType(op.asset);
      return new Asset(op.asset, type, '');
    });
    await this.assetRepo.saveAll(assetsToSave);

    // Save operations into operation repository
    await this.operationRepo.addAll(operationsWithBatch);

    return this.load();
  }

  /**
   * Rolls back the last imported batch, returning to the previous state.
   */
  async rollbackLastBatch(): Promise<DashboardSummary> {
    const lastBatch = await this.operationRepo.getLastBatch();
    if (lastBatch) {
      await this.operationRepo.removeBatch(lastBatch.id);
    }
    return this.load();
  }

  /**
   * Loads current dashboard state including positions, summary metrics and allocations.
   */
  async load(): Promise<DashboardSummary> {
    const rawOps = await this.operationRepo.getAll();
    const sortedOps = this.calculator.sortOperations(rawOps);
    const positions = this.calculator.calculate(sortedOps);
    const lastBatch = await this.operationRepo.getLastBatch();
    const allBatches = await this.operationRepo.getBatches();

    const totalInvested = positions.reduce((acc, pos) => acc + pos.totalCost, 0);

    // Allocation by Asset
    const allocationByAsset = positions.map((pos) => ({
      ticker: pos.ticker,
      totalCost: pos.totalCost,
      percentage: totalInvested > 0 ? (pos.totalCost / totalInvested) * 100 : 0,
    }));

    // Allocation by Type (Ações, FIIs, BDRs)
    const typeTotals: Record<string, number> = {};
    for (const pos of positions) {
      const typeKey = pos.type || this.parser.detectAssetType(pos.ticker);
      typeTotals[typeKey] = (typeTotals[typeKey] || 0) + pos.totalCost;
    }

    const typeLabels: Record<string, string> = {
      fii: 'Fundos Imobiliários',
      'fi-infra': 'FII de Infra',
      stock: 'Ações',
      unit: 'Units',
      bdr: 'BDRs',
      option: 'Opções',
    };

    const allocationByType = Object.entries(typeTotals).map(([type, cost]) => ({
      type,
      label: typeLabels[type] || type.toUpperCase(),
      totalCost: cost,
      percentage: totalInvested > 0 ? (cost / totalInvested) * 100 : 0,
    }));

    return {
      positions,
      operations: sortedOps,
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalAssets: positions.length,
      totalOperations: sortedOps.length,
      allocationByType,
      allocationByAsset,
      lastBatch,
      allBatches,
    };
  }

  /**
   * Resets all stored operations, batches and assets.
   */
  async clear(): Promise<void> {
    await this.operationRepo.clear();
  }
}
