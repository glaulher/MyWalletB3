import { describe, expect, it } from 'bun:test';
import * as XLSX from 'xlsx';
import { B3MovementParser } from '../../core/services/B3MovementParser.ts';

describe('B3MovementParser', () => {
  const parser = new B3MovementParser();

  it('should classify movement types and categories correctly', () => {
    expect(parser.categorizeMovement('Rendimento')).toBe('yield');
    expect(parser.categorizeMovement('Dividendo')).toBe('dividend');
    expect(parser.categorizeMovement('Juros Sobre Capital Próprio')).toBe('jcp');
    expect(parser.categorizeMovement('JCP')).toBe('jcp');
    expect(parser.categorizeMovement('Bonificação em Ativos')).toBe('bonus');
    expect(parser.categorizeMovement('Leilão de Fração')).toBe('fraction');
    expect(parser.categorizeMovement('Fração em Ativos')).toBe('fraction');
    expect(parser.categorizeMovement('Direito de Subscrição')).toBe('subscription');
    expect(parser.categorizeMovement('Transferência - Liquidação')).toBe('transfer');
    expect(parser.categorizeMovement('Transferência')).toBe('transfer');
    expect(parser.categorizeMovement('Resgate')).toBe('transfer');
    expect(parser.categorizeMovement('APLICAÇÃO')).toBe('transfer');
  });

  it('should extract ticker from B3 product strings accurately', () => {
    expect(
      parser.extractTicker(
        'CPTI11 - CAPITÂNIA SECURITIES II FUNDO DE INVESTIMENTO IMOBILIÁRIO - RESPONSABILIDADE LIMITADA',
      ),
    ).toBe('CPTI11');
    expect(parser.extractTicker('PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS')).toBe('PETR4');
    expect(parser.extractTicker('VALE3F - VALE S.A.')).toBe('VALE3');
    expect(parser.extractTicker('HGLG11')).toBe('HGLG11');
    expect(parser.extractTicker('SALDO DISPONIVEL')).toBe('BRL');
  });

  it('should parse CSV content with Brazilian format', async () => {
    const csvContent = `Entrada/Saída;Data;Movimentação;Produto;Instituição;Quantidade;Preço unitário;Valor da Operação
Credito;15/05/2024;Rendimento;CPTI11 - CAPITÂNIA SECURITIES II FII;XP INVESTIMENTOS CCTVM S/A;100;1,05;105,00
Credito;20/05/2024;Dividendo;VALE3 - VALE S.A.;CLEAR CORRETORA;50;2,50;125,00
Credito;25/05/2024;Juros Sobre Capital Próprio;ITUB4 - ITAU UNIBANCO;XP INVESTIMENTOS CCTVM S/A;200;0,30;60,00
Debito;30/05/2024;Transferência;SALDO DISPONÍVEL;XP INVESTIMENTOS CCTVM S/A;1;-;290,00`;

    const movements = await parser.parse(csvContent);

    expect(movements.length).toBe(4);

    expect(movements[0].asset).toBe('CPTI11');
    expect(movements[0].category).toBe('yield');
    expect(movements[0].direction).toBe('credit');
    expect(movements[0].quantity).toBe(100);
    expect(movements[0].unitPrice).toBe(1.05);
    expect(movements[0].totalValue).toBe(105);
    expect(movements[0].isIncome).toBe(true);

    expect(movements[1].asset).toBe('VALE3');
    expect(movements[1].category).toBe('dividend');
    expect(movements[1].totalValue).toBe(125);
    expect(movements[1].isIncome).toBe(true);

    expect(movements[2].asset).toBe('ITUB4');
    expect(movements[2].category).toBe('jcp');
    expect(movements[2].totalValue).toBe(60);
    expect(movements[2].isIncome).toBe(true);

    expect(movements[3].category).toBe('transfer');
    expect(movements[3].direction).toBe('debit');
    expect(movements[3].totalValue).toBe(290);
    expect(movements[3].isIncome).toBe(false);
  });

  it('should parse generated XLSX workbook matching B3 Movimentação tab', () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      [
        'Entrada/Saída',
        'Data',
        'Movimentação',
        'Produto',
        'Instituição',
        'Quantidade',
        'Preço unitário',
        'Valor da Operação',
      ],
      [
        'Credito',
        '10/06/2024',
        'Rendimento',
        'HGLG11 - CSHG LOGÍSTICA FII',
        'XP INVESTIMENTOS',
        10,
        '1,10',
        '11,00',
      ],
      [
        'Credito',
        '12/06/2024',
        'Bonificação em Ativos',
        'BBDC4 - BANCO BRADESCO',
        'ÁGORA',
        5,
        '-',
        '-',
      ],
      ['Total', '', '', '', '', '', '', '11,00'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Movimentação');

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const movements = parser.parseXlsx(buffer);

    expect(movements.length).toBe(2);
    expect(movements[0].asset).toBe('HGLG11');
    expect(movements[0].category).toBe('yield');
    expect(movements[0].totalValue).toBe(11);
    expect(movements[1].asset).toBe('BBDC4');
    expect(movements[1].category).toBe('bonus');
    expect(movements[1].quantity).toBe(5);
  });
});
