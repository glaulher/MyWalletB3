import { describe, it, expect } from 'bun:test';
import { Operation } from '../../core/entities/Operation.ts';
import { TradeSummaryCalculator } from '../../core/services/TradeSummaryCalculator.ts';

describe('TradeSummaryCalculator', () => {
  const calculator = new TradeSummaryCalculator();

  it('should calculate total bought quantity and average buy price correctly', () => {
    // Buy 100 @ 20 (fees 0) = 2000
    // Buy 100 @ 30 (fees 0) = 3000
    // Total bought: 200, Total value: 5000, PM Compra: 25, Saldo: 200
    const op1 = new Operation('1', new Date(2026, 6, 1), 'PETR4', 'buy', 100, 20, 0);
    const op2 = new Operation('2', new Date(2026, 6, 15), 'PETR4', 'buy', 100, 30, 0);

    const summaries = calculator.calculate([op1, op2]);

    expect(summaries.length).toBe(1);
    const petr = summaries[0];
    expect(petr.ticker).toBe('PETR4');
    expect(petr.type).toBe('stock');
    expect(petr.totalBoughtQty).toBe(200);
    expect(petr.totalBoughtValue).toBe(5000);
    expect(petr.avgBuyPrice).toBe(25);
    expect(petr.totalSoldQty).toBe(0);
    expect(petr.totalSoldValue).toBe(0);
    expect(petr.avgSellPrice).toBe(0);
    expect(petr.currentQty).toBe(200);
    expect(petr.currentAvgPrice).toBe(25);
    expect(petr.currentTotalCost).toBe(5000);
    expect(petr.realizedProfit).toBe(0);
  });

  it('should calculate partial sale with realized profit and unchanged current PM', () => {
    // Buy 100 @ 20 = 2000 (PM 20)
    // Sell 40 @ 35 = 1400 (Net 1400, Cost basis 40 * 20 = 800, Profit = +600)
    // Remaining: 60 @ 20 = 1200
    const op1 = new Operation('1', new Date(2026, 6, 1), 'VALE3', 'buy', 100, 20, 0);
    const op2 = new Operation('2', new Date(2026, 6, 20), 'VALE3', 'sell', 40, 35, 0);

    const summaries = calculator.calculate([op1, op2]);

    expect(summaries.length).toBe(1);
    const vale = summaries[0];
    expect(vale.totalBoughtQty).toBe(100);
    expect(vale.totalBoughtValue).toBe(2000);
    expect(vale.avgBuyPrice).toBe(20);
    expect(vale.totalSoldQty).toBe(40);
    expect(vale.totalSoldValue).toBe(1400);
    expect(vale.avgSellPrice).toBe(35);
    expect(vale.currentQty).toBe(60);
    expect(vale.currentAvgPrice).toBe(20);
    expect(vale.currentTotalCost).toBe(1200);
    expect(vale.realizedProfit).toBe(600);
  });

  it('should identify FI-Infra assets (CPTI11, BDIF11) and FIIs (HGLG11)', () => {
    const op1 = new Operation('1', new Date(2026, 7, 1), 'CPTI11', 'buy', 10, 80, 0);
    const op2 = new Operation('2', new Date(2026, 7, 2), 'BDIF11', 'buy', 5, 70, 0);
    const op3 = new Operation('3', new Date(2026, 7, 3), 'HGLG11', 'buy', 2, 150, 0);

    const summaries = calculator.calculate([op1, op2, op3]);

    const cpti = summaries.find((s) => s.ticker === 'CPTI11');
    const bdif = summaries.find((s) => s.ticker === 'BDIF11');
    const hglg = summaries.find((s) => s.ticker === 'HGLG11');

    expect(cpti?.type).toBe('fi-infra');
    expect(bdif?.type).toBe('fi-infra');
    expect(hglg?.type).toBe('fii');
  });
});
