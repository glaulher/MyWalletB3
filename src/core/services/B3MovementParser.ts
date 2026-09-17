import * as XLSX from 'xlsx';
import { Movement, MovementCategory, MovementDirection } from '../entities/Movement.ts';
import { B3Parser } from './B3Parser.ts';

export class B3MovementParser {
  private b3Parser = new B3Parser();

  /**
   * Parses Excel file (ArrayBuffer or Uint8Array) or CSV string of B3 movements.
   */
  async parse(input: ArrayBuffer | Uint8Array | string): Promise<Movement[]> {
    if (typeof input === 'string') {
      return this.parseCsv(input);
    }
    return this.parseXlsx(input);
  }

  /**
   * Parses XLSX ArrayBuffer/Uint8Array
   */
  parseXlsx(buffer: ArrayBuffer | Uint8Array): Movement[] {
    const workbook = XLSX.read(buffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Planilha de movimentação não contém abas.');
    }

    // Target sheet: "Movimentação" or first available sheet
    const sheetName =
      workbook.SheetNames.find((name) =>
        name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes('movimentac'),
      ) ?? workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });

    return this.parseRows(rawData);
  }

  /**
   * Parses CSV string
   */
  parseCsv(content: string): Movement[] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return [];
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const rawRows = lines.map((line) =>
      line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, '')),
    );
    return this.parseRows(rawRows);
  }

  /**
   * Helper to normalize headers and extract movements from rows
   */
  private parseRows(rows: unknown[][]): Movement[] {
    if (rows.length < 2) {
      return [];
    }

    let headerRowIdx = -1;
    let colIndices = {
      direction: -1,
      date: -1,
      type: -1,
      product: -1,
      institution: -1,
      quantity: -1,
      price: -1,
      value: -1,
    };

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      const rowStr = JSON.stringify(row || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Reject trade sheet headers (Data do Negócio, Código de Negociação, Mercado)
      if (
        rowStr.includes('data do negocio') ||
        rowStr.includes('codigo de negociacao') ||
        rowStr.includes('mercado')
      ) {
        continue;
      }

      const indices = this.identifyColumns(row);
      if (indices.date !== -1 && indices.type !== -1 && indices.value !== -1) {
        headerRowIdx = i;
        colIndices = indices;
        break;
      }
    }

    if (headerRowIdx === -1) {
      throw new Error(
        'Cabeçalho da planilha de movimentação não reconhecido. Certifique-se de que é o arquivo de Movimentação exportado da B3.',
      );
    }

    const movements: Movement[] = [];
    const occurrenceMap = new Map<string, number>();

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rawType = String(row[colIndices.type] || '').trim();
      const rawDate = row[colIndices.date];
      const rawVal = row[colIndices.value];

      if (!rawType || rawDate === '' || rawDate === undefined || rawVal === '') {
        continue;
      }

      // Check if footer / total line
      const strDate = String(rawDate).toUpperCase();
      if (strDate.includes('TOTAL') || strDate.includes('SUBTOTAL')) {
        continue;
      }

      const date = this.parseDate(rawDate);
      const direction = this.parseDirection(row[colIndices.direction]);
      const rawProduct =
        colIndices.product !== -1 ? String(row[colIndices.product] || '').trim() : '';
      const asset = this.extractTicker(rawProduct);
      const category = this.categorizeMovement(rawType);
      const institution =
        colIndices.institution !== -1 ? String(row[colIndices.institution] || '').trim() : '';
      const quantity = colIndices.quantity !== -1 ? this.parseNumber(row[colIndices.quantity]) : 0;
      const unitPrice = colIndices.price !== -1 ? this.parseNumber(row[colIndices.price]) : 0;
      const totalValue = this.parseNumber(rawVal);

      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const assetClean = asset.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const valCents = Math.abs(Math.round(totalValue * 100));
      const movKey = `mov-${dateStr}-${assetClean}-${category}-${direction}-${quantity}-${valCents}`;
      const occurrence = (occurrenceMap.get(movKey) || 0) + 1;
      occurrenceMap.set(movKey, occurrence);
      const id = `${movKey}-${occurrence}`;

      movements.push(
        new Movement(
          id,
          date,
          rawType,
          category,
          direction,
          asset,
          rawProduct || asset,
          quantity,
          unitPrice,
          totalValue,
          institution || undefined,
        ),
      );
    }

    // Sort chronologically ascending
    return movements.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private identifyColumns(row: unknown[]): {
    direction: number;
    date: number;
    type: number;
    product: number;
    institution: number;
    quantity: number;
    price: number;
    value: number;
  } {
    const indices = {
      direction: -1,
      date: -1,
      type: -1,
      product: -1,
      institution: -1,
      quantity: -1,
      price: -1,
      value: -1,
    };

    row.forEach((cell, idx) => {
      const text = String(cell || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      if (text.includes('entrada/saida') || text.includes('entrada') || text.includes('saida')) {
        if (indices.direction === -1) indices.direction = idx;
      } else if (text.includes('data')) {
        if (indices.date === -1) indices.date = idx;
      } else if (text.includes('movimentacao') || text.includes('tipo')) {
        if (indices.type === -1) indices.type = idx;
      } else if (text.includes('produto') || text.includes('ativo')) {
        if (indices.product === -1) indices.product = idx;
      } else if (text.includes('instituicao') || text.includes('corretora')) {
        if (indices.institution === -1) indices.institution = idx;
      } else if (text.includes('quantidade') || text.includes('qtd')) {
        if (indices.quantity === -1) indices.quantity = idx;
      } else if (text.includes('preco unitario') || text.includes('preco')) {
        if (indices.price === -1) indices.price = idx;
      } else if (
        text.includes('valor da operacao') ||
        text.includes('valor') ||
        text.includes('total')
      ) {
        if (indices.value === -1) indices.value = idx;
      }
    });

    return indices;
  }

  /**
   * Classifies raw B3 movement description into normalized category
   */
  categorizeMovement(rawType: string): MovementCategory {
    const norm = rawType
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (norm.includes('rendimento') || norm.includes('pagamento de juros')) {
      return 'yield';
    }
    if (norm.includes('dividendo')) {
      return 'dividend';
    }
    if (norm.includes('juros sobre capital proprio') || norm.includes('jcp')) {
      return 'jcp';
    }
    if (norm.includes('bonificacao')) {
      return 'bonus';
    }
    if (norm.includes('fracao') || norm.includes('leilao de fracao')) {
      return 'fraction';
    }
    if (norm.includes('subscricao') || norm.includes('cessao de direito')) {
      return 'subscription';
    }
    if (
      norm.includes('transferencia') ||
      norm.includes('liquidacao') ||
      norm.includes('resgate') ||
      norm.includes('aplicacao')
    ) {
      return 'transfer';
    }

    return 'other';
  }

  /**
   * Extracts clean ticker symbol from B3 product string (e.g. "CPTI11 - CAPITÂNIA SECURITIES II..." -> "CPTI11")
   */
  extractTicker(product: string): string {
    const trimmed = product.trim();
    if (!trimmed) return 'BRL';

    // Often formatted as "TICKER - NOME COMPLETO"
    if (trimmed.includes(' - ')) {
      const parts = trimmed.split(' - ');
      const candidate = parts[0].trim().toUpperCase();
      if (/^[A-Z0-9]{4,8}$/.test(candidate)) {
        return this.b3Parser.normalizeTicker(candidate);
      }
    }

    // Sometimes only ticker or starts with ticker
    const match = trimmed.match(/^([A-Z]{4}[0-9]{1,2}[A-Z]?)/i);
    if (match) {
      return this.b3Parser.normalizeTicker(match[1].toUpperCase());
    }

    // Currency or cash balance
    const norm = trimmed.toLowerCase();
    if (norm.includes('saldo') || norm.includes('conta') || norm.includes('ted')) {
      return 'BRL';
    }

    return trimmed.split(' ')[0].toUpperCase();
  }

  private parseDirection(val: unknown): MovementDirection {
    const norm = String(val || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (norm.includes('deb') || norm === 'd' || norm === 'saida') {
      return 'debit';
    }
    return 'credit';
  }

  private parseDate(val: unknown): Date {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val;
    }

    if (typeof val === 'number') {
      // Excel serial date
      const utcDays = Math.floor(val - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate() + 1);
    }

    const str = String(val).trim();
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

    throw new Error(`Data inválida na planilha de movimentação: "${val}"`);
  }

  private parseNumber(val: unknown): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val || '').trim();
    if (!str || str === '-') return 0;

    const isNegative = str.includes('-') || str.startsWith('(');
    str = str.replace(/[R$\s()]/gi, '').replace('-', '');

    // Handle Brazilian format: 1.234,56 -> 1234.56
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  }
}
