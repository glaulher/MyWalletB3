import * as XLSX from 'xlsx';
import { AssetType } from '../entities/Asset.ts';
import { B3Parser } from './B3Parser.ts';

export interface B3PositionItem {
  ticker: string;
  productName: string;
  assetType: AssetType;
  quantity: number;
  closePrice: number;
  updatedValue: number;
  institutions: string[];
}

export class B3PositionParser {
  private b3Parser = new B3Parser();

  /**
   * Parses B3 Position spreadsheet (posicao-*.xlsx)
   */
  parse(buffer: ArrayBuffer | Uint8Array): B3PositionItem[] {
    const workbook = XLSX.read(buffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Planilha de posição não contém abas.');
    }

    const itemsMap = new Map<string, B3PositionItem>();

    // Variable income sheets to examine in B3 position file
    const targetSheets = [
      'Acoes',
      'Ações',
      'BDR',
      'ETF',
      'Fundo de Investimento',
      'Opções',
      'Derivativos',
    ];

    for (const sheetName of workbook.SheetNames) {
      const isTarget = targetSheets.some((ts) =>
        sheetName.toLowerCase().includes(
          ts
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''),
        ),
      );
      if (!isTarget) continue;

      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
      if (rawRows.length < 2) continue;

      // Find header row
      let headerRowIdx = -1;
      let colTicker = -1;
      let colQty = -1;
      let colPrice = -1;
      let colValue = -1;
      let colProd = -1;
      let colInst = -1;

      for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
        const row = rawRows[i];
        if (!Array.isArray(row)) continue;

        for (let c = 0; c < row.length; c++) {
          const val = String(row[c]).toLowerCase().trim();
          if (val.includes('código de negociação') || val.includes('codigo de negociacao'))
            colTicker = c;
          if (
            val === 'quantidade' ||
            (val.includes('quantidade') && !val.includes('indisponível') && colQty === -1)
          )
            colQty = c;
          if (val.includes('preço de fechamento') || val.includes('preco de fechamento'))
            colPrice = c;
          if (val.includes('valor atualizado')) colValue = c;
          if (val.includes('produto')) colProd = c;
          if (val.includes('instituição') || val.includes('instituicao')) colInst = c;
        }

        if (colTicker !== -1 && colQty !== -1) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) continue;

      for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawTicker = String(row[colTicker] || '')
          .trim()
          .toUpperCase();
        if (!rawTicker || rawTicker === 'TOTAL' || rawTicker === 'SUBTOTAL' || rawTicker === '-') {
          continue;
        }

        const rawQty = row[colQty];
        const qty =
          typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(',', '.'));
        if (isNaN(qty) || qty <= 0) continue;

        const rawPrice = colPrice !== -1 ? row[colPrice] : 0;
        const closePrice =
          typeof rawPrice === 'number'
            ? rawPrice
            : parseFloat(String(rawPrice).replace(',', '.')) || 0;

        const rawVal = colValue !== -1 ? row[colValue] : 0;
        const updatedValue =
          typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(',', '.')) || 0;

        const productName = colProd !== -1 ? String(row[colProd] || rawTicker).trim() : rawTicker;
        const institution = colInst !== -1 ? String(row[colInst] || '').trim() : '';

        const cleanTicker = this.b3Parser.normalizeTicker(rawTicker);
        const assetType = this.b3Parser.detectAssetType(cleanTicker);

        const existing = itemsMap.get(cleanTicker);
        if (existing) {
          existing.quantity += qty;
          existing.updatedValue += updatedValue;
          if (institution && !existing.institutions.includes(institution)) {
            existing.institutions.push(institution);
          }
        } else {
          itemsMap.set(cleanTicker, {
            ticker: cleanTicker,
            productName,
            assetType,
            quantity: qty,
            closePrice,
            updatedValue,
            institutions: institution ? [institution] : [],
          });
        }
      }
    }

    return Array.from(itemsMap.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }
}
