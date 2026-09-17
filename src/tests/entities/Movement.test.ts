import { describe, expect, it } from 'bun:test';
import { Movement } from '../../core/entities/Movement.ts';

describe('Movement Entity', () => {
  it('should initialize properties correctly', () => {
    const movement = new Movement(
      'mov-1',
      new Date('2024-05-15T00:00:00Z'),
      'Rendimento',
      'yield',
      'credit',
      'CPTI11',
      'CPTI11 - CAPITÂNIA SECURITIES II FII',
      100,
      1.05,
      105.0,
      'XP INVESTIMENTOS',
      'batch-123',
    );

    expect(movement.id).toBe('mov-1');
    expect(movement.date.toISOString()).toBe('2024-05-15T00:00:00.000Z');
    expect(movement.movementType).toBe('Rendimento');
    expect(movement.category).toBe('yield');
    expect(movement.direction).toBe('credit');
    expect(movement.asset).toBe('CPTI11');
    expect(movement.rawProduct).toBe('CPTI11 - CAPITÂNIA SECURITIES II FII');
    expect(movement.quantity).toBe(100);
    expect(movement.unitPrice).toBe(1.05);
    expect(movement.totalValue).toBe(105.0);
    expect(movement.institution).toBe('XP INVESTIMENTOS');
    expect(movement.batchId).toBe('batch-123');
    expect(movement.isIncome).toBe(true);
  });

  it('should correctly identify non-income movements', () => {
    const debitMov = new Movement(
      'mov-2',
      new Date('2024-05-10'),
      'Transferência',
      'transfer',
      'debit',
      'BRL',
      'SALDO EM CONTA',
      1,
      500,
      500,
      'CLEAR',
    );
    expect(debitMov.isIncome).toBe(false);

    const bonusMov = new Movement(
      'mov-3',
      new Date('2024-06-01'),
      'Bonificação em Ativos',
      'bonus',
      'credit',
      'BBDC4',
      'BBDC4 - BANCO BRADESCO S.A.',
      10,
      0,
      0,
      'ÁGORA',
    );
    expect(bonusMov.isIncome).toBe(false);
  });

  it('should treat dividend and jcp credits as income', () => {
    const dividend = new Movement(
      'mov-4',
      new Date('2024-07-01'),
      'Dividendo',
      'dividend',
      'credit',
      'VALE3',
      'VALE3 - VALE S.A.',
      50,
      2.1,
      105,
    );
    expect(dividend.isIncome).toBe(true);

    const jcp = new Movement(
      'mov-5',
      new Date('2024-07-15'),
      'Juros Sobre Capital Próprio',
      'jcp',
      'credit',
      'ITUB4',
      'ITUB4 - ITAU UNIBANCO',
      100,
      0.25,
      25,
    );
    expect(jcp.isIncome).toBe(true);
  });
});
