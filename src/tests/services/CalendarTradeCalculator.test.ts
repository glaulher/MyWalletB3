import { describe, it, expect } from 'bun:test';
import { Operation } from '../../core/entities/Operation.ts';
import { CalendarTradeCalculator } from '../../core/services/CalendarTradeCalculator.ts';

describe('CalendarTradeCalculator', () => {
  const calculator = new CalendarTradeCalculator();

  it('should mark a day with only buys as "buy-only" with zero realized profit', () => {
    // 2026-07-01: Buy 100 PETR4 @ 20 (fees 0) = 2000
    const op = new Operation('1', new Date(2026, 6, 1, 10, 0, 0), 'PETR4', 'buy', 100, 20, 0);

    const result = calculator.calculate([op]);
    const day = result.getDaySummary('2026-07-01');

    expect(day).not.toBeNull();
    expect(day?.status).toBe('buy-only');
    expect(day?.hasLoss).toBe(false);
    expect(day?.hasProfit).toBe(false);
    expect(day?.totalBought).toBe(2000);
    expect(day?.totalSold).toBe(0);
    expect(day?.realizedProfit).toBe(0);
    expect(day?.operations.length).toBe(1);
  });

  it('should mark a day with profitable sale as "profit" and not loss', () => {
    // 2026-07-01: Buy 100 VALE3 @ 20 = 2000 (PM 20)
    // 2026-07-05: Sell 50 VALE3 @ 30 = 1500 (Cost basis: 50 * 20 = 1000, Profit = +500)
    const op1 = new Operation('1', new Date(2026, 6, 1, 10, 0, 0), 'VALE3', 'buy', 100, 20, 0);
    const op2 = new Operation('2', new Date(2026, 6, 5, 14, 0, 0), 'VALE3', 'sell', 50, 30, 0);

    const result = calculator.calculate([op1, op2]);
    const day = result.getDaySummary('2026-07-05');

    expect(day).not.toBeNull();
    expect(day?.status).toBe('profit');
    expect(day?.hasLoss).toBe(false);
    expect(day?.hasProfit).toBe(true);
    expect(day?.totalSold).toBe(1500);
    expect(day?.realizedProfit).toBe(500);
    expect(day?.operations[0].costBasis).toBe(1000);
    expect(day?.operations[0].avgPriceBefore).toBe(20);
  });

  it('MANDATORY RULE: should mark a day with negative sales result as "loss" (quadrado vermelho)', () => {
    // 2026-07-01: Buy 100 BBAS3 @ 40 = 4000 (PM 40)
    // 2026-07-10: Sell 50 BBAS3 @ 32 = 1600 (Cost basis: 50 * 40 = 2000, Loss = -400)
    const op1 = new Operation('1', new Date(2026, 6, 1, 10, 0, 0), 'BBAS3', 'buy', 100, 40, 0);
    const op2 = new Operation('2', new Date(2026, 6, 10, 11, 0, 0), 'BBAS3', 'sell', 50, 32, 0);

    const result = calculator.calculate([op1, op2]);
    const day = result.getDaySummary('2026-07-10');

    expect(day).not.toBeNull();
    expect(day?.status).toBe('loss');
    expect(day?.hasLoss).toBe(true);
    expect(day?.hasProfit).toBe(false);
    expect(day?.totalSold).toBe(1600);
    expect(day?.realizedProfit).toBe(-400);
    expect(day?.operations[0].realizedProfit).toBe(-400);
  });

  it('should mark a day with both buy and loss-making sale as "loss" (red highlight takes priority)', () => {
    // 2026-07-01: Buy 100 ITUB4 @ 35 = 3500
    // 2026-07-15: Sell 50 ITUB4 @ 25 = 1250 (Cost basis: 50 * 35 = 1750, Loss = -500)
    // 2026-07-15: Buy 100 WEGE3 @ 40 = 4000
    const op1 = new Operation('1', new Date(2026, 6, 1, 10, 0, 0), 'ITUB4', 'buy', 100, 35, 0);
    const op2 = new Operation('2', new Date(2026, 6, 15, 11, 0, 0), 'ITUB4', 'sell', 50, 25, 0);
    const op3 = new Operation('3', new Date(2026, 6, 15, 14, 0, 0), 'WEGE3', 'buy', 100, 40, 0);

    const result = calculator.calculate([op1, op2, op3]);
    const day = result.getDaySummary('2026-07-15');

    expect(day).not.toBeNull();
    expect(day?.status).toBe('loss');
    expect(day?.hasLoss).toBe(true);
    expect(day?.totalBought).toBe(4000);
    expect(day?.totalSold).toBe(1250);
    expect(day?.realizedProfit).toBe(-500);
    expect(day?.operations.length).toBe(2);
  });

  it('should calculate net daily profit when multiple sales occur on the same day', () => {
    // 2026-07-01: Buy 100 PETR4 @ 20 = 2000, Buy 100 VALE3 @ 50 = 5000
    // 2026-07-20: Sell 50 PETR4 @ 26 = 1300 (+300 profit)
    // 2026-07-20: Sell 50 VALE3 @ 40 = 2000 (-500 loss)
    // Net result on 2026-07-20: +300 - 500 = -200 (LOSS -> status 'loss', hasLoss = true)
    const op1 = new Operation('1', new Date(2026, 6, 1, 9, 0, 0), 'PETR4', 'buy', 100, 20, 0);
    const op2 = new Operation('2', new Date(2026, 6, 1, 9, 30, 0), 'VALE3', 'buy', 100, 50, 0);
    const op3 = new Operation('3', new Date(2026, 6, 20, 11, 0, 0), 'PETR4', 'sell', 50, 26, 0);
    const op4 = new Operation('4', new Date(2026, 6, 20, 15, 0, 0), 'VALE3', 'sell', 50, 40, 0);

    const result = calculator.calculate([op1, op2, op3, op4]);
    const day = result.getDaySummary('2026-07-20');

    expect(day).not.toBeNull();
    expect(day?.status).toBe('loss');
    expect(day?.hasLoss).toBe(true);
    expect(day?.realizedProfit).toBe(-200);
    expect(day?.totalSold).toBe(3300);
  });

  it('should correctly aggregate Month and Year summaries and list available years', () => {
    // Ops across July 2026 and August 2026
    const op1 = new Operation('1', new Date(2026, 6, 1, 10, 0, 0), 'PETR4', 'buy', 100, 20, 0); // Jul: 2000 bought
    const op2 = new Operation('2', new Date(2026, 6, 10, 10, 0, 0), 'PETR4', 'sell', 50, 30, 0); // Jul: 1500 sold, +500 profit
    const op3 = new Operation('3', new Date(2026, 7, 5, 10, 0, 0), 'PETR4', 'sell', 50, 15, 0); // Aug: 750 sold, -250 loss

    const result = calculator.calculate([op1, op2, op3]);

    // July 2026
    const jul = result.getMonthSummary(2026, 6);
    expect(jul.totalBought).toBe(2000);
    expect(jul.totalSold).toBe(1500);
    expect(jul.realizedProfit).toBe(500);
    expect(jul.operationsCount).toBe(2);
    expect(jul.daysWithLoss).toBe(0);
    expect(jul.daysWithProfit).toBe(1);

    // August 2026
    const aug = result.getMonthSummary(2026, 7);
    expect(aug.totalBought).toBe(0);
    expect(aug.totalSold).toBe(750);
    expect(aug.realizedProfit).toBe(-250);
    expect(aug.daysWithLoss).toBe(1);

    // Year 2026
    const yr2026 = result.getYearSummary(2026);
    expect(yr2026.totalBought).toBe(2000);
    expect(yr2026.totalSold).toBe(2250);
    expect(yr2026.realizedProfit).toBe(250); // 500 - 250 = 250
    expect(yr2026.operationsCount).toBe(3);

    expect(result.getAvailableYears()).toEqual([2026]);
  });
});
