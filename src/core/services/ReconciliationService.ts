import { Operation } from '../entities/Operation.ts';
import { ConsolidatedPosition } from '../entities/ConsolidatedPosition.ts';
import { AssetType } from '../entities/Asset.ts';
import { B3PositionItem } from './B3PositionParser.ts';

export type DiscrepancyType =
  | 'MATCH'
  | 'OPTION_WORTHLESS'
  | 'SPLIT_SUSPECTED'
  | 'REVERSE_SPLIT_SUSPECTED'
  | 'MISSING_IN_APP'
  | 'EXCESS_IN_APP'
  | 'DEFICIT_IN_APP';

export interface ReconciliationItem {
  ticker: string;
  assetType: AssetType;
  productName?: string;
  calculatedQty: number;
  b3Qty: number;
  diffQty: number; // b3Qty - calculatedQty
  closePrice: number;
  calculatedAvgPrice: number;
  type: DiscrepancyType;
  description: string;
  suggestedActionLabel: string;
  ratio?: number;
  purchaseDate?: Date;
  expirationDate?: Date;
}

export class ReconciliationService {
  /**
   * Compares calculated positions against official B3 custody items
   */
  reconcile(
    calculatedPositions: ConsolidatedPosition[],
    b3Items: B3PositionItem[],
    operations?: Operation[],
  ): ReconciliationItem[] {
    const calcMap = new Map<string, ConsolidatedPosition>();
    calculatedPositions.forEach((p) => calcMap.set(p.ticker.toUpperCase().trim(), p));

    const b3Map = new Map<string, B3PositionItem>();
    b3Items.forEach((b) => b3Map.set(b.ticker.toUpperCase().trim(), b));

    const allTickers = new Set([...calcMap.keys(), ...b3Map.keys()]);
    const results: ReconciliationItem[] = [];

    for (const ticker of allTickers) {
      const calc = calcMap.get(ticker);
      const b3 = b3Map.get(ticker);

      const calculatedQty = calc?.quantity || 0;
      const calculatedAvgPrice = calc?.averagePrice || 0;
      const b3Qty = b3?.quantity || 0;
      const diffQty = b3Qty - calculatedQty;
      const closePrice = b3?.closePrice || 0;
      const assetType: AssetType = b3?.assetType || calc?.type || 'stock';
      const productName = b3?.productName;

      // 1. Matched
      if (calculatedQty === b3Qty) {
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty: 0,
          closePrice,
          calculatedAvgPrice,
          type: 'MATCH',
          description: 'Custódia 100% conciliada com a B3.',
          suggestedActionLabel: 'Nenhuma ação necessária',
        });
        continue;
      }

      // 2. Option expired / worthless
      if (assetType === 'option' && calculatedQty > 0 && b3Qty === 0) {
        let purchaseDate: Date | undefined;
        let expirationDate: Date | undefined;
        let description = 'Opção expirou sem exercício (virou pó). Posição encerrada na B3.';

        if (operations && operations.length > 0) {
          const buyOps = operations
            .filter((o) => o.asset.toUpperCase().trim() === ticker && o.type === 'buy')
            .sort((a, b) => a.date.getTime() - b.date.getTime());
          if (buyOps.length > 0) {
            purchaseDate = buyOps[0].date;
            expirationDate = this.calculateOptionExpirationDate(ticker, purchaseDate);
            const buyDay = String(purchaseDate.getDate()).padStart(2, '0');
            const buyMonth = String(purchaseDate.getMonth() + 1).padStart(2, '0');
            const buyYear = purchaseDate.getFullYear();
            const expDay = String(expirationDate.getDate()).padStart(2, '0');
            const expMonth = String(expirationDate.getMonth() + 1).padStart(2, '0');
            const expYear = expirationDate.getFullYear();
            description = `Comprada em ${buyDay}/${buyMonth}/${buyYear}. Vencimento B3 detectado: ${expDay}/${expMonth}/${expYear} (3ª sexta-feira). Opção virou pó.`;
          }
        }

        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'OPTION_WORTHLESS',
          description,
          suggestedActionLabel: 'Baixar por Expiração (Virou Pó) a R$ 0,00',
          purchaseDate,
          expirationDate,
        });
        continue;
      }

      // 3. Suspected Split (b3Qty is integer multiple of calculatedQty)
      if (calculatedQty > 0 && b3Qty > calculatedQty && b3Qty % calculatedQty === 0) {
        const ratio = Math.round(b3Qty / calculatedQty);
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'SPLIT_SUSPECTED',
          ratio,
          description: `Provável desdobramento de 1 para ${ratio} (B3 possui ${ratio}x a quantidade calculada).`,
          suggestedActionLabel: `Aplicar Desdobramento (Split 1:${ratio})`,
        });
        continue;
      }

      // 4. Suspected Reverse Split (calculatedQty is integer multiple of b3Qty)
      if (calculatedQty > 0 && b3Qty > 0 && calculatedQty > b3Qty && calculatedQty % b3Qty === 0) {
        const ratio = Math.round(calculatedQty / b3Qty);
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'REVERSE_SPLIT_SUSPECTED',
          ratio,
          description: `Provável grupamento de ${ratio} para 1 (B3 possui 1/${ratio} da quantidade calculada).`,
          suggestedActionLabel: `Aplicar Grupamento (${ratio}:1)`,
        });
        continue;
      }

      // 5. Missing in App (present in B3, no ops in app)
      if (calculatedQty === 0 && b3Qty > 0) {
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty: 0,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice: 0,
          type: 'MISSING_IN_APP',
          description: `Ativo com ${b3Qty} cota(s) na B3 sem movimentações registradas no aplicativo.`,
          suggestedActionLabel: `Importar Posição B3 (${b3Qty} cotas a R$ ${closePrice.toFixed(2)})`,
        });
        continue;
      }

      // 6. Excess in App (calculatedQty > b3Qty)
      if (calculatedQty > b3Qty) {
        results.push({
          ticker,
          assetType,
          productName,
          calculatedQty,
          b3Qty,
          diffQty,
          closePrice,
          calculatedAvgPrice,
          type: 'EXCESS_IN_APP',
          description:
            b3Qty === 0
              ? `Ativo com posição zerada na B3, mas com saldo de ${calculatedQty} no app (venda total).`
              : `App possui ${calculatedQty - b3Qty} cota(s) a mais que a B3 (venda parcial não importada).`,
          suggestedActionLabel: `Ajustar Saída (-${calculatedQty - b3Qty} cotas)`,
        });
        continue;
      }

      // 7. Deficit in App (b3Qty > calculatedQty)
      results.push({
        ticker,
        assetType,
        productName,
        calculatedQty,
        b3Qty,
        diffQty,
        closePrice,
        calculatedAvgPrice,
        type: 'DEFICIT_IN_APP',
        description: `B3 possui ${diffQty} cota(s) a mais que o app (subscrição, bonificação ou compras faltantes).`,
        suggestedActionLabel: `Lançar Entrada (+${diffQty} cotas)`,
      });
    }

    // Sort: Discrepancies first, matches last; then by ticker
    return results.sort((a, b) => {
      if (a.type === 'MATCH' && b.type !== 'MATCH') return 1;
      if (a.type !== 'MATCH' && b.type === 'MATCH') return -1;
      return a.ticker.localeCompare(b.ticker);
    });
  }

  /**
   * Generates a sell operation for an option that expired worthless (price R$ 0,00).
   */
  createWorthlessOptionOperation(
    ticker: string,
    quantity: number,
    date: Date = new Date(),
  ): Operation {
    return new Operation(
      `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      ticker.toUpperCase().trim(),
      'sell',
      quantity,
      0,
      0,
      'Expiração (Virou Pó)',
    );
  }

  /**
   * Generates a split (desdobramento) operation:
   * Adds additional shares at price R$ 0,00, which multiplies quantity and divides average price.
   */
  createSplitOperation(
    ticker: string,
    currentQty: number,
    splitMultiplier: number,
    date: Date = new Date(),
  ): Operation {
    const additionalQty = currentQty * splitMultiplier - currentQty;
    return new Operation(
      `split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      ticker.toUpperCase().trim(),
      'buy',
      additionalQty,
      0,
      0,
      `Desdobramento (Split 1:${splitMultiplier})`,
    );
  }

  /**
   * Generates a subscription / bonus / custody adjustment operation
   */
  createAdjustmentOperation(
    ticker: string,
    type: 'buy' | 'sell',
    quantity: number,
    unitPrice: number = 0,
    institution: string = 'Ajuste / Subscrição',
    date: Date = new Date(),
  ): Operation {
    return new Operation(
      `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      ticker.toUpperCase().trim(),
      type,
      quantity,
      unitPrice,
      0,
      institution,
    );
  }

  /**
   * Generates paired operations for an asset conversion, incorporation, or ticker migration (e.g. IRDM11 -> IRIM11).
   * 1. Technical sell of all old asset units at exact average price (lucro 0 fiscal).
   * 2. Technical buy of new asset units transferring the historical cost.
   */
  createConversionOperations(
    oldTicker: string,
    oldQuantity: number,
    oldAveragePrice: number,
    newTicker: string,
    newQuantity: number,
    date: Date = new Date(),
    cashReceived = 0,
  ): [Operation, Operation] {
    const totalCost = oldQuantity * oldAveragePrice;
    const netCost = Math.max(0, totalCost - cashReceived);
    const newUnitPrice = newQuantity > 0 ? netCost / newQuantity : 0;

    const sellOp = new Operation(
      `conv-sell-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date,
      oldTicker.toUpperCase().trim(),
      'sell',
      oldQuantity,
      oldAveragePrice,
      0,
      `Incorporação / Conversão (${newTicker.toUpperCase().trim()})`,
    );

    const buyOp = new Operation(
      `conv-buy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date,
      newTicker.toUpperCase().trim(),
      'buy',
      newQuantity,
      newUnitPrice,
      0,
      `Incorporação / Conversão (${oldTicker.toUpperCase().trim()})`,
    );

    return [sellOp, buyOp];
  }

  /**
   * Decodes B3 option ticker 5th character to determine expiration month (0-11) and type (CALL/PUT).
   * Calls: A-L (Jan-Dec)
   * Puts: M-X (Jan-Dec)
   */
  getOptionExpirationMonth(
    ticker: string,
  ): { monthIndex: number; optionType: 'CALL' | 'PUT' } | null {
    const clean = ticker.toUpperCase().trim();
    if (clean.length >= 5) {
      const monthChar = clean[4];
      const callIdx = 'ABCDEFGHIJKL'.indexOf(monthChar);
      if (callIdx !== -1) {
        return { monthIndex: callIdx, optionType: 'CALL' };
      }
      const putIdx = 'MNOPQRSTUVWX'.indexOf(monthChar);
      if (putIdx !== -1) {
        return { monthIndex: putIdx, optionType: 'PUT' };
      }
    }
    return null;
  }

  /**
   * Calculates the 3rd Friday of a given year and month (official B3 expiration rule since May/2021).
   */
  getThirdFriday(year: number, monthIndex: number): Date {
    let fridaysCount = 0;
    for (let day = 1; day <= 31; day++) {
      const d = new Date(year, monthIndex, day);
      if (d.getMonth() !== monthIndex) break;
      if (d.getDay() === 5) {
        fridaysCount++;
        if (fridaysCount === 3) {
          return d;
        }
      }
    }
    return new Date(year, monthIndex, 15);
  }

  /**
   * Calculates the exact B3 option expiration date based on ticker code and purchase date.
   */
  calculateOptionExpirationDate(ticker: string, purchaseDate: Date): Date {
    const info = this.getOptionExpirationMonth(ticker);
    if (!info) {
      const fallback = new Date(purchaseDate);
      fallback.setDate(fallback.getDate() + 30);
      return fallback;
    }

    const { monthIndex } = info;
    let year = purchaseDate.getFullYear();

    // If expiration month is before purchase month in calendar, it belongs to next year
    if (monthIndex < purchaseDate.getMonth()) {
      year += 1;
    }

    let expiration = this.getThirdFriday(year, monthIndex);

    // If 3rd Friday of this month is before purchase date (e.g. bought later in the month), it's next year's cycle
    if (expiration.getTime() < purchaseDate.getTime()) {
      year += 1;
      expiration = this.getThirdFriday(year, monthIndex);
    }

    return expiration;
  }
}
