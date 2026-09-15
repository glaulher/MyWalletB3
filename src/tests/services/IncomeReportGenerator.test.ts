import { describe, it, expect } from 'bun:test';
import { IncomeReportGenerator } from '../../core/services/IncomeReportGenerator.ts';
import { Operation } from '../../core/entities/Operation.ts';

describe('IncomeReportGenerator', () => {
  const generator = new IncomeReportGenerator();

  it('should generate report items with proper Revenue codes and descriptions for 31/12', () => {
    const op1 = new Operation(
      '1',
      new Date(2025, 5, 10),
      'PETR4',
      'buy',
      100,
      25,
      0,
      'ITAU CV S/A',
    );
    const op2 = new Operation(
      '2',
      new Date(2026, 4, 15),
      'PETR4',
      'buy',
      100,
      35,
      0,
      'ITAU CV S/A',
    );
    const op3 = new Operation(
      '3',
      new Date(2026, 7, 20),
      'HGLG11',
      'buy',
      10,
      150,
      0,
      'XP INVESTIMENTOS',
    );

    const report2026 = generator.generateReport([op1, op2, op3], 2026);

    expect(report2026.length).toBe(2);

    const petr = report2026.find((r) => r.ticker === 'PETR4');
    expect(petr).toBeDefined();
    expect(petr?.groupCode).toBe('03');
    expect(petr?.itemCode).toBe('01');
    expect(petr?.quantity).toBe(200);
    expect(petr?.averagePrice).toBe(30);
    expect(petr?.currentYearCost).toBe(6000);
    expect(petr?.previousYearCost).toBe(2500); // in 2025 was 100 @ 25
    expect(petr?.description).toContain('200 ações de PETR4');
    expect(petr?.description).toContain('ITAU CV S/A');

    const hglg = report2026.find((r) => r.ticker === 'HGLG11');
    expect(hglg).toBeDefined();
    expect(hglg?.groupCode).toBe('07');
    expect(hglg?.itemCode).toBe('03');
    expect(hglg?.quantity).toBe(10);
    expect(hglg?.currentYearCost).toBe(1500);
    expect(hglg?.previousYearCost).toBe(0); // bought in 2026
    expect(hglg?.description).toContain('10 cotas de HGLG11');
  });
});
