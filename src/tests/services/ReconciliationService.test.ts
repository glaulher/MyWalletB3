import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import { B3PositionParser } from '../../core/services/B3PositionParser.ts';
import { ReconciliationService } from '../../core/services/ReconciliationService.ts';
import { ConsolidatedPosition } from '../../core/entities/ConsolidatedPosition.ts';

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
});
