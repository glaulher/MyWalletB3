import { Operation } from '../entities/Operation.ts';
import { ConsolidatedPosition } from '../entities/ConsolidatedPosition.ts';
import { ImportBatch } from '../entities/ImportBatch.ts';
import { Movement } from '../entities/Movement.ts';
import { IOperationRepository } from '../repositories/IOperationRepository.ts';
import { IAssetRepository } from '../repositories/IAssetRepository.ts';
import { IMovementRepository } from '../repositories/IMovementRepository.ts';
import { B3Parser } from '../services/B3Parser.ts';
import { B3MovementParser } from '../services/B3MovementParser.ts';
import { AveragePriceCalculator } from '../services/AveragePriceCalculator.ts';
import { IncomeCalculator, IncomeMetrics } from '../services/IncomeCalculator.ts';
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

export interface MultiImportResult {
  totalFiles: number;
  tradeFiles: number;
  movementFiles: number;
  totalOperations: number;
  totalMovements: number;
  totalIncomes: number;
  totalReceived: number;
  errors: Array<{ fileName: string; error: string }>;
  summary: DashboardSummary;
}

export class DashboardController {
  private cachedSummary: DashboardSummary | null = null;

  constructor(
    private operationRepo: IOperationRepository,
    private assetRepo: IAssetRepository,
    private movementRepo: IMovementRepository,
    private parser: B3Parser = new B3Parser(),
    private movementParser: B3MovementParser = new B3MovementParser(),
    private calculator: AveragePriceCalculator = new AveragePriceCalculator(),
    private incomeCalculator: IncomeCalculator = new IncomeCalculator(),
  ) {}

  getOperationRepo(): IOperationRepository {
    return this.operationRepo;
  }

  getAssetRepo(): IAssetRepository {
    return this.assetRepo;
  }

  getMovementRepo(): IMovementRepository {
    return this.movementRepo;
  }

  invalidateCache(): void {
    this.cachedSummary = null;
  }

  /**
   * Imports a B3 spreadsheet (XLSX or CSV) from ArrayBuffer or raw string.
   * Creates an ImportBatch snapshot to enable rollback points.
   */
  async importFile(
    input: ArrayBuffer | Uint8Array | string,
    fileName = 'planilha.xlsx',
    skipLoad = false,
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

    this.invalidateCache();
    if (skipLoad) {
      return {
        positions: [],
        operations: operationsWithBatch,
        totalInvested: 0,
        totalAssets: 0,
        totalOperations: operationsWithBatch.length,
        allocationByType: [],
        allocationByAsset: [],
        lastBatch: batch,
        allBatches: [batch],
      };
    }
    return this.load();
  }

  /**
   * Imports a B3 movements spreadsheet (XLSX or CSV).
   */
  async importMovementFile(
    input: ArrayBuffer | Uint8Array | string,
    fileName = 'movimentacao.xlsx',
  ): Promise<{ totalMovements: number; totalIncomes: number; totalReceived: number }> {
    const parsedMovements = await this.movementParser.parse(input);

    const batchId = `batch-mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const batch = new ImportBatch(batchId, fileName, new Date(), parsedMovements.length);

    const movementsWithBatch = parsedMovements.map(
      (m) =>
        new Movement(
          m.id,
          m.date,
          m.movementType,
          m.category,
          m.direction,
          m.asset,
          m.rawProduct,
          m.quantity,
          m.unitPrice,
          m.totalValue,
          m.institution,
          batchId,
        ),
    );

    await this.movementRepo.saveBatch(batch);

    // Save newly identified assets
    const assetsToSave = parsedMovements
      .filter((m) => m.asset && m.asset !== 'BRL')
      .map((m) => {
        const type = this.parser.detectAssetType(m.asset);
        return new Asset(m.asset, type, '');
      });
    if (assetsToSave.length > 0) {
      await this.assetRepo.saveAll(assetsToSave);
    }

    await this.movementRepo.addAll(movementsWithBatch);
    this.invalidateCache();

    const incomes = movementsWithBatch.filter((m) => m.isIncome);
    const totalReceived = incomes.reduce((acc, i) => acc + i.totalValue, 0);

    return {
      totalMovements: movementsWithBatch.length,
      totalIncomes: incomes.length,
      totalReceived,
    };
  }

  /**
   * Intelligently detects B3 file type (trades, positions or movements) and imports accordingly.
   */
  async importAnyFile(
    input: ArrayBuffer | Uint8Array | string,
    fileName = 'planilha.xlsx',
    skipLoad = false,
  ): Promise<
    | { type: 'trades'; summary: DashboardSummary }
    | {
        type: 'movement';
        summary: { totalMovements: number; totalIncomes: number; totalReceived: number };
      }
    | { type: 'unknown'; message: string }
  > {
    const detected = this.parser.detectSpreadsheetType(input, fileName);

    if (detected === 'movement') {
      const summary = await this.importMovementFile(input, fileName);
      return { type: 'movement', summary };
    }

    if (detected === 'trades' || detected === 'unknown') {
      try {
        const summary = await this.importFile(input, fileName, skipLoad);
        return { type: 'trades', summary };
      } catch (err) {
        if (detected === 'unknown') {
          return {
            type: 'unknown',
            message: 'Não foi possível identificar o formato da planilha da B3.',
          };
        }
        throw err;
      }
    }

    return {
      type: 'unknown',
      message:
        'Planilha de custódia/posição detectada. Utilize a aba Conciliação para conciliá-la.',
    };
  }

  /**
   * Imports multiple B3 spreadsheets concurrently in pipeline, tracking individual batches for each file
   * while computing a single consolidated summary at the end.
   */
  async importMultipleFiles(
    files: Array<{ buffer: ArrayBuffer | Uint8Array | string; name: string }>,
    onProgress?: (current: number, total: number, fileName: string) => void,
  ): Promise<MultiImportResult> {
    let tradeFiles = 0;
    let movementFiles = 0;
    let totalOperations = 0;
    let totalMovements = 0;
    let totalIncomes = 0;
    let totalReceived = 0;
    const errors: Array<{ fileName: string; error: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i + 1, files.length, file.name);

      try {
        const res = await this.importAnyFile(file.buffer, file.name, true);
        if (res.type === 'trades') {
          tradeFiles++;
          // Count operations added in this file batch
          const lastBatch = res.summary.lastBatch;
          if (lastBatch) {
            totalOperations += lastBatch.operationCount;
          }
        } else if (res.type === 'movement') {
          movementFiles++;
          totalMovements += res.summary.totalMovements;
          totalIncomes += res.summary.totalIncomes;
          totalReceived += res.summary.totalReceived;
        } else {
          errors.push({ fileName: file.name, error: res.message });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ fileName: file.name, error: errorMsg });
      }
    }

    this.invalidateCache();
    const finalSummary = await this.load(true);

    return {
      totalFiles: files.length,
      tradeFiles,
      movementFiles,
      totalOperations,
      totalMovements,
      totalIncomes,
      totalReceived: Math.round(totalReceived * 100) / 100,
      errors,
      summary: finalSummary,
    };
  }

  /**
   * Rolls back the last imported batch (either operations or movements), returning to previous state.
   */
  async rollbackLastBatch(): Promise<DashboardSummary> {
    const lastOpBatch = await this.operationRepo.getLastBatch();
    const lastMovBatch = this.movementRepo ? await this.movementRepo.getLastBatch() : null;

    if (
      lastMovBatch &&
      (!lastOpBatch || lastMovBatch.importedAt.getTime() > lastOpBatch.importedAt.getTime())
    ) {
      await this.movementRepo?.removeBatch(lastMovBatch.id);
    } else if (lastOpBatch) {
      await this.operationRepo.removeBatch(lastOpBatch.id);
    }

    this.invalidateCache();
    return this.load();
  }

  /**
   * Computes income metrics and aggregations from stored movements and portfolio positions.
   */
  async loadIncomeMetrics(): Promise<IncomeMetrics> {
    const [movements, operations] = await Promise.all([
      this.movementRepo.getAll(),
      this.operationRepo.getAll(),
    ]);
    const sortedOps = this.calculator.sortOperations(operations);
    const positions = this.calculator.calculate(sortedOps);
    return this.incomeCalculator.calculateMetrics(movements, positions);
  }

  /**
   * Loads current dashboard state including positions, summary metrics and allocations.
   */
  async load(forceRefresh = false): Promise<DashboardSummary> {
    if (this.cachedSummary && !forceRefresh) {
      return this.cachedSummary;
    }

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

    this.cachedSummary = {
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

    return this.cachedSummary;
  }

  /**
   * Resets all stored operations, batches, movements and assets.
   */
  async clear(): Promise<void> {
    this.invalidateCache();
    await this.operationRepo.clear();
    if (this.movementRepo) {
      await this.movementRepo.removeAll();
    }
  }
}
