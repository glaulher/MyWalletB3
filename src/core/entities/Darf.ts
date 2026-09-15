export interface LossCarryOver {
  stock: number;
  dayTrade: number;
  fii: number;
  bdr: number;
  unit: number;
  option: number;
}

export class Darf {
  constructor(
    public readonly monthYear: string,
    public readonly taxDue: number,
    public readonly paid: boolean = false,
    public readonly stockSales: number = 0,
    public readonly isStockExempt: boolean = true,
    public readonly stockProfit: number = 0,
    public readonly stockTaxableProfit: number = 0,
    public readonly stockTax: number = 0,
    public readonly dayTradeProfit: number = 0,
    public readonly dayTradeTax: number = 0,
    public readonly fiiSales: number = 0,
    public readonly fiiProfit: number = 0,
    public readonly fiiTax: number = 0,
    public readonly bdrSales: number = 0,
    public readonly bdrProfit: number = 0,
    public readonly bdrTax: number = 0,
    public readonly unitSales: number = 0,
    public readonly unitProfit: number = 0,
    public readonly unitTax: number = 0,
    public readonly optionSales: number = 0,
    public readonly optionProfit: number = 0,
    public readonly optionTax: number = 0,
    public readonly lossesCarriedOver: LossCarryOver = {
      stock: 0,
      dayTrade: 0,
      fii: 0,
      bdr: 0,
      unit: 0,
      option: 0,
    },
    public readonly dueDate?: Date,
  ) {}

  get totalLossesCarriedOver(): number {
    return (
      this.lossesCarriedOver.stock +
      this.lossesCarriedOver.dayTrade +
      this.lossesCarriedOver.fii +
      this.lossesCarriedOver.bdr +
      this.lossesCarriedOver.unit +
      this.lossesCarriedOver.option
    );
  }
}
