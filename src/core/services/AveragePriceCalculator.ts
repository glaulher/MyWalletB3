import { Operation } from '../entities/Operation.ts';
import { ConsolidatedPosition } from '../entities/ConsolidatedPosition.ts';
import { B3Parser } from './B3Parser.ts';

export class AveragePriceCalculator {
  private b3Parser = new B3Parser();

  /**
   * Sorts operations chronologically by date/time ascending.
   * On same date/time (intraday), purchases ('buy') are processed before sales ('sell').
   */
  sortOperations(operations: Operation[]): Operation[] {
    return [...operations].sort((a, b) => {
      // 1. Data do negócio: oldest to newest
      const timeDiff = a.date.getTime() - b.date.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // 2. Intraday tie-breaker: 'buy' comes before 'sell'
      if (a.type !== b.type) {
        return a.type === 'buy' ? -1 : 1;
      }
      return 0;
    });
  }

  /**
   * Calculates consolidated positions with average price and total cost.
   */
  calculate(operations: Operation[]): ConsolidatedPosition[] {
    const sortedOps = this.sortOperations(operations);

    // Group calculation per asset ticker
    const positionsMap = new Map<
      string,
      {
        quantity: number;
        averagePrice: number;
        totalCost: number;
      }
    >();

    for (const op of sortedOps) {
      const ticker = op.asset.toUpperCase().trim();
      const current = positionsMap.get(ticker) ?? {
        quantity: 0,
        averagePrice: 0,
        totalCost: 0,
      };

      if (op.type === 'buy') {
        const opTotalCost = op.quantity * op.unitPrice + op.fees;
        const newQuantity = current.quantity + op.quantity;
        const newTotalCost = current.totalCost + opTotalCost;
        const newAveragePrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;

        positionsMap.set(ticker, {
          quantity: newQuantity,
          averagePrice: Math.round(newAveragePrice * 10000) / 10000,
          totalCost: Math.round(newTotalCost * 100) / 100,
        });
      } else if (op.type === 'sell') {
        // Sales maintain the average price, decrease quantity
        const newQuantity = Math.max(0, current.quantity - op.quantity);
        const newTotalCost =
          newQuantity > 0 ? Math.round(newQuantity * current.averagePrice * 100) / 100 : 0;
        const avgPrice = newQuantity > 0 ? current.averagePrice : 0;

        positionsMap.set(ticker, {
          quantity: newQuantity,
          averagePrice: avgPrice,
          totalCost: newTotalCost,
        });
      }
    }

    const consolidated: ConsolidatedPosition[] = [];

    for (const [ticker, data] of positionsMap.entries()) {
      if (data.quantity > 0) {
        const assetType = this.b3Parser.detectAssetType(ticker);
        consolidated.push(
          new ConsolidatedPosition(
            ticker,
            data.quantity,
            data.averagePrice,
            data.totalCost,
            assetType,
          ),
        );
      }
    }

    // Sort by total cost descending (highest allocation first)
    return consolidated.sort((a, b) => b.totalCost - a.totalCost);
  }
}
