import * as XLSX from 'xlsx';
import { Operation, OperationType } from '../entities/Operation.ts';
import { AssetType } from '../entities/Asset.ts';

export interface RawParsedRow {
  date: Date;
  asset: string;
  type: OperationType;
  quantity: number;
  unitPrice: number;
  fees: number;
  institution?: string;
  market?: string;
}

export class B3Parser {
  /**
   * Parses Excel file (ArrayBuffer or Uint8Array) or CSV string.
   */
  async parse(input: ArrayBuffer | Uint8Array | string): Promise<Operation[]> {
    if (typeof input === 'string') {
      return this.parseCsv(input);
    }
    return this.parseXlsx(input);
  }

  /**
   * Parses XLSX ArrayBuffer/Uint8Array
   */
  parseXlsx(buffer: ArrayBuffer | Uint8Array): Operation[] {
    const workbook = XLSX.read(buffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Workbook contains no sheets.');
    }

    // Find the relevant sheet: either named "Negociação" or the first sheet
    const sheetName =
      workbook.SheetNames.find(
        (name) => name.toLowerCase().includes('negocia') || name.toLowerCase().includes('trade'),
      ) ?? workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });

    return this.parseRows(rawData);
  }

  /**
   * Parses CSV string
   */
  parseCsv(content: string): Operation[] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const rawRows = lines.map((line) =>
      line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, '')),
    );
    return this.parseRows(rawRows);
  }

  /**
   * Helper to normalize headers and extract operations from tabular data
   */
  private parseRows(rows: unknown[][]): Operation[] {
    if (rows.length < 2) {
      return [];
    }

    // Find header row index
    let headerRowIndex = -1;
    let colIndices: {
      date: number;
      type: number;
      asset: number;
      quantity: number;
      price: number;
      value: number;
      institution: number;
      market: number;
    } = {
      date: -1,
      type: -1,
      asset: -1,
      quantity: -1,
      price: -1,
      value: -1,
      institution: -1,
      market: -1,
    };

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      const indices = this.identifyColumns(row);
      if (indices.date !== -1 && indices.asset !== -1 && indices.quantity !== -1) {
        headerRowIndex = i;
        colIndices = indices;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not identify required columns in the B3 spreadsheet.');
    }

    const operations: Operation[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const dateRaw = row[colIndices.date];
      const typeRaw = row[colIndices.type];
      const assetRaw = row[colIndices.asset];
      const qtyRaw = row[colIndices.quantity];
      const priceRaw = row[colIndices.price];
      const valueRaw = colIndices.value !== -1 ? row[colIndices.value] : undefined;
      const instRaw = colIndices.institution !== -1 ? row[colIndices.institution] : undefined;
      const marketRaw = colIndices.market !== -1 ? row[colIndices.market] : undefined;

      if (!dateRaw || !assetRaw || qtyRaw === undefined || qtyRaw === '') {
        continue;
      }

      const date = this.parseDate(dateRaw);
      const type = this.parseOperationType(typeRaw);
      const rawTicker = String(assetRaw).trim();
      const market = marketRaw ? String(marketRaw).trim() : undefined;
      const normalizedTicker = this.normalizeTicker(rawTicker, market);

      const quantity = this.parseNumber(qtyRaw);
      const unitPrice = this.parseNumber(priceRaw);
      const totalValue =
        valueRaw !== undefined && valueRaw !== ''
          ? this.parseNumber(valueRaw)
          : quantity * unitPrice;

      // Calculate fees if totalValue differs from quantity * unitPrice
      let fees = 0;
      const expectedTotal = quantity * unitPrice;
      if (type === 'buy' && totalValue > expectedTotal) {
        fees = Math.max(0, Math.round((totalValue - expectedTotal) * 100) / 100);
      } else if (type === 'sell' && totalValue < expectedTotal) {
        fees = Math.max(0, Math.round((expectedTotal - totalValue) * 100) / 100);
      }

      const id = `b3-${i}-${normalizedTicker}-${date.getTime()}`;

      operations.push(
        new Operation(
          id,
          date,
          normalizedTicker,
          type,
          quantity,
          unitPrice,
          fees,
          instRaw ? String(instRaw).trim() : undefined,
        ),
      );
    }

    return operations;
  }

  private identifyColumns(row: unknown[]): {
    date: number;
    type: number;
    asset: number;
    quantity: number;
    price: number;
    value: number;
    institution: number;
    market: number;
  } {
    const indices = {
      date: -1,
      type: -1,
      asset: -1,
      quantity: -1,
      price: -1,
      value: -1,
      institution: -1,
      market: -1,
    };

    row.forEach((cell, idx) => {
      const text = String(cell || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      if (text.includes('data do negocio') || text.includes('data') || text === 'dt negocio') {
        if (indices.date === -1) indices.date = idx;
      } else if (
        text.includes('tipo de movimentacao') ||
        text.includes('movimentacao') ||
        text.includes('tipo')
      ) {
        if (indices.type === -1) indices.type = idx;
      } else if (
        text.includes('codigo de negociacao') ||
        text.includes('codigo') ||
        text.includes('ativo') ||
        text.includes('ticker')
      ) {
        if (indices.asset === -1) indices.asset = idx;
      } else if (text.includes('quantidade') || text.includes('qtd')) {
        if (indices.quantity === -1) indices.quantity = idx;
      } else if (text.includes('preco') || text.includes('preco unitario')) {
        if (indices.price === -1) indices.price = idx;
      } else if (text.includes('valor') || text.includes('total')) {
        if (indices.value === -1) indices.value = idx;
      } else if (text.includes('instituicao') || text.includes('corretora')) {
        if (indices.institution === -1) indices.institution = idx;
      } else if (text.includes('mercado')) {
        if (indices.market === -1) indices.market = idx;
      }
    });

    return indices;
  }

  private parseDate(val: unknown): Date {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val;
    }

    if (typeof val === 'number') {
      // Excel serial date to JS Date
      // Excel base date is 1899-12-30
      const utcDays = Math.floor(val - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate() + 1);
    }

    const str = String(val).trim();
    // Expected format: DD/MM/AAAA or DD/MM/YY or YYYY-MM-DD
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
      }
    }

    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        // Check if YYYY-MM-DD or DD-MM-YYYY
        if (parts[0].length === 4) {
          return new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10),
          );
        } else {
          return new Date(
            parseInt(parts[2], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[0], 10),
          );
        }
      }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;

    throw new Error(`Unable to parse date: "${val}"`);
  }

  private parseOperationType(val: unknown): OperationType {
    const str = String(val || '')
      .toLowerCase()
      .trim();
    if (str.includes('compra') || str === 'c' || str === 'buy') {
      return 'buy';
    }
    if (str.includes('venda') || str === 'v' || str === 'sell') {
      return 'sell';
    }
    return 'buy';
  }

  private parseNumber(val: unknown): number {
    if (typeof val === 'number') return val;
    let str = String(val || '').trim();
    if (!str) return 0;

    // Handle Brazilian decimal format: 1.000,00 -> 1000.00
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Normalizes fractional share tickers (e.g. TAEE3F -> TAEE3)
   */
  normalizeTicker(ticker: string, market?: string): string {
    const clean = ticker.toUpperCase().trim();
    if (
      market &&
      (market.toLowerCase().includes('opç') || market.toLowerCase().includes('opcao'))
    ) {
      return clean;
    }
    if (/^[A-Z]{4}[A-X][0-9]/.test(clean)) {
      return clean;
    }

    const isFractional =
      (market && market.toLowerCase().includes('fracion')) || /[A-Z]{4}[0-9]{1,2}F$/.test(clean);

    if (isFractional && clean.endsWith('F') && clean.length >= 5) {
      return clean.slice(0, -1);
    }
    return clean;
  }

  /**
   * Detects asset type based on ticker code and optional market
   */
  detectAssetType(ticker: string, market?: string): AssetType {
    const normalized = this.normalizeTicker(ticker, market);

    if (market) {
      const m = market.toLowerCase();
      if (m.includes('opç') || m.includes('opcao') || m.includes('option')) {
        return 'option';
      }
    }

    // Standard B3 options ticker: 4 letters underlying + 1 letter month code (A-X) + strike numbers
    if (/^[A-Z]{4}[A-X][0-9]{1,4}[A-Z0-9]*$/.test(normalized)) {
      return 'option';
    }

    // BDR codes: ending in 31, 32, 33, 34, 35, 39
    if (/(31|32|33|34|35|39)$/.test(normalized)) {
      return 'bdr';
    }

    // Common known unit stocks (composição de ações) that end in 11
    const stockUnits = [
      'TAEE11',
      'SANB11',
      'SAPR11',
      'KLBN11',
      'ALUP11',
      'ENGI11',
      'BPAC11',
      'TIET11',
      'CPLE11',
      'SULA11',
      'RANI11',
    ];
    if (stockUnits.includes(normalized)) {
      return 'unit';
    }

    // Known FI-Infra tickers (Fundos Incentivados de Investimento em Infraestrutura)
    const fiInfraTickers = new Set([
      'BDIF11',
      'CPTI11',
      'KDIF11',
      'JURO11',
      'BODB11',
      'XPID11',
      'IFRA11',
      'OGIN11',
      'CDII11',
      'SNID11',
      'EXES11',
      'INFR11',
      'BIDB11',
      'GURG11',
      'RBIF11',
      'PLRI11',
      'VGIJ11',
      'VGIF11',
      'XPIC11',
      'PICE11',
      'EQIN11',
      'DIVI11',
      'BIDI11',
      'PRIF11',
      'RZIF11',
      'ICRI11',
      'QUAS11',
      'RBRX11',
      'SULI11',
      'TGIF11',
      'ZAVI11',
      'BINC11',
      'IDFI11',
      'LIFE11',
      'NERI11',
      'NDIV11',
      'VIFI11',
      'BBIF11',
      'FPAB11',
      'MANA11',
    ]);
    if (fiInfraTickers.has(normalized) || (market && market.toLowerCase().includes('infra'))) {
      return 'fi-infra';
    }

    // FIIs generally end in 11
    if (/11$/.test(normalized)) {
      return 'fii';
    }

    // Default to stock (common suffixes 3, 4, 5, 6)
    return 'stock';
  }
}
