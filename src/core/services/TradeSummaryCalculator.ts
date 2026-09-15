import { Operation } from '../entities/Operation.ts';
import { AssetType } from '../entities/Asset.ts';
import { B3Parser } from './B3Parser.ts';

export interface AssetTradeSummary {
  ticker: string;
  type: AssetType;
  // Compras
  totalBoughtQty: number; // Quantas compradas
  totalBoughtValue: number; // R$ total comprado com taxas
  avgBuyPrice: number; // Preço médio de compra ponderado
  // Vendas
  totalSoldQty: number; // Quantas vendidas
  totalSoldValue: number; // R$ total vendido líquido de taxas
  avgSellPrice: number; // Preço médio de venda ponderado
  // Custódia e Preço Médio Atual
  currentQty: number; // Saldo em custódia (compradas - vendidas)
  currentAvgPrice: number; // Preço médio contábil atual da posição em aberto
  currentTotalCost: number; // Custo total da posição atual (currentQty * currentAvgPrice)
  // Resultado
  realizedProfit: number; // Lucro ou prejuízo realizado com as vendas
  operationsCount: number; // Total de operações registradas
}

export class TradeSummaryCalculator {
  private b3Parser = new B3Parser();

  /**
   * Consolidates all buy and sell operations per asset, computing:
   * - Total bought quantity & average purchase price
   * - Total sold quantity & average sell price
   * - Current open custody quantity & current average holding price
   * - Realized profit / loss from completed sales
   */
  calculate(operations: Operation[]): AssetTradeSummary[] {
    const groups = new Map<string, Operation[]>();

    for (const op of operations) {
      const ticker = op.asset.toUpperCase().trim();
      const list = groups.get(ticker) ?? [];
      list.push(op);
      groups.set(ticker, list);
    }

    const summaries: AssetTradeSummary[] = [];

    for (const [ticker, ops] of groups.entries()) {
      // Sort chronologically: date ascending, and for equal dates buy comes before sell
      const sorted = [...ops].sort((a, b) => {
        const timeDiff = a.date.getTime() - b.date.getTime();
        if (timeDiff !== 0) return timeDiff;
        if (a.type !== b.type) return a.type === 'buy' ? -1 : 1;
        return 0;
      });

      let totalBoughtQty = 0;
      let totalBoughtValue = 0;
      let totalSoldQty = 0;
      let totalSoldValue = 0;
      let currentQty = 0;
      let currentAvgPrice = 0;
      let currentTotalCost = 0;
      let realizedProfit = 0;

      for (const op of sorted) {
        if (op.type === 'buy') {
          const opCost = op.quantity * op.unitPrice + op.fees;
          totalBoughtQty += op.quantity;
          totalBoughtValue += opCost;

          const newQty = currentQty + op.quantity;
          const newCost = currentTotalCost + opCost;
          currentAvgPrice = newQty > 0 ? newCost / newQty : 0;
          currentQty = newQty;
          currentTotalCost = newCost;
        } else if (op.type === 'sell') {
          const saleNet = op.quantity * op.unitPrice - op.fees;
          totalSoldQty += op.quantity;
          totalSoldValue += saleNet;

          const costBasis = op.quantity * currentAvgPrice;
          const profit = saleNet - costBasis;
          realizedProfit += profit;

          currentQty = Math.max(0, currentQty - op.quantity);
          currentTotalCost = currentQty > 0 ? currentQty * currentAvgPrice : 0;
          if (currentQty === 0) {
            currentAvgPrice = 0;
          }
        }
      }

      const avgBuyPrice = totalBoughtQty > 0 ? totalBoughtValue / totalBoughtQty : 0;
      const avgSellPrice = totalSoldQty > 0 ? totalSoldValue / totalSoldQty : 0;
      const assetType = this.b3Parser.detectAssetType(ticker);

      summaries.push({
        ticker,
        type: assetType,
        totalBoughtQty,
        totalBoughtValue: Math.round(totalBoughtValue * 100) / 100,
        avgBuyPrice: Math.round(avgBuyPrice * 10000) / 10000,
        totalSoldQty,
        totalSoldValue: Math.round(totalSoldValue * 100) / 100,
        avgSellPrice: Math.round(avgSellPrice * 10000) / 10000,
        currentQty,
        currentAvgPrice: Math.round(currentAvgPrice * 10000) / 10000,
        currentTotalCost: Math.round(currentTotalCost * 100) / 100,
        realizedProfit: Math.round(realizedProfit * 100) / 100,
        operationsCount: ops.length,
      });
    }

    // Sort by current total cost descending, then total bought value descending
    return summaries.sort((a, b) => {
      if (b.currentTotalCost !== a.currentTotalCost) {
        return b.currentTotalCost - a.currentTotalCost;
      }
      return b.totalBoughtValue - a.totalBoughtValue;
    });
  }
}
