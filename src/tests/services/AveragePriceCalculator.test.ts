import { describe, it, expect } from 'bun:test';
import { Operation } from '../../core/entities/Operation.ts';
import { AveragePriceCalculator } from '../../core/services/AveragePriceCalculator.ts';

describe('AveragePriceCalculator', () => {
  const calculator = new AveragePriceCalculator();

  it('should sort operations chronologically by date ascending, with buy before sell on the same date', () => {
    const op1 = new Operation('1', new Date(2026, 7, 25), 'PETR4', 'sell', 10, 40, 0);
    const op2 = new Operation('2', new Date(2026, 7, 20), 'PETR4', 'sell', 10, 30, 0);
    const op3 = new Operation('3', new Date(2026, 7, 20), 'PETR4', 'buy', 10, 20, 0);
    const op4 = new Operation('4', new Date(2026, 7, 10), 'PETR4', 'buy', 5, 25, 0);

    const sorted = calculator.sortOperations([op1, op2, op3, op4]);

    // Chronological order:
    // 2026-08-10: op4 (buy)
    // 2026-08-20: op3 (buy) before op2 (sell) on the same date
    // 2026-08-25: op1 (sell)
    expect(sorted[0].id).toBe('4'); // 2026-08-10 Buy
    expect(sorted[1].id).toBe('3'); // 2026-08-20 Buy (same day tie-breaker before sell)
    expect(sorted[2].id).toBe('2'); // 2026-08-20 Sell
    expect(sorted[3].id).toBe('1'); // 2026-08-25 Sell
  });

  it('should calculate weighted average price on multiple buys', () => {
    // Buy 10 @ 20 = 200
    // Buy 10 @ 30 = 300
    // Total = 20 @ 25 = 500
    const op1 = new Operation('1', new Date(2026, 7, 1), 'VALE3', 'buy', 10, 20, 0);
    const op2 = new Operation('2', new Date(2026, 7, 2), 'VALE3', 'buy', 10, 30, 0);

    const positions = calculator.calculate([op1, op2]);

    expect(positions.length).toBe(1);
    expect(positions[0].ticker).toBe('VALE3');
    expect(positions[0].quantity).toBe(20);
    expect(positions[0].averagePrice).toBe(25);
    expect(positions[0].totalCost).toBe(500);
  });

  it('should keep average price unchanged on sell', () => {
    // Buy 10 @ 20 = 200
    // Sell 5 @ 35
    // Remaining: 5 @ 20 = 100
    const op1 = new Operation('1', new Date(2026, 7, 1), 'VALE3', 'buy', 10, 20, 0);
    const op2 = new Operation('2', new Date(2026, 7, 2), 'VALE3', 'sell', 5, 35, 0);

    const positions = calculator.calculate([op1, op2]);

    expect(positions.length).toBe(1);
    expect(positions[0].quantity).toBe(5);
    expect(positions[0].averagePrice).toBe(20);
    expect(positions[0].totalCost).toBe(100);
  });

  it('should correctly calculate positions from fixture operations (CPTI11 average price)', () => {
    // In fixture:
    // CPTI11: Buy 1 @ 80.98 on 18/08/2026
    // CPTI11: Buy 1 @ 82.63 on 25/08/2026
    // Total = 2 @ (80.98 + 82.63)/2 = 81.805 -> totalCost: 163.61
    const op1 = new Operation('1', new Date(2026, 7, 25), 'CPTI11', 'buy', 1, 82.63, 0);
    const op2 = new Operation('2', new Date(2026, 7, 18), 'CPTI11', 'buy', 1, 80.98, 0);

    const positions = calculator.calculate([op1, op2]);

    expect(positions.length).toBe(1);
    expect(positions[0].ticker).toBe('CPTI11');
    expect(positions[0].quantity).toBe(2);
    expect(positions[0].averagePrice).toBe(81.805);
    expect(positions[0].totalCost).toBe(163.61);
  });
});
