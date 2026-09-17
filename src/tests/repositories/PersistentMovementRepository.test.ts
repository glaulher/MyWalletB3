import { describe, expect, it, beforeEach } from 'bun:test';
import { Movement } from '../../core/entities/Movement.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';
import { InMemoryMovementRepository } from '../../infrastructure/repositories/InMemoryMovementRepository.ts';

describe('MovementRepository (In-Memory & Contract)', () => {
  let repo: InMemoryMovementRepository;

  beforeEach(() => {
    repo = new InMemoryMovementRepository();
  });

  it('should save and retrieve movements', async () => {
    const mov1 = new Movement(
      'm1',
      new Date('2024-03-10'),
      'Rendimento',
      'yield',
      'credit',
      'CPTI11',
      'CPTI11 - CAPITANIA',
      100,
      1.0,
      100,
      'XP',
      'b1',
    );
    const mov2 = new Movement(
      'm2',
      new Date('2024-03-15'),
      'Dividendo',
      'dividend',
      'credit',
      'VALE3',
      'VALE3 - VALE S.A.',
      50,
      2.0,
      100,
      'CLEAR',
      'b1',
    );
    const mov3 = new Movement(
      'm3',
      new Date('2024-03-20'),
      'Transferência',
      'transfer',
      'debit',
      'BRL',
      'TED',
      1,
      200,
      200,
      'XP',
      'b2',
    );

    await repo.addAll([mov1, mov2, mov3]);

    const all = await repo.getAll();
    expect(all.length).toBe(3);

    const cpti = await repo.getByAsset('CPTI11');
    expect(cpti.length).toBe(1);
    expect(cpti[0].id).toBe('m1');

    const incomes = await repo.getIncomes();
    expect(incomes.length).toBe(2);
    expect(incomes.map((i) => i.id)).toEqual(['m1', 'm2']);
  });

  it('should handle batch removal cleanly', async () => {
    const batch = new ImportBatch('b1', 'mov.xlsx', new Date(), 2);
    await repo.saveBatch(batch);

    const mov1 = new Movement(
      'm1',
      new Date('2024-03-10'),
      'Rendimento',
      'yield',
      'credit',
      'CPTI11',
      'CPTI11',
      100,
      1.0,
      100,
      'XP',
      'b1',
    );
    const mov2 = new Movement(
      'm2',
      new Date('2024-03-15'),
      'Dividendo',
      'dividend',
      'credit',
      'VALE3',
      'VALE3',
      50,
      2.0,
      100,
      'CLEAR',
      'b2',
    );

    await repo.addAll([mov1, mov2]);

    expect(await repo.getLastBatch()).toEqual(batch);

    await repo.removeBatch('b1');

    const remaining = await repo.getAll();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('m2');
    expect(await repo.getLastBatch()).toBeNull();
  });
});
