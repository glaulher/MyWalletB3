import { Operation } from '../entities/Operation.ts';
import { ConsolidatedPosition } from '../entities/ConsolidatedPosition.ts';
import { AssetType } from '../entities/Asset.ts';
import { B3PositionItem } from './B3PositionParser.ts';

export type DiscrepancyType =
  | 'MATCH'
  | 'OPTION_WORTHLESS'
  | 'SPLIT_SUSPECTED'
  | 'REVERSE_SPLIT_SUSPECTED'
  | 'MISSING_IN_APP'
  | 'EXCESS_IN_APP'
  | 'DEFICIT_IN_APP';

export interface ReconciliationItem {
  ticker: string;
  assetType: AssetType;
  productName?: string;
  calculatedQty: number;
  b3Qty: number;
  diffQty: number; // b3Qty - calculatedQty
  closePrice: number;
  calculatedAvgPrice: number;
  type: DiscrepancyType;
  description: string;
  suggestedActionLabel: string;
  ratio?: number;
}

export class ReconciliationService {
  /**
   * Compares calculated positions against official B3 custody items
   */
  reconcile(
    calculatedPositions: ConsolidatedPosition[],
    b3Items: B3PositionItem[],
  ): ReconciliationItem[] {
    const calcMap = new Map<string, ConsolidatedPosition>();
    calculatedPositions.forEach((p) => calcMap.set(p.ticker.toUpperCase().trim(), p));

    const b3Map = new Map<string, B3PositionItem>();
    b3Items.forEach((b) => b3Map.set(b.ticker.toUpperCase().trim(), b));

    const allTickers = new Set([...calcMap.keys(), ...b3Map.keys()]);
    const results: ReconciliationItem[] = [];

    for (const ticker of allTickers) {
      const calc = calcMap.get(ticker);
      const b3 = b3Map.get(ticker);

      const calculatedQty = calc?.quantity || 0;
      const calculatedAvgPrice = calc?.averagePrice || 0;
      const b3Qty = b3?.quantity || 0;
      const diffQty = b3Qty - calculatedQty;
      const closePrice = b3?.closePrice || 0;
      const assetType: AssetType = b3?.assetType || calc?.type || 'stock';
      const productName = b3?.productName;

      // 1. Matched
      if (calculatedQty === b3Qty) {
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty: 0,
          closePrice,
          calculatedAvgPrice,
          type: 'MATCH',
          description: 'Custódia 100% conciliada com a B3.',
          suggestedActionLabel: 'Nenhuma ação necessária',
        });
        continue;
      }

      // 2. Option expired / worthless
      if (assetType === 'option' && calculatedQty > 0 && b3Qty === 0) {
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'OPTION_WORTHLESS',
          description: 'Opção expirou sem exercício (virou pó). Posição encerrada na B3.',
          suggestedActionLabel: 'Baixar por Expiração (Virou Pó) a R$ 0,00',
        });
        continue;
      }

      // 3. Suspected Split (b3Qty is integer multiple of calculatedQty)
      if (calculatedQty > 0 && b3Qty > calculatedQty && b3Qty % calculatedQty === 0) {
        const ratio = Math.round(b3Qty / calculatedQty);
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'SPLIT_SUSPECTED',
          ratio,
          description: `Provável desdobramento de 1 para ${ratio} (B3 possui ${ratio}x a quantidade calculada).`,
          suggestedActionLabel: `Aplicar Desdobramento (Split 1:${ratio})`,
        });
        continue;
      }

      // 4. Suspected Reverse Split (calculatedQty is integer multiple of b3Qty)
      if (calculatedQty > 0 && b3Qty > 0 && calculatedQty > b3Qty && calculatedQty % b3Qty === 0) {
        const ratio = Math.round(calculatedQty / b3Qty);
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'REVERSE_SPLIT_SUSPECTED',
          ratio,
          description: `Provável grupamento de ${ratio} para 1 (B3 possui 1/${ratio} da quantidade calculada).`,
          suggestedActionLabel: `Aplicar Grupamento (${ratio}:1)`,
        });
        continue;
      }

      // 5. Missing in App (present in B3, no ops in app)
      if (calculatedQty === 0 && b3Qty > 0) {
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty: 0,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice: 0,
          type: 'MISSING_IN_APP',
          description: `Ativo com ${b3Qty} cota(s) na B3 sem movimentações registradas no aplicativo.`,
          suggestedActionLabel: `Importar Posição B3 (${b3Qty} cotas a R$ ${closePrice.toFixed(2)})`,
        });
        continue;
      }

      // 6. Excess in App (calculatedQty > b3Qty)
      if (calculatedQty > b3Qty) {
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'EXCESS_IN_APP',
          description:
            b3Qty === 0
              ? `Ativo com posição zerada na B3, mas com saldo de ${calculatedQty} no app (venda total).`
              : `App possui ${calculatedQty - b3Qty} cota(s) a mais que a B3 (venda parcial não importada).`,
          suggestedActionLabel: `Ajustar Saída (-${calculatedQty - b3Qty} cotas)`,
        });
        continue;
      }

      // 7. Deficit in App (b3Qty > calculatedQty)
      results.push({
        ticker,
        assetType,
        productName,
        calculatedQty,
        b3Qty,
        diffQty,
        closePrice,
        calculatedAvgPrice,
        type: 'DEFICIT_IN_APP',
        description: `B3 possui ${diffQty} cota(s) a mais que o app (subscrição, bonificação ou compras faltantes).`,
        suggestedActionLabel: `Lançar Entrada (+${diffQty} cotas)`,
      });
    }

    // Sort: Discrepancies first, matches last; then by ticker
    return results.sort((a, b) => {
      if (a.type === 'MATCH' && b.type !== 'MATCH') return 1;
      if (a.type !== 'MATCH' && b.type === 'MATCH') return -1;
      return a.ticker.localeCompare(b.ticker);
    });
  }

  /**
   * Generates a sell operation for an option that expired worthless (price R$ 0,00).
   */
  createWorthlessOptionOperation(
    ticker: string,
    quantity: number,
    date: Date = new Date(),
  ): Operation {
    return new Operation(
      `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      ticker.toUpperCase().trim(),
      'sell',
      quantity,
      0,
      0,
      'Expiração (Virou Pó)',
    );
  }

  /**
   * Generates a split (desdobramento) operation:
   * Adds additional shares at price R$ 0,00, which multiplies quantity and divides average price.
   */
  createSplitOperation(
    ticker: string,
    currentQty: number,
    splitMultiplier: number,
    date: Date = new Date(),
  ): Operation {
    const additionalQty = currentQty * splitMultiplier - currentQty;
    return new Operation(
      `split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      ticker.toUpperCase().trim(),
      'buy',
      additionalQty,
      0,
      0,
      `Desdobramento (Split 1:${splitMultiplier})`,
    );
  }

  /**
   * Generates a subscription / bonus / custody adjustment operation
   */
  createAdjustmentOperation(
    ticker: string,
    type: 'buy' | 'sell',
    quantity: number,
    unitPrice: number = 0,
    institution: string = 'Ajuste / Subscrição',
    date: Date = new Date(),
  ): Operation {
    return new Operation(
      `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      ticker.toUpperCase().trim(),
      type,
      quantity,
      unitPrice,
      0,
      institution,
    );
  }
}
