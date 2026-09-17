export type MovementDirection = 'credit' | 'debit';

export type MovementCategory =
  | 'yield' // Rendimentos (FIIs, FI-Infra, etc.) - Tax Exempt
  | 'dividend' // Dividendos (Ações, BDRs) - Tax Exempt
  | 'jcp' // Juros Sobre Capital Próprio - Exclusive Taxation
  | 'bonus' // Bonificação em Ativos
  | 'fraction' // Leilão de Fração / Fração em Ativos
  | 'subscription' // Direito de Subscrição / Cessão de Direitos
  | 'transfer' // Transferência, TED, Transferência - Liquidação
  | 'other';

export class Movement {
  constructor(
    public readonly id: string,
    public readonly date: Date,
    public readonly movementType: string, // Raw movement label from B3 (e.g. "Rendimento", "Dividendo")
    public readonly category: MovementCategory,
    public readonly direction: MovementDirection,
    public readonly asset: string, // Normalized ticker (e.g. "CPTI11", "PETR4", "BRL")
    public readonly rawProduct: string, // Full product description from B3
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly totalValue: number,
    public readonly institution?: string,
    public readonly batchId?: string,
  ) {}

  /**
   * Returns true if this movement is a received passive income (Dividend, FII Yield, JCP)
   */
  get isIncome(): boolean {
    return (
      this.direction === 'credit' &&
      (this.category === 'yield' || this.category === 'dividend' || this.category === 'jcp')
    );
  }
}
