import { describe, expect, it } from 'bun:test';
import { Movement } from '../../core/entities/Movement.ts';
import { ConsolidatedPosition } from '../../core/entities/ConsolidatedPosition.ts';
import { IncomeCalculator } from '../../core/services/IncomeCalculator.ts';

describe('IncomeCalculator', () => {
  const calculator = new IncomeCalculator();

  it('should aggregate income by categories and calculate totals', () => {
    const movements: Movement[] = [
      new Movement(
        '1',
        new Date('2024-03-15'),
        'Rendimento',
        'yield',
        'credit',
        'CPTI11',
        'CPTI11 FII',
        100,
        1.0,
        100,
      ),
      new Movement(
        '2',
        new Date('2024-04-15'),
        'Rendimento',
        'yield',
        'credit',
        'CPTI11',
        'CPTI11 FII',
        100,
        1.1,
        110,
      ),
      new Movement(
        '3',
        new Date('2024-04-20'),
        'Dividendo',
        'dividend',
        'credit',
        'VALE3',
        'VALE3 S.A.',
        50,
        2.0,
        100,
      ),
      new Movement(
        '4',
        new Date('2024-05-10'),
        'Juros Sobre Capital Próprio',
        'jcp',
        'credit',
        'ITUB4',
        'ITUB4 S.A.',
        200,
        0.2,
        40,
      ),
      new Movement(
        '5',
        new Date('2024-05-12'),
        'Transferência',
        'transfer',
        'debit',
        'BRL',
        'TED',
        1,
        500,
        500,
      ),
    ];

    const positions: ConsolidatedPosition[] = [
      new ConsolidatedPosition('CPTI11', 100, 10.0, 1000.0),
      new ConsolidatedPosition('VALE3', 50, 60.0, 3000.0),
    ];

    const metrics = calculator.calculateMetrics(movements, positions);

    expect(metrics.totalReceived).toBe(350); // 100 + 110 + 100 + 40
    expect(metrics.totalYields).toBe(210); // 100 + 110
    expect(metrics.totalDividends).toBe(100);
    expect(metrics.totalJcp).toBe(40);

    // Monthly evolution
    expect(metrics.monthlyEvolution.length).toBe(3);
    expect(metrics.monthlyEvolution[0].monthKey).toBe('2024-03');
    expect(metrics.monthlyEvolution[0].totalValue).toBe(100);
    expect(metrics.monthlyEvolution[1].monthKey).toBe('2024-04');
    expect(metrics.monthlyEvolution[1].totalValue).toBe(210);
    expect(metrics.monthlyEvolution[2].monthKey).toBe('2024-05');
    expect(metrics.monthlyEvolution[2].totalValue).toBe(40);

    // Asset summaries & YoC
    expect(metrics.assetSummaries.length).toBe(3);
    const cptiSummary = metrics.assetSummaries.find((a) => a.ticker === 'CPTI11');
    expect(cptiSummary).toBeDefined();
    expect(cptiSummary!.totalIncome).toBe(210);
    expect(cptiSummary!.currentQuantity).toBe(100);
    expect(cptiSummary!.currentTotalCost).toBe(1000);
    expect(cptiSummary!.yieldOnCost).toBeCloseTo(21.0, 1); // 210 / 1000 = 21%

    const valeSummary = metrics.assetSummaries.find((a) => a.ticker === 'VALE3');
    expect(valeSummary).toBeDefined();
    expect(valeSummary!.yieldOnCost).toBeCloseTo(3.33, 1); // 100 / 3000 = 3.33%
  });

  it('should handle empty movements gracefully', () => {
    const metrics = calculator.calculateMetrics([]);
    expect(metrics.totalReceived).toBe(0);
    expect(metrics.totalYields).toBe(0);
    expect(metrics.totalDividends).toBe(0);
    expect(metrics.totalJcp).toBe(0);
    expect(metrics.averageMonthlyIncome).toBe(0);
    expect(metrics.monthlyEvolution).toEqual([]);
    expect(metrics.assetSummaries).toEqual([]);
    expect(metrics.categoryAllocation).toEqual([]);
  });
});
