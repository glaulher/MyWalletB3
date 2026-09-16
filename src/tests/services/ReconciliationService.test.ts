import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import { B3PositionParser } from '../../core/services/B3PositionParser.ts';
import { ReconciliationService } from '../../core/services/ReconciliationService.ts';
import { ConsolidatedPosition } from '../../core/entities/ConsolidatedPosition.ts';
import { Operation } from '../../core/entities/Operation.ts';

describe('B3PositionParser & ReconciliationService', () => {
  const parser = new B3PositionParser();
  const service = new ReconciliationService();

  it('should parse actual B3 position spreadsheet with 58 items and correct types', () => {
    const buffer = fs.readFileSync('posicao-2026-09-15-20-31-34.xlsx');
    const items = parser.parse(buffer);

    expect(items.length).toBe(58);

    const irim = items.find((i) => i.ticker === 'IRIM11');
    expect(irim).toBeDefined();
    expect(irim?.assetType).toBe('fii');
    expect(irim?.quantity).toBe(12);

    const cpti = items.find((i) => i.ticker === 'CPTI11');
    expect(cpti).toBeDefined();
    expect(cpti?.assetType).toBe('fi-infra');
    expect(cpti?.quantity).toBe(6);

    const berk = items.find((i) => i.ticker === 'BERK34');
    expect(berk).toBeDefined();
    expect(berk?.assetType).toBe('bdr');
    expect(berk?.quantity).toBe(1);
  });

  it('should detect worthless option when option is in app custody but 0 in B3', () => {
    const calcPositions = [new ConsolidatedPosition('PETRL300', 100, 1.5, 150, 'option')];
    const b3Items = [
      {
        ticker: 'VALE3',
        productName: 'VALE',
        assetType: 'stock' as const,
        quantity: 100,
        closePrice: 60,
        updatedValue: 6000,
        institutions: ['XP'],
      },
    ];

    const results = service.reconcile(calcPositions, b3Items);
    const petrl = results.find((r) => r.ticker === 'PETRL300');

    expect(petrl).toBeDefined();
    expect(petrl?.type).toBe('OPTION_WORTHLESS');
    expect(petrl?.calculatedQty).toBe(100);
    expect(petrl?.b3Qty).toBe(0);

    // Test creation of worthless option operation
    const op = service.createWorthlessOptionOperation('PETRL300', 100);
    expect(op.type).toBe('sell');
    expect(op.unitPrice).toBe(0);
    expect(op.quantity).toBe(100);
    expect(op.institution).toContain('Virou Pó');
  });

  it('should detect suspected stock split when B3 quantity is integer multiple', () => {
    const calcPositions = [new ConsolidatedPosition('WEGE3', 10, 40, 400, 'stock')];
    const b3Items = [
      {
        ticker: 'WEGE3',
        productName: 'WEG',
        assetType: 'stock' as const,
        quantity: 20, // 2x
        closePrice: 25,
        updatedValue: 500,
        institutions: ['XP'],
      },
    ];

    const results = service.reconcile(calcPositions, b3Items);
    const wege = results.find((r) => r.ticker === 'WEGE3');

    expect(wege).toBeDefined();
    expect(wege?.type).toBe('SPLIT_SUSPECTED');
    expect(wege?.ratio).toBe(2);

    // Test creation of split operation
    const op = service.createSplitOperation('WEGE3', 10, 2);
    expect(op.type).toBe('buy');
    expect(op.quantity).toBe(10); // 10 additional shares
    expect(op.unitPrice).toBe(0);
    expect(op.institution).toContain('Split 1:2');
  });

  it('should detect matches correctly', () => {
    const calcPositions = [new ConsolidatedPosition('BERK34', 1, 129.74, 129.74, 'bdr')];
    const b3Items = [
      {
        ticker: 'BERK34',
        productName: 'BERKSHIRE',
        assetType: 'bdr' as const,
        quantity: 1,
        closePrice: 132.46,
        updatedValue: 132.46,
        institutions: ['ITAU'],
      },
    ];

    const results = service.reconcile(calcPositions, b3Items);
    const berk = results.find((r) => r.ticker === 'BERK34');

    expect(berk).toBeDefined();
    expect(berk?.type).toBe('MATCH');
  });

  it('should decode B3 option ticker 5th character to month and call/put type', () => {
    // Calls A-L
    expect(service.getOptionExpirationMonth('PETRA300')).toEqual({
      monthIndex: 0,
      optionType: 'CALL',
    });
    expect(service.getOptionExpirationMonth('PETRL380')).toEqual({
      monthIndex: 11,
      optionType: 'CALL',
    });

    // Puts M-X
    expect(service.getOptionExpirationMonth('VALEM650')).toEqual({
      monthIndex: 0,
      optionType: 'PUT',
    });
    expect(service.getOptionExpirationMonth('BOVAP110')).toEqual({
      monthIndex: 3,
      optionType: 'PUT',
    });
    expect(service.getOptionExpirationMonth('PETRX200')).toEqual({
      monthIndex: 11,
      optionType: 'PUT',
    });

    // Non options
    expect(service.getOptionExpirationMonth('PETR4')).toBeNull();
    expect(service.getOptionExpirationMonth('WEGE3')).toBeNull();
  });

  it('should calculate the 3rd Friday of any month correctly (official B3 expiration)', () => {
    // Dec 2024: 3rd Friday is Dec 20
    const dec2024 = service.getThirdFriday(2024, 11);
    expect(dec2024.getDate()).toBe(20);
    expect(dec2024.getDay()).toBe(5);

    // Apr 2024: 3rd Friday is Apr 19
    const apr2024 = service.getThirdFriday(2024, 3);
    expect(apr2024.getDate()).toBe(19);
    expect(apr2024.getDay()).toBe(5);

    // Jan 2024: 3rd Friday is Jan 19
    const jan2024 = service.getThirdFriday(2024, 0);
    expect(jan2024.getDate()).toBe(19);
    expect(jan2024.getDay()).toBe(5);

    // Feb 2024: 3rd Friday is Feb 16
    const feb2024 = service.getThirdFriday(2024, 1);
    expect(feb2024.getDate()).toBe(16);
    expect(feb2024.getDay()).toBe(5);
  });

  it('should calculate exact expiration date from purchase date and option ticker', () => {
    // Bought PETRL380 (Dec Call) in March 2024 -> expires Dec 20, 2024
    const exp1 = service.calculateOptionExpirationDate('PETRL380', new Date('2024-03-10T12:00:00'));
    expect(exp1.getFullYear()).toBe(2024);
    expect(exp1.getMonth()).toBe(11);
    expect(exp1.getDate()).toBe(20);

    // Bought PETRB250 (Feb Call) in November 2023 -> expires Feb 16, 2024 (next year cycle)
    const exp2 = service.calculateOptionExpirationDate('PETRB250', new Date('2023-11-10T12:00:00'));
    expect(exp2.getFullYear()).toBe(2024);
    expect(exp2.getMonth()).toBe(1);
    expect(exp2.getDate()).toBe(16);

    // Bought VALEM650 (Jan Put) in January 2024 before 3rd Friday -> expires Jan 19, 2024
    const exp3 = service.calculateOptionExpirationDate('VALEM650', new Date('2024-01-05T12:00:00'));
    expect(exp3.getFullYear()).toBe(2024);
    expect(exp3.getMonth()).toBe(0);
    expect(exp3.getDate()).toBe(19);
  });

  it('should populate purchaseDate and expirationDate in reconcile when operations are passed', () => {
    const calcPositions = [new ConsolidatedPosition('PETRL380', 500, 0.45, 225, 'option')];
    const b3Items = [
      {
        ticker: 'VALE3',
        productName: 'VALE',
        assetType: 'stock' as const,
        quantity: 100,
        closePrice: 60,
        updatedValue: 6000,
        institutions: ['XP'],
      },
    ];
    const operations = [
      new Operation('op1', new Date('2024-04-10T12:00:00'), 'PETRL380', 'buy', 500, 0.45),
    ];

    const results = service.reconcile(calcPositions, b3Items, operations);
    const item = results.find((r) => r.ticker === 'PETRL380');

    expect(item).toBeDefined();
    expect(item?.type).toBe('OPTION_WORTHLESS');
    expect(item?.purchaseDate).toBeDefined();
    expect(item?.purchaseDate?.getMonth()).toBe(3); // April
    expect(item?.expirationDate).toBeDefined();
    expect(item?.expirationDate?.getMonth()).toBe(11); // December (L)
    expect(item?.expirationDate?.getDate()).toBe(20); // 3rd Friday
    expect(item?.description).toContain('Comprada em');
    expect(item?.description).toContain('Vencimento B3 detectado: 20/12/2024');
  });

  it('should generate paired operations for ticker conversion / incorporation without tax distortion', () => {
    // Example: 100 IRDM11 at PM R$ 80,00 (total R$ 8.000) converted into 88 IRIM11
    const [sellOp, buyOp] = service.createConversionOperations(
      'IRDM11',
      100,
      80.0,
      'IRIM11',
      88,
      new Date('2025-11-01T12:00:00'),
      400.0, // R$ 400 received in cash amortization
    );

    // Old asset sell
    expect(sellOp.asset).toBe('IRDM11');
    expect(sellOp.type).toBe('sell');
    expect(sellOp.quantity).toBe(100);
    expect(sellOp.unitPrice).toBe(80.0); // Exactly PM -> profit = 0
    expect(sellOp.totalValue).toBe(8000.0);

    // New asset buy
    expect(buyOp.asset).toBe('IRIM11');
    expect(buyOp.type).toBe('buy');
    expect(buyOp.quantity).toBe(88);
    // Net cost: 8000 - 400 = 7600 / 88 = 86.3636...
    expect(buyOp.totalValue).toBeCloseTo(7600.0, 2);
    expect(buyOp.unitPrice).toBeCloseTo(86.3636, 4);
  });

  it('should automatically pair known conversions (e.g. IRDM11 -> IRIM11) in reconcile() and generate Google query', () => {
    const calcPositions = [
      new ConsolidatedPosition('IRDM11', 12, 78.5, 942.0, 'fii'),
      new ConsolidatedPosition('PETR4', 0, 0, 0, 'stock'), // Liquidated past asset
    ];
    const b3Items = [
      {
        ticker: 'IRIM11',
        productName: 'IRIDIUM',
        assetType: 'fii' as const,
        quantity: 12,
        closePrice: 75.0,
        updatedValue: 900.0,
        institutions: ['XP'],
      },
    ];

    const results = service.reconcile(calcPositions, b3Items);

    // Liquidated past asset PETR4 with 0/0 should be skipped
    expect(results.find((r) => r.ticker === 'PETR4')).toBeUndefined();

    // IRDM11 and IRIM11 should be unified into a single CONVERSION_SUSPECTED discrepancy
    const convItem = results.find((r) => r.type === 'CONVERSION_SUSPECTED');
    expect(convItem).toBeDefined();
    expect(convItem?.oldTicker).toBe('IRDM11');
    expect(convItem?.newTicker).toBe('IRIM11');
    expect(convItem?.calculatedQty).toBe(12);
    expect(convItem?.b3Qty).toBe(12);
    expect(convItem?.description).toContain('IRDM11');
    expect(convItem?.description).toContain('IRIM11');
    expect(convItem?.googleSearchQuery).toBe(
      'IRDM11 IRIM11 fato relevante conversao incorporacao b3',
    );
  });

  it('should find, group and list applied corrections for rollback/undo', () => {
    const [sellOp, buyOp] = service.createConversionOperations(
      'IRDM11',
      12,
      80.0,
      'IRIM11',
      12,
      new Date('2025-11-01T12:00:00'),
    );
    const expOp = service.createWorthlessOptionOperation(
      'PETRL300',
      100,
      new Date('2025-12-19T12:00:00'),
    );
    const splitOp = service.createSplitOperation('WEGE3', 10, 2, new Date('2025-10-01T12:00:00'));

    const allOps = [
      new Operation('norm_1', new Date(), 'VALE3', 'buy', 100, 60), // Normal trade
      sellOp,
      buyOp,
      expOp,
      splitOp,
    ];

    const corrections = service.findCorrections(allOps);

    // Normal trade is ignored; only the 3 corrections are returned
    expect(corrections.length).toBe(3);

    const conv = corrections.find((c) => c.type === 'conversion');
    expect(conv).toBeDefined();
    expect(conv?.operationIds.length).toBe(2);
    expect(conv?.operationIds).toContain(sellOp.id);
    expect(conv?.operationIds).toContain(buyOp.id);
    expect(conv?.batchId).toBeDefined();

    const exp = corrections.find((c) => c.type === 'worthless');
    expect(exp).toBeDefined();
    expect(exp?.ticker).toBe('PETRL300');
    expect(exp?.operationIds).toEqual([expOp.id]);

    const split = corrections.find((c) => c.type === 'split');
    expect(split).toBeDefined();
    expect(split?.ticker).toBe('WEGE3');
    expect(split?.operationIds).toEqual([splitOp.id]);
  });

  it('should cleanly rollback a correction and restore previous custody in repository', async () => {
    const { InMemoryOperationRepository } =
      await import('../../infrastructure/repositories/InMemoryOperationRepository.ts');
    const { AveragePriceCalculator } =
      await import('../../core/services/AveragePriceCalculator.ts');
    const calc = new AveragePriceCalculator();
    const repo = new InMemoryOperationRepository();

    // 1. Initial custody: 12 IRDM11 at R$ 80
    await repo.add(new Operation('op_1', new Date('2024-01-10T12:00:00'), 'IRDM11', 'buy', 12, 80));
    let positions = calc.calculate(await repo.getAll());
    expect(positions.find((p) => p.ticker === 'IRDM11')?.quantity).toBe(12);

    // 2. Apply conversion IRDM11 -> IRIM11
    const [sellOp, buyOp] = service.createConversionOperations(
      'IRDM11',
      12,
      80,
      'IRIM11',
      12,
      new Date('2025-11-01T12:00:00'),
    );
    await repo.addAll([sellOp, buyOp]);

    positions = calc.calculate(await repo.getAll());
    expect(positions.find((p) => p.ticker === 'IRDM11')).toBeUndefined();
    expect(positions.find((p) => p.ticker === 'IRIM11')?.quantity).toBe(12);

    // 3. Rollback the conversion
    const corrections = service.findCorrections(await repo.getAll());
    expect(corrections.length).toBe(1);
    const targetCorr = corrections[0];
    if (targetCorr.batchId) {
      await repo.removeByBatchId(targetCorr.batchId);
    } else {
      await repo.removeOperations(targetCorr.operationIds);
    }

    // 4. Custody restored: IRDM11 has 12 again, IRIM11 has 0!
    positions = calc.calculate(await repo.getAll());
    expect(positions.find((p) => p.ticker === 'IRDM11')?.quantity).toBe(12);
    expect(positions.find((p) => p.ticker === 'IRIM11')).toBeUndefined();
    expect(service.findCorrections(await repo.getAll()).length).toBe(0);
  });
});
