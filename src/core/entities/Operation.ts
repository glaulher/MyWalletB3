export type OperationType = 'buy' | 'sell';

export class Operation {
  constructor(
    public readonly id: string,
    public readonly date: Date,
    public readonly asset: string,
    public readonly type: OperationType,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly fees: number = 0,
    public readonly institution?: string,
    public readonly batchId?: string,
  ) {}

  get totalValue(): number {
    return this.quantity * this.unitPrice;
  }
}
