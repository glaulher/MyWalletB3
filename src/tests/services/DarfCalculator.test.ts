import { describe, it, expect } from 'bun:test';
import { DarfCalculator } from '../../core/services/DarfCalculator.ts';
import { Operation } from '../../core/entities/Operation.ts';

describe('DarfCalculator', () => {
  const calculator = new DarfCalculator();

  it('should apply exemption for stock sales up to R$ 20.000 in a month', () => {
    // Buy 100 @ 30 = 3000 on day 5
    // Sell 100 @ 40 = 4000 on day 20 (Sales < 20000 -> Exempt)
    const op1 = new Operation('1', new Date(2026, 7, 5), 'PETR4', 'buy', 100, 30, 0);
    const op2 = new Operation('2', new Date(2026, 7, 20), 'PETR4', 'sell', 100, 40, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].monthYear).toBe('08/2026');
    expect(darfs[0].stockSales).toBe(4000);
    expect(darfs[0].isStockExempt).toBe(true);
    expect(darfs[0].stockProfit).toBe(1000);
    expect(darfs[0].taxDue).toBe(0); // Exempt
  });

  it('should calculate 15% tax on stock profits when monthly sales exceed R$ 20.000', () => {
    // Buy 1000 @ 30 = 30.000 on day 1
    // Sell 1000 @ 35 = 35.000 on day 15 (Sales > 20.000 -> Taxable)
    // Profit = 5.000 -> 15% = 750
    const op1 = new Operation('1', new Date(2026, 7, 1), 'VALE3', 'buy', 1000, 30, 0);
    const op2 = new Operation('2', new Date(2026, 7, 15), 'VALE3', 'sell', 1000, 35, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].stockSales).toBe(35000);
    expect(darfs[0].isStockExempt).toBe(false);
    expect(darfs[0].stockProfit).toBe(5000);
    expect(darfs[0].taxDue).toBe(750);
  });

  it('should calculate 20% fixed tax on Units (like TAEE11) without 20k exemption', () => {
    // Buy 100 @ 30 = 3000 on day 1
    // Sell 100 @ 40 = 4000 on day 15 (Total sales 4000 < 20000, but Units have 20% fixed tax)
    // Profit = 1000 -> 20% = 200
    const op1 = new Operation('1', new Date(2026, 7, 1), 'TAEE11', 'buy', 100, 30, 0);
    const op2 = new Operation('2', new Date(2026, 7, 15), 'TAEE11', 'sell', 100, 40, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].unitSales).toBe(4000);
    expect(darfs[0].unitProfit).toBe(1000);
    expect(darfs[0].unitTax).toBe(200);
    expect(darfs[0].taxDue).toBe(200);
  });

  it('should calculate 20% fixed tax on BDRs without 20k exemption', () => {
    // Buy 10 @ 100 = 1000 on day 1
    // Sell 10 @ 150 = 1500 on day 15
    // Profit = 500 -> 20% = 100
    const op1 = new Operation('1', new Date(2026, 7, 1), 'BERK34', 'buy', 10, 100, 0);
    const op2 = new Operation('2', new Date(2026, 7, 15), 'BERK34', 'sell', 10, 150, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].bdrSales).toBe(1500);
    expect(darfs[0].bdrProfit).toBe(500);
    expect(darfs[0].bdrTax).toBe(100);
    expect(darfs[0].taxDue).toBe(100);
  });

  it('should calculate 20% tax on Day Trade (bought and sold on the same day)', () => {
    // On the same day 2026-08-10:
    // Buy 50 PETR4 @ 30 = 1500
    // Sell 50 PETR4 @ 34 = 1700
    // Day trade profit = 200 -> 20% = 40 (regardless of 20k limit)
    const op1 = new Operation('1', new Date(2026, 7, 10, 10, 0), 'PETR4', 'buy', 50, 30, 0);
    const op2 = new Operation('2', new Date(2026, 7, 10, 14, 0), 'PETR4', 'sell', 50, 34, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].dayTradeProfit).toBe(200);
    expect(darfs[0].dayTradeTax).toBe(40);
    expect(darfs[0].taxDue).toBe(40);
  });

  it('should calculate 20% tax on FII profits regardless of monthly volume', () => {
    // Buy 10 @ 100 = 1000
    // Sell 10 @ 120 = 1200
    // Profit = 200 -> 20% = 40
    const op1 = new Operation('1', new Date(2026, 7, 1), 'HGLG11', 'buy', 10, 100, 0);
    const op2 = new Operation('2', new Date(2026, 7, 10), 'HGLG11', 'sell', 10, 120, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].fiiSales).toBe(1200);
    expect(darfs[0].fiiProfit).toBe(200);
    expect(darfs[0].taxDue).toBe(40);
  });

  it('should compensate losses from prior months before calculating taxes', () => {
    // Month 1 (July 2026): FII Buy 10 @ 100, Sell 10 @ 80 -> Loss 200
    const op1 = new Operation('1', new Date(2026, 6, 1), 'HGLG11', 'buy', 10, 100, 0);
    const op2 = new Operation('2', new Date(2026, 6, 15), 'HGLG11', 'sell', 10, 80, 0);

    // Month 2 (August 2026): FII Buy 10 @ 80, Sell 10 @ 110 -> Profit 300
    // After loss compensation (300 - 200 = 100 taxable) -> 20% of 100 = 20
    const op3 = new Operation('3', new Date(2026, 7, 1), 'HGLG11', 'buy', 10, 80, 0);
    const op4 = new Operation('4', new Date(2026, 7, 15), 'HGLG11', 'sell', 10, 110, 0);

    const darfs = calculator.calculate([op1, op2, op3, op4]);

    expect(darfs.length).toBe(2);

    const julyDarf = darfs.find((d) => d.monthYear === '07/2026');
    const augDarf = darfs.find((d) => d.monthYear === '08/2026');

    expect(julyDarf?.fiiProfit).toBe(-200);
    expect(julyDarf?.taxDue).toBe(0);

    expect(augDarf?.fiiProfit).toBe(300);
    expect(augDarf?.fiiTax).toBe(20);
    expect(augDarf?.taxDue).toBe(20);
    expect(augDarf?.lossesCarriedOver.fii).toBe(0);
  });

  it('should calculate 15% tax on Options swing trade without 20k exemption', () => {
    // Buy 1000 PETRL300 @ 1.00 = 1000 on day 1
    // Sell 1000 PETRL300 @ 2.50 = 2500 on day 15 (Sales = 2500 < 20.000, but options have no exemption)
    // Profit = 1500 -> 15% = 225
    const op1 = new Operation('1', new Date(2026, 7, 1), 'PETRL300', 'buy', 1000, 1.0, 0);
    const op2 = new Operation('2', new Date(2026, 7, 15), 'PETRL300', 'sell', 1000, 2.5, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].optionSales).toBe(2500);
    expect(darfs[0].optionProfit).toBe(1500);
    expect(darfs[0].optionTax).toBe(225);
    expect(darfs[0].taxDue).toBe(225);
  });

  it('should calculate 20% tax on Options Day Trade (bought and sold on the same day)', () => {
    // On the same day 2026-08-10:
    // Buy 1000 VALEL650 @ 1.20 = 1200
    // Sell 1000 VALEL650 @ 1.80 = 1800
    // Day trade profit = 600 -> 20% = 120
    const op1 = new Operation('1', new Date(2026, 7, 10, 10, 0), 'VALEL650', 'buy', 1000, 1.2, 0);
    const op2 = new Operation('2', new Date(2026, 7, 10, 15, 0), 'VALEL650', 'sell', 1000, 1.8, 0);

    const darfs = calculator.calculate([op1, op2]);

    expect(darfs.length).toBe(1);
    expect(darfs[0].dayTradeProfit).toBe(600);
    expect(darfs[0].dayTradeTax).toBe(120);
    expect(darfs[0].taxDue).toBe(120);
  });

  it('should compensate Options losses from prior months', () => {
    // Month 1 (July 2026): Buy 1000 @ 2.00, Sell 1000 @ 1.00 -> Loss 1000
    const op1 = new Operation('1', new Date(2026, 6, 1), 'PETRL300', 'buy', 1000, 2.0, 0);
    const op2 = new Operation('2', new Date(2026, 6, 15), 'PETRL300', 'sell', 1000, 1.0, 0);

    // Month 2 (August 2026): Buy 1000 @ 1.00, Sell 1000 @ 3.00 -> Profit 2000
    // After loss compensation (2000 - 1000 = 1000 taxable) -> 15% of 1000 = 150
    const op3 = new Operation('3', new Date(2026, 7, 1), 'PETRL300', 'buy', 1000, 1.0, 0);
    const op4 = new Operation('4', new Date(2026, 7, 15), 'PETRL300', 'sell', 1000, 3.0, 0);

    const darfs = calculator.calculate([op1, op2, op3, op4]);

    expect(darfs.length).toBe(2);

    const julyDarf = darfs.find((d) => d.monthYear === '07/2026');
    const augDarf = darfs.find((d) => d.monthYear === '08/2026');

    expect(julyDarf?.optionProfit).toBe(-1000);
    expect(julyDarf?.taxDue).toBe(0);

    expect(augDarf?.optionProfit).toBe(2000);
    expect(augDarf?.optionTax).toBe(150);
    expect(augDarf?.taxDue).toBe(150);
    expect(augDarf?.lossesCarriedOver.option).toBe(0);
  });
});
