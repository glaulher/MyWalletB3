import { Operation } from '../entities/Operation.ts';

export interface EnrichedCalendarOperation {
  id: string;
  date: Date;
  dateKey: string; // 'YYYY-MM-DD'
  asset: string;
  type: 'buy' | 'sell';
  quantity: number;
  unitPrice: number;
  fees: number;
  totalValue: number; // buy: qty*price + fees; sell: qty*price - fees
  costBasis: number; // For sell: qty * avgPriceBefore; for buy: 0
  realizedProfit: number; // For sell: totalValue - costBasis; for buy: 0
  avgPriceBefore: number;
  avgPriceAfter: number;
  institution?: string;
}

export type DayTradeStatus = 'loss' | 'profit' | 'buy-only' | 'neutral' | 'empty';

export interface DailyTradeSummary {
  dateKey: string; // 'YYYY-MM-DD'
  date: Date;
  year: number;
  month: number; // 0-11
  day: number; // 1-31
  totalBought: number; // R$ total comprado com taxas
  boughtQty: number;
  totalSold: number; // R$ total líquido vendido
  soldQty: number;
  realizedProfit: number; // R$ lucro/prejuízo líquido apurado nas vendas do dia
  operations: EnrichedCalendarOperation[];
  status: DayTradeStatus;
  hasLoss: boolean; // True se houver vendas e o lucro líquido do dia for negativo
  hasProfit: boolean; // True se houver vendas e o lucro líquido for positivo
  hasBuy: boolean;
  hasSell: boolean;
}

export interface CalendarPeriodSummary {
  totalBought: number;
  boughtQty: number;
  totalSold: number;
  soldQty: number;
  realizedProfit: number;
  operationsCount: number;
  daysWithOperations: number;
  daysWithLoss: number;
  daysWithProfit: number;
  daysWithBuyOnly: number;
}

export class CalendarCalculationResult {
  private dailyMap: Map<string, DailyTradeSummary>;
  private enrichedOperations: EnrichedCalendarOperation[];
  private availableYears: number[];

  constructor(
    dailyMap: Map<string, DailyTradeSummary>,
    enrichedOperations: EnrichedCalendarOperation[],
    availableYears: number[],
  ) {
    this.dailyMap = dailyMap;
    this.enrichedOperations = enrichedOperations;
    this.availableYears = availableYears;
  }

  getDaySummary(dateKey: string): DailyTradeSummary | null {
    return this.dailyMap.get(dateKey) ?? null;
  }

  getDailySummaries(): Map<string, DailyTradeSummary> {
    return this.dailyMap;
  }

  getAllEnrichedOperations(): EnrichedCalendarOperation[] {
    return this.enrichedOperations;
  }

  getAvailableYears(): number[] {
    return [...this.availableYears];
  }

  getMonthSummary(year: number, month: number): CalendarPeriodSummary {
    let totalBought = 0;
    let boughtQty = 0;
    let totalSold = 0;
    let soldQty = 0;
    let realizedProfit = 0;
    let operationsCount = 0;
    let daysWithOperations = 0;
    let daysWithLoss = 0;
    let daysWithProfit = 0;
    let daysWithBuyOnly = 0;

    for (const day of this.dailyMap.values()) {
      if (day.year === year && day.month === month) {
        if (day.operations.length > 0) {
          daysWithOperations++;
          totalBought += day.totalBought;
          boughtQty += day.boughtQty;
          totalSold += day.totalSold;
          soldQty += day.soldQty;
          realizedProfit += day.realizedProfit;
          operationsCount += day.operations.length;

          if (day.status === 'loss') daysWithLoss++;
          else if (day.status === 'profit') daysWithProfit++;
          else if (day.status === 'buy-only') daysWithBuyOnly++;
        }
      }
    }

    return {
      totalBought: Math.round(totalBought * 100) / 100,
      boughtQty,
      totalSold: Math.round(totalSold * 100) / 100,
      soldQty,
      realizedProfit: Math.round(realizedProfit * 100) / 100,
      operationsCount,
      daysWithOperations,
      daysWithLoss,
      daysWithProfit,
      daysWithBuyOnly,
    };
  }

  getYearSummary(year: number): CalendarPeriodSummary {
    let totalBought = 0;
    let boughtQty = 0;
    let totalSold = 0;
    let soldQty = 0;
    let realizedProfit = 0;
    let operationsCount = 0;
    let daysWithOperations = 0;
    let daysWithLoss = 0;
    let daysWithProfit = 0;
    let daysWithBuyOnly = 0;

    for (const day of this.dailyMap.values()) {
      if (day.year === year) {
        if (day.operations.length > 0) {
          daysWithOperations++;
          totalBought += day.totalBought;
          boughtQty += day.boughtQty;
          totalSold += day.totalSold;
          soldQty += day.soldQty;
          realizedProfit += day.realizedProfit;
          operationsCount += day.operations.length;

          if (day.status === 'loss') daysWithLoss++;
          else if (day.status === 'profit') daysWithProfit++;
          else if (day.status === 'buy-only') daysWithBuyOnly++;
        }
      }
    }

    return {
      totalBought: Math.round(totalBought * 100) / 100,
      boughtQty,
      totalSold: Math.round(totalSold * 100) / 100,
      soldQty,
      realizedProfit: Math.round(realizedProfit * 100) / 100,
      operationsCount,
      daysWithOperations,
      daysWithLoss,
      daysWithProfit,
      daysWithBuyOnly,
    };
  }
}

export class CalendarTradeCalculator {
  /**
   * Helper to format a Date object into local 'YYYY-MM-DD' key.
   */
  static toDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Computes historical average price sequentially per asset,
   * enriches all operations with their cost basis and realized profit/loss,
   * and organizes daily summaries with profit/loss status and Google Calendar color flags.
   */
  calculate(operations: Operation[]): CalendarCalculationResult {
    // 1. Group operations by asset ticker
    const assetGroups = new Map<string, Operation[]>();
    const yearsSet = new Set<number>();

    for (const op of operations) {
      const ticker = op.asset.toUpperCase().trim();
      const list = assetGroups.get(ticker) ?? [];
      list.push(op);
      assetGroups.set(ticker, list);
      yearsSet.add(op.date.getFullYear());
    }

    const enrichedOps: EnrichedCalendarOperation[] = [];

    // 2. Process each asset's timeline chronologically
    for (const [, ops] of assetGroups.entries()) {
      const sorted = [...ops].sort((a, b) => {
        const timeDiff = a.date.getTime() - b.date.getTime();
        if (timeDiff !== 0) return timeDiff;
        if (a.type !== b.type) return a.type === 'buy' ? -1 : 1;
        return 0;
      });

      let currentQty = 0;
      let currentAvgPrice = 0;
      let currentTotalCost = 0;

      for (const op of sorted) {
        const dateKey = CalendarTradeCalculator.toDateKey(op.date);

        if (op.type === 'buy') {
          const opCost = op.quantity * op.unitPrice + op.fees;
          const newQty = currentQty + op.quantity;
          const newCost = currentTotalCost + opCost;
          const avgPriceBefore = currentAvgPrice;
          currentAvgPrice = newQty > 0 ? newCost / newQty : 0;
          currentQty = newQty;
          currentTotalCost = newCost;

          enrichedOps.push({
            id: op.id,
            date: op.date,
            dateKey,
            asset: op.asset.toUpperCase().trim(),
            type: 'buy',
            quantity: op.quantity,
            unitPrice: op.unitPrice,
            fees: op.fees,
            totalValue: Math.round(opCost * 100) / 100,
            costBasis: 0,
            realizedProfit: 0,
            avgPriceBefore: Math.round(avgPriceBefore * 10000) / 10000,
            avgPriceAfter: Math.round(currentAvgPrice * 10000) / 10000,
            institution: op.institution,
          });
        } else {
          // Sell operation
          const saleNet = op.quantity * op.unitPrice - op.fees;
          const costBasis = op.quantity * currentAvgPrice;
          const profit = saleNet - costBasis;
          const avgPriceBefore = currentAvgPrice;

          currentQty = Math.max(0, currentQty - op.quantity);
          currentTotalCost = currentQty > 0 ? currentQty * currentAvgPrice : 0;
          if (currentQty === 0) {
            currentAvgPrice = 0;
          }

          enrichedOps.push({
            id: op.id,
            date: op.date,
            dateKey,
            asset: op.asset.toUpperCase().trim(),
            type: 'sell',
            quantity: op.quantity,
            unitPrice: op.unitPrice,
            fees: op.fees,
            totalValue: Math.round(saleNet * 100) / 100,
            costBasis: Math.round(costBasis * 100) / 100,
            realizedProfit: Math.round(profit * 100) / 100,
            avgPriceBefore: Math.round(avgPriceBefore * 10000) / 10000,
            avgPriceAfter: Math.round(currentAvgPrice * 10000) / 10000,
            institution: op.institution,
          });
        }
      }
    }

    // Sort all enriched ops chronologically
    enrichedOps.sort((a, b) => {
      const timeDiff = a.date.getTime() - b.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.type !== b.type) return a.type === 'buy' ? -1 : 1;
      return 0;
    });

    // 3. Group by dateKey into DailyTradeSummary
    const dailyMap = new Map<string, DailyTradeSummary>();

    for (const op of enrichedOps) {
      const existing = dailyMap.get(op.dateKey) ?? {
        dateKey: op.dateKey,
        date: new Date(op.date.getFullYear(), op.date.getMonth(), op.date.getDate()),
        year: op.date.getFullYear(),
        month: op.date.getMonth(),
        day: op.date.getDate(),
        totalBought: 0,
        boughtQty: 0,
        totalSold: 0,
        soldQty: 0,
        realizedProfit: 0,
        operations: [],
        status: 'empty' as DayTradeStatus,
        hasLoss: false,
        hasProfit: false,
        hasBuy: false,
        hasSell: false,
      };

      existing.operations.push(op);

      if (op.type === 'buy') {
        existing.totalBought += op.totalValue;
        existing.boughtQty += op.quantity;
        existing.hasBuy = true;
      } else {
        existing.totalSold += op.totalValue;
        existing.soldQty += op.quantity;
        existing.realizedProfit += op.realizedProfit;
        existing.hasSell = true;
      }

      dailyMap.set(op.dateKey, existing);
    }

    // 4. Finalize rounding and status evaluation for each day
    for (const day of dailyMap.values()) {
      day.totalBought = Math.round(day.totalBought * 100) / 100;
      day.totalSold = Math.round(day.totalSold * 100) / 100;
      day.realizedProfit = Math.round(day.realizedProfit * 100) / 100;

      // MANDATORY RULE: Se o dia tiver um resultado de venda negativo, status = 'loss'
      if (day.hasSell) {
        if (day.realizedProfit < -0.001) {
          day.status = 'loss';
          day.hasLoss = true;
        } else if (day.realizedProfit > 0.001) {
          day.status = 'profit';
          day.hasProfit = true;
        } else {
          day.status = 'neutral';
        }
      } else if (day.hasBuy) {
        day.status = 'buy-only';
      } else {
        day.status = 'empty';
      }
    }

    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    if (availableYears.length === 0) {
      availableYears.push(new Date().getFullYear());
    }

    return new CalendarCalculationResult(dailyMap, enrichedOps, availableYears);
  }
}
