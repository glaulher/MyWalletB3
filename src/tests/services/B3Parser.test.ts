import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { B3Parser } from '../../core/services/B3Parser.ts';

describe('B3Parser', () => {
  const parser = new B3Parser();

  it('should parse actual B3 excel file correctly', async () => {
    const filePath = path.resolve('negociacao-2026-09-15-14-41-25.xlsx');
    const buffer = fs.readFileSync(filePath);

    const operations = await parser.parse(buffer);

    expect(operations.length).toBe(11);

    // Verify first operation (row 1 in excel: TAEE3F)
    const taee = operations.find((op) => op.asset === 'TAEE3');
    expect(taee).toBeDefined();
    expect(taee?.quantity).toBe(2);
    expect(taee?.unitPrice).toBe(12.82);
    expect(taee?.type).toBe('buy');
    expect(taee?.institution).toBe('ITAU CV S/A');

    // Verify CPTI11 has 2 operations
    const cptiOps = operations.filter((op) => op.asset === 'CPTI11');
    expect(cptiOps.length).toBe(2);

    // Verify fractional ticker normalization: EGIE3F -> EGIE3, BBSE3F -> BBSE3
    expect(operations.some((op) => op.asset === 'EGIE3')).toBe(true);
    expect(operations.some((op) => op.asset === 'BBSE3')).toBe(true);
    expect(operations.some((op) => op.asset === 'ITSA4')).toBe(true);
  });

  it('should parse CSV content with Brazilian format', async () => {
    const csvContent = `Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor
25/08/2026;Compra;Mercado à Vista;-;ITAU CV S/A;PETR4;100;35,50;3.550,00
26/08/2026;Venda;Mercado à Vista;-;ITAU CV S/A;PETR4;50;37,00;1.850,00`;

    const operations = parser.parseCsv(csvContent);

    expect(operations.length).toBe(2);
    expect(operations[0].asset).toBe('PETR4');
    expect(operations[0].type).toBe('buy');
    expect(operations[0].quantity).toBe(100);
    expect(operations[0].unitPrice).toBe(35.5);

    expect(operations[1].type).toBe('sell');
    expect(operations[1].quantity).toBe(50);
    expect(operations[1].unitPrice).toBe(37);
  });

  it('should detect asset types correctly', () => {
    expect(parser.detectAssetType('PETR4')).toBe('stock');
    expect(parser.detectAssetType('VALE3')).toBe('stock');
    expect(parser.detectAssetType('HGLG11')).toBe('fii');
    expect(parser.detectAssetType('CPTI11')).toBe('fii');
    expect(parser.detectAssetType('BERK34')).toBe('bdr');
    expect(parser.detectAssetType('AAPL34')).toBe('bdr');
    expect(parser.detectAssetType('TAEE11')).toBe('unit');
    expect(parser.detectAssetType('SANB11')).toBe('unit');
    expect(parser.detectAssetType('PETRL300')).toBe('option');
    expect(parser.detectAssetType('VALEM650')).toBe('option');
    expect(parser.detectAssetType('BOVAW110')).toBe('option');
    expect(parser.detectAssetType('PETR4', 'Opção de Compra')).toBe('option');
  });
});
