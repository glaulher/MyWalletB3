import { Movement, MovementCategory } from '../entities/Movement.ts';
import { ConsolidatedPosition } from '../entities/ConsolidatedPosition.ts';
import { AssetType } from '../entities/Asset.ts';
import { B3Parser } from './B3Parser.ts';

export interface MonthlyIncomeItem {
  monthKey: string; // "YYYY-MM"
  label: string; // "Mai/24"
  yieldValue: number;
  dividendValue: number;
  jcpValue: number;
  totalValue: number;
}

export interface AssetIncomeSummary {
  ticker: string;
  assetType: AssetType;
  totalIncome: number;
  yieldValue: number;
  dividendValue: number;
  jcpValue: number;
  paymentCount: number;
  lastPaymentDate?: Date;
  currentQuantity: number;
  currentTotalCost: number;
  yieldOnCost: number; // in percentage, e.g. 8.4%
}

export interface IncomeMetrics {
  totalReceived: number;
  totalYields: number;
  totalDividends: number;
  totalJcp: number;
  averageMonthlyIncome: number;
  activeMonthsCount: number;
  monthlyEvolution: MonthlyIncomeItem[];
  assetSummaries: AssetIncomeSummary[];
  categoryAllocation: {
    category: MovementCategory;
    label: string;
    value: number;
    percentage: number;
    color: string;
  }[];
}

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export class IncomeCalculator {
  private b3Parser = new B3Parser();

  /**
   * Aggregates and calculates income metrics from movements and portfolio positions.
   */
  calculateMetrics(movements: Movement[], positions: ConsolidatedPosition[] = []): IncomeMetrics {
    const incomes = movements.filter((m) => m.isIncome);

    let totalYields = 0;
    let totalDividends = 0;
    let totalJcp = 0;

    const monthlyMap = new Map<
      string,
      { yieldVal: number; divVal: number; jcpVal: number; total: number; date: Date }
    >();
    const assetMap = new Map<
      string,
      {
        total: number;
        yieldVal: number;
        divVal: number;
        jcpVal: number;
        count: number;
        lastDate?: Date;
      }
    >();

    for (const inc of incomes) {
      const val = inc.totalValue;
      if (val <= 0) continue;

      if (inc.category === 'yield') totalYields += val;
      if (inc.category === 'dividend') totalDividends += val;
      if (inc.category === 'jcp') totalJcp += val;

      // Group monthly
      const year = inc.date.getFullYear();
      const month = inc.date.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      const mEntry = monthlyMap.get(monthKey) || {
        yieldVal: 0,
        divVal: 0,
        jcpVal: 0,
        total: 0,
        date: new Date(year, month, 1),
      };
      if (inc.category === 'yield') mEntry.yieldVal += val;
      if (inc.category === 'dividend') mEntry.divVal += val;
      if (inc.category === 'jcp') mEntry.jcpVal += val;
      mEntry.total += val;
      monthlyMap.set(monthKey, mEntry);

      // Group by asset
      const ticker = inc.asset.toUpperCase();
      const aEntry = assetMap.get(ticker) || {
        total: 0,
        yieldVal: 0,
        divVal: 0,
        jcpVal: 0,
        count: 0,
      };
      aEntry.total += val;
      if (inc.category === 'yield') aEntry.yieldVal += val;
      if (inc.category === 'dividend') aEntry.divVal += val;
      if (inc.category === 'jcp') aEntry.jcpVal += val;
      aEntry.count += 1;
      if (!aEntry.lastDate || inc.date.getTime() > aEntry.lastDate.getTime()) {
        aEntry.lastDate = inc.date;
      }
      assetMap.set(ticker, aEntry);
    }

    const totalReceived = totalYields + totalDividends + totalJcp;

    // Build chronological monthly evolution
    const monthlyEvolution: MonthlyIncomeItem[] = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => {
        const d = data.date;
        const label = `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
        return {
          monthKey: key,
          label,
          yieldValue: data.yieldVal,
          dividendValue: data.divVal,
          jcpValue: data.jcpVal,
          totalValue: data.total,
        };
      });

    const activeMonthsCount = monthlyEvolution.length;
    const averageMonthlyIncome =
      activeMonthsCount > 0 ? totalReceived / Math.min(activeMonthsCount, 12) : 0;

    // Position map for Yield on Cost calculation
    const positionMap = new Map<string, ConsolidatedPosition>();
    for (const pos of positions) {
      positionMap.set(pos.ticker.toUpperCase(), pos);
    }

    // Build asset summaries
    const assetSummaries: AssetIncomeSummary[] = Array.from(assetMap.entries())
      .map(([ticker, data]) => {
        const pos = positionMap.get(ticker);
        const currentQuantity = pos ? pos.quantity : 0;
        const currentTotalCost = pos ? pos.totalCost : 0;
        const assetType = this.b3Parser.detectAssetType(ticker);

        const yieldOnCost = currentTotalCost > 0 ? (data.total / currentTotalCost) * 100 : 0;

        return {
          ticker,
          assetType,
          totalIncome: data.total,
          yieldValue: data.yieldVal,
          dividendValue: data.divVal,
          jcpValue: data.jcpVal,
          paymentCount: data.count,
          lastPaymentDate: data.lastDate,
          currentQuantity,
          currentTotalCost,
          yieldOnCost,
        };
      })
      .sort((a, b) => b.totalIncome - a.totalIncome);

    // Build category allocations
    const categoryAllocation = [
      {
        category: 'yield' as MovementCategory,
        label: 'Rendimentos (FIIs)',
        value: totalYields,
        percentage: totalReceived > 0 ? (totalYields / totalReceived) * 100 : 0,
        color: '#10b981', // green
      },
      {
        category: 'dividend' as MovementCategory,
        label: 'Dividendos (Ações)',
        value: totalDividends,
        percentage: totalReceived > 0 ? (totalDividends / totalReceived) * 100 : 0,
        color: '#3b82f6', // blue
      },
      {
        category: 'jcp' as MovementCategory,
        label: 'JCP (Tribut. Exclusiva)',
        value: totalJcp,
        percentage: totalReceived > 0 ? (totalJcp / totalReceived) * 100 : 0,
        color: '#f59e0b', // amber
      },
    ].filter((c) => c.value > 0);

    return {
      totalReceived,
      totalYields,
      totalDividends,
      totalJcp,
      averageMonthlyIncome,
      activeMonthsCount,
      monthlyEvolution,
      assetSummaries,
      categoryAllocation,
    };
  }
}
