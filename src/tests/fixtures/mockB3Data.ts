import * as XLSX from 'xlsx';

/**
 * Generates synthetic in-memory XLSX workbook for B3 Trades (Negociação) testing.
 * Avoids any dependency on real/personal investor spreadsheets.
 */
export function createMockTradesBuffer(): Uint8Array {
  const data = [
    [
      'Data do Negócio',
      'Tipo de Movimentação',
      'Mercado',
      'Prazo/Vencimento',
      'Instituição',
      'Código de Negociação',
      'Quantidade',
      'Preço',
      'Valor',
    ],
    ['27/08/2026', 'Compra', 'Mercado Fracionário', '-', 'ITAU CV S/A', 'TAEE3F', 2, 12.82, 25.64],
    ['25/08/2026', 'Compra', 'Mercado Fracionário', '-', 'ITAU CV S/A', 'BBSE3F', 2, 38.59, 77.18],
    ['25/08/2026', 'Compra', 'Mercado à Vista', '-', 'ITAU CV S/A', 'BDIF11', 1, 68.14, 68.14],
    ['25/08/2026', 'Compra', 'Mercado à Vista', '-', 'ITAU CV S/A', 'BERK34', 1, 129.74, 129.74],
    ['25/08/2026', 'Compra', 'Mercado à Vista', '-', 'ITAU CV S/A', 'CPTI11', 1, 82.63, 82.63],
    ['25/08/2026', 'Compra', 'Mercado à Vista', '-', 'ITAU CV S/A', 'HGLG11', 1, 146.61, 146.61],
    ['25/08/2026', 'Compra', 'Mercado à Vista', '-', 'ITAU CV S/A', 'HGRE11', 1, 118.08, 118.08],
    ['25/08/2026', 'Compra', 'Mercado Fracionário', '-', 'ITAU CV S/A', 'ITSA4F', 2, 12.84, 25.68],
    ['25/08/2026', 'Compra', 'Mercado à Vista', '-', 'ITAU CV S/A', 'KDIF11', 1, 112.48, 112.48],
    [
      '18/08/2026',
      'Compra',
      'Mercado à Vista',
      '-',
      'NU INVESTIMENTOS S.A. - CTVM',
      'CPTI11',
      1,
      80.98,
      80.98,
    ],
    [
      '18/08/2026',
      'Compra',
      'Mercado Fracionário',
      '-',
      'NU INVESTIMENTOS S.A. - CTVM',
      'EGIE3F',
      1,
      27.9,
      27.9,
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Negociação');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates synthetic in-memory XLSX workbook for B3 Positions (Posição) testing.
 * Replaces real spreadsheets with 58 synthetic items including tests cases for FII, FI-Infra, BDR, and stocks.
 */
export function createMockPositionsBuffer(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Ações
  const acoesRows: unknown[][] = [
    [
      'Produto',
      'Instituição',
      'Conta',
      'Código de Negociação',
      'CNPJ da Empresa',
      'Código ISIN / Distribuição',
      'Tipo',
      'Escriturador',
      'Quantidade',
      'Quantidade Disponível',
      'Quantidade Indisponível',
      'Motivo',
      'Preço de Fechamento',
      'Valor Atualizado',
    ],
  ];
  for (let i = 1; i <= 50; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    const ticker = `STK${num}3`;
    acoesRows.push([
      `MOCK - ${ticker}`,
      'TEST CORRETORA',
      '12345',
      ticker,
      '00000000000100',
      `BRMOCK${num}`,
      'ON',
      'ITAU',
      10,
      10,
      '-',
      '-',
      20,
      200,
    ]);
  }
  const wsAcoes = XLSX.utils.aoa_to_sheet(acoesRows);
  XLSX.utils.book_append_sheet(wb, wsAcoes, 'Acoes');

  // 2. BDRs
  const bdrRows: unknown[][] = [
    [
      'Produto',
      'Instituição',
      'Conta',
      'Código de Negociação',
      'Código ISIN / Distribuição',
      'Tipo',
      'Escriturador',
      'Quantidade',
      'Quantidade Disponível',
      'Quantidade Indisponível',
      'Motivo',
      'Preço de Fechamento',
      'Valor Atualizado',
    ],
    [
      'BERK34 - BERKSHIRE',
      'TEST CORRETORA',
      '12345',
      'BERK34',
      'BRBERK',
      'BDR',
      'BRADESCO',
      1,
      1,
      '-',
      '-',
      100,
      100,
    ],
    [
      'AAPL34 - APPLE',
      'TEST CORRETORA',
      '12345',
      'AAPL34',
      'BRAAPL',
      'BDR',
      'BRADESCO',
      2,
      2,
      '-',
      '-',
      50,
      100,
    ],
    [
      'MSFT34 - MICROSOFT',
      'TEST CORRETORA',
      '12345',
      'MSFT34',
      'BRMSFT',
      'BDR',
      'BRADESCO',
      3,
      3,
      '-',
      '-',
      60,
      180,
    ],
    [
      'NVDA34 - NVIDIA',
      'TEST CORRETORA',
      '12345',
      'NVDA34',
      'BRNVDA',
      'BDR',
      'BRADESCO',
      4,
      4,
      '-',
      '-',
      70,
      280,
    ],
    [
      'AMZO34 - AMAZON',
      'TEST CORRETORA',
      '12345',
      'AMZO34',
      'BRAMZO',
      'BDR',
      'BRADESCO',
      5,
      5,
      '-',
      '-',
      40,
      200,
    ],
  ];
  const wsBdr = XLSX.utils.aoa_to_sheet(bdrRows);
  XLSX.utils.book_append_sheet(wb, wsBdr, 'BDR');

  // 3. FIIs e FI-Infra
  const fiiRows: unknown[][] = [
    [
      'Produto',
      'Instituição',
      'Conta',
      'Código de Negociação',
      'CNPJ do Fundo',
      'Código ISIN / Distribuição',
      'Tipo',
      'Administrador',
      'Quantidade',
      'Quantidade Disponível',
      'Quantidade Indisponível',
      'Motivo',
      'Preço de Fechamento',
      'Valor Atualizado',
    ],
    [
      'IRIM11 - IRIDIUM FII',
      'TEST CORRETORA',
      '12345',
      'IRIM11',
      '00000000000100',
      'BRIRIM',
      'Cotas',
      'ADMIN',
      12,
      12,
      '-',
      '-',
      80,
      960,
    ],
    [
      'CPTI11 - CAPITANIA INFRA',
      'TEST CORRETORA',
      '12345',
      'CPTI11',
      '00000000000100',
      'BRCPTI',
      'Cotas',
      'ADMIN',
      6,
      6,
      '-',
      '-',
      85,
      510,
    ],
    [
      'HGLG11 - CSHG LOGISTICA',
      'TEST CORRETORA',
      '12345',
      'HGLG11',
      '00000000000100',
      'BRHGLG',
      'Cotas',
      'ADMIN',
      10,
      10,
      '-',
      '-',
      160,
      1600,
    ],
  ];
  const wsFii = XLSX.utils.aoa_to_sheet(fiiRows);
  XLSX.utils.book_append_sheet(wb, wsFii, 'Fundo de Investimento');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
