import { Operation } from '../entities/Operation.ts';
import { Darf, LossCarryOver } from '../entities/Darf.ts';
import { B3Parser } from './B3Parser.ts';

interface MonthlyTaxBucket {
  monthKey: string; // YYYY-MM
  monthYear: string; // MM/YYYY
  date: Date;
  // Day Trade (20% fixo)
  dayTradeProfit: number;
  // Stock Swing Trade (15%, isenção <= 20.000)
  stockSales: number;
  stockProfit: number;
  // Units tipo TAEE11 (20% fixo, sem isenção)
  unitSales: number;
  unitProfit: number;
  // BDRs (20% fixo, sem isenção)
  bdrSales: number;
  bdrProfit: number;
  // FIIs (20% fixo, sem isenção)
  fiiSales: number;
  fiiProfit: number;
  // Opções Swing Trade (15% alíquota, sem isenção de 20k)
  optionSales: number;
  optionProfit: number;
}

export class DarfCalculator {
  private parser = new B3Parser();

  calculate(operations: Operation[]): Darf[] {
    if (!operations || operations.length === 0) {
      return [];
    }

    // 1. Group operations by Day and Ticker to identify Day Trades
    const dailyOps = new Map<string, { buys: Operation[]; sells: Operation[] }>();

    for (const op of operations) {
      const year = op.date.getFullYear();
      const month = String(op.date.getMonth() + 1).padStart(2, '0');
      const day = String(op.date.getDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}_${op.asset.toUpperCase()}`;

      let dayGroup = dailyOps.get(dayKey);
      if (!dayGroup) {
        dayGroup = { buys: [], sells: [] };
        dailyOps.set(dayKey, dayGroup);
      }
      if (op.type === 'buy') {
        dayGroup.buys.push(op);
      } else {
        dayGroup.sells.push(op);
      }
    }

    // Map to keep track of day trade quantities already consumed per sell op ID
    const dayTradeConsumedSellQty = new Map<string, number>();
    const monthlyDayTradeProfit = new Map<string, number>();

    for (const [dayKey, group] of dailyOps.entries()) {
      const totalBuyQty = group.buys.reduce((sum, b) => sum + b.quantity, 0);
      const totalSellQty = group.sells.reduce((sum, s) => sum + s.quantity, 0);
      const matchedQty = Math.min(totalBuyQty, totalSellQty);

      if (matchedQty > 0) {
        // We have Day Trade on this day!
        const avgBuyPrice =
          group.buys.reduce((sum, b) => sum + b.quantity * b.unitPrice + b.fees, 0) / totalBuyQty;
        const avgSellPrice =
          group.sells.reduce((sum, s) => sum + s.quantity * s.unitPrice - s.fees, 0) / totalSellQty;
        const dtProfit = matchedQty * (avgSellPrice - avgBuyPrice);

        const monthKey = dayKey.substring(0, 7); // YYYY-MM
        monthlyDayTradeProfit.set(monthKey, (monthlyDayTradeProfit.get(monthKey) || 0) + dtProfit);

        // Consume quantities from sells proportionally
        let remainingToConsume = matchedQty;
        for (const sell of group.sells) {
          const consume = Math.min(sell.quantity, remainingToConsume);
          dayTradeConsumedSellQty.set(
            sell.id,
            (dayTradeConsumedSellQty.get(sell.id) || 0) + consume,
          );
          remainingToConsume -= consume;
          if (remainingToConsume <= 0) break;
        }
      }
    }

    // 2. Sort all operations chronologically for Swing Trade Average Price calculation
    const sorted = [...operations].sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      return a.type === 'buy' ? -1 : 1;
    });

    const positions = new Map<
      string,
      { quantity: number; averagePrice: number; totalCost: number }
    >();
    const monthlyBuckets = new Map<string, MonthlyTaxBucket>();

    const getBucket = (date: Date): MonthlyTaxBucket => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      let b = monthlyBuckets.get(monthKey);
      if (!b) {
        b = {
          monthKey,
          monthYear: `${month}/${year}`,
          date: new Date(year, date.getMonth(), 1),
          dayTradeProfit: monthlyDayTradeProfit.get(monthKey) || 0,
          stockSales: 0,
          stockProfit: 0,
          unitSales: 0,
          unitProfit: 0,
          bdrSales: 0,
          bdrProfit: 0,
          fiiSales: 0,
          fiiProfit: 0,
          optionSales: 0,
          optionProfit: 0,
        };
        monthlyBuckets.set(monthKey, b);
      }
      return b;
    };

    // Ensure months with only day trades are registered in monthlyBuckets
    for (const [mKey, dtProfit] of monthlyDayTradeProfit.entries()) {
      if (!monthlyBuckets.has(mKey)) {
        const [y, m] = mKey.split('-').map(Number);
        const b: MonthlyTaxBucket = {
          monthKey: mKey,
          monthYear: `${String(m).padStart(2, '0')}/${y}`,
          date: new Date(y, m - 1, 1),
          dayTradeProfit: dtProfit,
          stockSales: 0,
          stockProfit: 0,
          unitSales: 0,
          unitProfit: 0,
          bdrSales: 0,
          bdrProfit: 0,
          fiiSales: 0,
          fiiProfit: 0,
          optionSales: 0,
          optionProfit: 0,
        };
        monthlyBuckets.set(mKey, b);
      }
    }

    for (const op of sorted) {
      const ticker = op.asset.toUpperCase().trim();
      const assetType = this.parser.detectAssetType(ticker);
      const current = positions.get(ticker) ?? { quantity: 0, averagePrice: 0, totalCost: 0 };

      if (op.type === 'buy') {
        const opCost = op.quantity * op.unitPrice + op.fees;
        const newQty = current.quantity + op.quantity;
        const newCost = current.totalCost + opCost;
        const newAvg = newQty > 0 ? newCost / newQty : 0;

        positions.set(ticker, {
          quantity: newQty,
          averagePrice: newAvg,
          totalCost: newCost,
        });
      } else if (op.type === 'sell') {
        const dayTradeQty = dayTradeConsumedSellQty.get(op.id) || 0;
        const swingQty = Math.max(0, op.quantity - dayTradeQty);

        if (swingQty > 0) {
          const swingSaleTotal = swingQty * op.unitPrice - (op.fees * swingQty) / op.quantity;
          const costBasis = swingQty * current.averagePrice;
          const swingProfit = swingSaleTotal - costBasis;

          const bucket = getBucket(op.date);

          if (assetType === 'stock') {
            bucket.stockSales += swingQty * op.unitPrice;
            bucket.stockProfit += swingProfit;
          } else if (assetType === 'unit') {
            // Units (TAEE11, etc): 20% alíquota fixa, sem limite de 20k
            bucket.unitSales += swingQty * op.unitPrice;
            bucket.unitProfit += swingProfit;
          } else if (assetType === 'bdr') {
            // BDR: 20% alíquota fixa, sem limite de 20k
            bucket.bdrSales += swingQty * op.unitPrice;
            bucket.bdrProfit += swingProfit;
          } else if (assetType === 'fii') {
            // FII: 20% alíquota fixa, sem limite de 20k
            bucket.fiiSales += swingQty * op.unitPrice;
            bucket.fiiProfit += swingProfit;
          } else if (assetType === 'option') {
            // Opções: 15% alíquota fixa, sem isenção de 20k
            bucket.optionSales += swingQty * op.unitPrice;
            bucket.optionProfit += swingProfit;
          }
        }

        // Deduct full quantity from holding
        const remainingQty = Math.max(0, current.quantity - op.quantity);
        const remainingCost = remainingQty > 0 ? remainingQty * current.averagePrice : 0;
        const avgPrice = remainingQty > 0 ? current.averagePrice : 0;

        positions.set(ticker, {
          quantity: remainingQty,
          averagePrice: avgPrice,
          totalCost: remainingCost,
        });
      }
    }

    // 3. Process Months chronologically to calculate taxes and accumulate loss carryovers
    const sortedBuckets = Array.from(monthlyBuckets.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    const losses: LossCarryOver = {
      stock: 0,
      dayTrade: 0,
      fii: 0,
      bdr: 0,
      unit: 0,
      option: 0,
    };

    const darfs: Darf[] = [];

    for (const b of sortedBuckets) {
      // --- Day Trade (20% alíquota fixa) ---
      let dayTradeTaxable = 0;
      if (b.dayTradeProfit < 0) {
        losses.dayTrade += Math.abs(b.dayTradeProfit);
      } else if (b.dayTradeProfit > 0) {
        if (losses.dayTrade > 0) {
          if (b.dayTradeProfit >= losses.dayTrade) {
            dayTradeTaxable = b.dayTradeProfit - losses.dayTrade;
            losses.dayTrade = 0;
          } else {
            dayTradeTaxable = 0;
            losses.dayTrade -= b.dayTradeProfit;
          }
        } else {
          dayTradeTaxable = b.dayTradeProfit;
        }
      }
      const dayTradeTax = dayTradeTaxable * 0.2;

      // --- Ações Comuns Swing Trade (15%, isenção <= R$ 20.000) ---
      const isStockExempt = b.stockSales <= 20000;
      let stockTaxable = 0;
      if (b.stockProfit < 0) {
        losses.stock += Math.abs(b.stockProfit);
      } else if (!isStockExempt && b.stockProfit > 0) {
        if (losses.stock > 0) {
          if (b.stockProfit >= losses.stock) {
            stockTaxable = b.stockProfit - losses.stock;
            losses.stock = 0;
          } else {
            stockTaxable = 0;
            losses.stock -= b.stockProfit;
          }
        } else {
          stockTaxable = b.stockProfit;
        }
      }
      const stockTax = stockTaxable * 0.15;

      // --- Units / Composição de ações tipo TAEE11 (20% alíquota fixa, sem isenção de 20k) ---
      let unitTaxable = 0;
      if (b.unitProfit < 0) {
        losses.unit += Math.abs(b.unitProfit);
      } else if (b.unitProfit > 0) {
        if (losses.unit > 0) {
          if (b.unitProfit >= losses.unit) {
            unitTaxable = b.unitProfit - losses.unit;
            losses.unit = 0;
          } else {
            unitTaxable = 0;
            losses.unit -= b.unitProfit;
          }
        } else {
          unitTaxable = b.unitProfit;
        }
      }
      const unitTax = unitTaxable * 0.2;

      // --- BDRs (20% alíquota fixa, sem isenção de 20k) ---
      let bdrTaxable = 0;
      if (b.bdrProfit < 0) {
        losses.bdr += Math.abs(b.bdrProfit);
      } else if (b.bdrProfit > 0) {
        if (losses.bdr > 0) {
          if (b.bdrProfit >= losses.bdr) {
            bdrTaxable = b.bdrProfit - losses.bdr;
            losses.bdr = 0;
          } else {
            bdrTaxable = 0;
            losses.bdr -= b.bdrProfit;
          }
        } else {
          bdrTaxable = b.bdrProfit;
        }
      }
      const bdrTax = bdrTaxable * 0.2;

      // --- FIIs (20% alíquota fixa, sem isenção) ---
      let fiiTaxable = 0;
      if (b.fiiProfit < 0) {
        losses.fii += Math.abs(b.fiiProfit);
      } else if (b.fiiProfit > 0) {
        if (losses.fii > 0) {
          if (b.fiiProfit >= losses.fii) {
            fiiTaxable = b.fiiProfit - losses.fii;
            losses.fii = 0;
          } else {
            fiiTaxable = 0;
            losses.fii -= b.fiiProfit;
          }
        } else {
          fiiTaxable = b.fiiProfit;
        }
      }
      const fiiTax = fiiTaxable * 0.2;

      // --- Opções Swing Trade (15% alíquota fixa, sem isenção de 20k) ---
      let optionTaxable = 0;
      if (b.optionProfit < 0) {
        losses.option += Math.abs(b.optionProfit);
      } else if (b.optionProfit > 0) {
        if (losses.option > 0) {
          if (b.optionProfit >= losses.option) {
            optionTaxable = b.optionProfit - losses.option;
            losses.option = 0;
          } else {
            optionTaxable = 0;
            losses.option -= b.optionProfit;
          }
        } else {
          optionTaxable = b.optionProfit;
        }
      }
      const optionTax = optionTaxable * 0.15;

      const totalTaxDue =
        Math.round((dayTradeTax + stockTax + unitTax + bdrTax + fiiTax + optionTax) * 100) / 100;
      const dueDate = this.calculateDueDate(b.date);

      darfs.push(
        new Darf(
          b.monthYear,
          totalTaxDue,
          false,
          Math.round(b.stockSales * 100) / 100,
          isStockExempt,
          Math.round(b.stockProfit * 100) / 100,
          Math.round(stockTaxable * 100) / 100,
          Math.round(stockTax * 100) / 100,
          Math.round(b.dayTradeProfit * 100) / 100,
          Math.round(dayTradeTax * 100) / 100,
          Math.round(b.fiiSales * 100) / 100,
          Math.round(b.fiiProfit * 100) / 100,
          Math.round(fiiTax * 100) / 100,
          Math.round(b.bdrSales * 100) / 100,
          Math.round(b.bdrProfit * 100) / 100,
          Math.round(bdrTax * 100) / 100,
          Math.round(b.unitSales * 100) / 100,
          Math.round(b.unitProfit * 100) / 100,
          Math.round(unitTax * 100) / 100,
          Math.round(b.optionSales * 100) / 100,
          Math.round(b.optionProfit * 100) / 100,
          Math.round(optionTax * 100) / 100,
          {
            stock: Math.round(losses.stock * 100) / 100,
            dayTrade: Math.round(losses.dayTrade * 100) / 100,
            fii: Math.round(losses.fii * 100) / 100,
            bdr: Math.round(losses.bdr * 100) / 100,
            unit: Math.round(losses.unit * 100) / 100,
            option: Math.round(losses.option * 100) / 100,
          },
          dueDate,
        ),
      );
    }

    return darfs.sort((a, b) => {
      const [mA, yA] = a.monthYear.split('/').map(Number);
      const [mB, yB] = b.monthYear.split('/').map(Number);
      return yB !== yA ? yB - yA : mB - mA;
    });
  }

  private calculateDueDate(baseDate: Date): Date {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + 1;
    const lastDay = new Date(year, month + 1, 0);

    if (lastDay.getDay() === 6) {
      lastDay.setDate(lastDay.getDate() - 1);
    } else if (lastDay.getDay() === 0) {
      lastDay.setDate(lastDay.getDate() - 2);
    }
    return lastDay;
  }
}
