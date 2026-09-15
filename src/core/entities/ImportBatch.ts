export class ImportBatch {
  constructor(
    public readonly id: string,
    public readonly fileName: string,
    public readonly importedAt: Date,
    public readonly operationCount: number,
  ) {}
}
