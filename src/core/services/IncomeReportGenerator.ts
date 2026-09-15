import { Operation } from '../entities/Operation.ts';
import { AssetType } from '../entities/Asset.ts';
import { B3Parser } from './B3Parser.ts';
import { AveragePriceCalculator } from './AveragePriceCalculator.ts';

export interface IncomeReportItem {
  ticker: string;
  assetType: AssetType;
  groupCode: string; // e.g. "03"
  itemCode: string; // e.g. "01"
  groupName: string;
  quantity: number;
  averagePrice: number;
  currentYearCost: number; // 31/12 current year
  previousYearCost: number; // 31/12 previous year
  institution: string;
  description: string;
}

export class IncomeReportGenerator {
  private parser = new B3Parser();
  private calculator = new AveragePriceCalculator();

  /**
   * Generates Income Report (Bens e Direitos) for December 31st of the target year.
   */
  generateReport(operations: Operation[], targetYear: number): IncomeReportItem[] {
    const cutoffDateCurrentYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    const cutoffDatePreviousYear = new Date(targetYear - 1, 11, 31, 23, 59, 59, 999);

    // Filter operations up to current year cutoff
    const opsCurrent = operations.filter(
      (op) => op.date.getTime() <= cutoffDateCurrentYear.getTime(),
    );
    const positionsCurrent = this.calculator.calculate(opsCurrent);

    // Filter operations up to previous year cutoff
    const opsPrevious = operations.filter(
      (op) => op.date.getTime() <= cutoffDatePreviousYear.getTime(),
    );
    const positionsPrevious = this.calculator.calculate(opsPrevious);

    const prevMap = new Map(positionsPrevious.map((p) => [p.ticker.toUpperCase(), p.totalCost]));

    // Find institution associated with each asset (from the latest operation)
    const latestInstitution = new Map<string, string>();
    const sortedOps = [...operations].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const op of sortedOps) {
      if (op.institution) {
        latestInstitution.set(op.asset.toUpperCase(), op.institution);
      }
    }

    const reportItems: IncomeReportItem[] = [];

    for (const pos of positionsCurrent) {
      const ticker = pos.ticker.toUpperCase();
      const assetType = this.parser.detectAssetType(ticker);
      const prevCost = prevMap.get(ticker) || 0;
      const inst = latestInstitution.get(ticker) || 'Corretora de Custódia';

      const { groupCode, itemCode, groupName } = this.getRevenueCodes(assetType);
      const unitLabel =
        assetType === 'fii' ? 'cotas' : assetType === 'option' ? 'contratos de opções' : 'ações';

      const avgFormatted = pos.averagePrice.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
      const totalFormatted = pos.totalCost.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const description = `${pos.quantity} ${unitLabel} de ${ticker}, custodiadas na instituição ${inst}, ao preço médio de R$ ${avgFormatted}, totalizando custo de aquisição de R$ ${totalFormatted}.`;

      reportItems.push({
        ticker,
        assetType,
        groupCode,
        itemCode,
        groupName,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        currentYearCost: pos.totalCost,
        previousYearCost: prevCost,
        institution: inst,
        description,
      });
    }

    return reportItems.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  private getRevenueCodes(assetType: AssetType): {
    groupCode: string;
    itemCode: string;
    groupName: string;
  } {
    switch (assetType) {
      case 'stock':
      case 'unit':
        return {
          groupCode: '03',
          itemCode: '01',
          groupName: '03 - Participações Societárias (Ações / Units)',
        };
      case 'fii':
        return {
          groupCode: '07',
          itemCode: '03',
          groupName: '07 - Fundos (Fundos Imobiliários - FII)',
        };
      case 'fi-infra':
        return {
          groupCode: '07',
          itemCode: '01',
          groupName: '07 - Fundos (FI-Infra - Fundos Incentivados de Infraestrutura)',
        };
      case 'bdr':
        return {
          groupCode: '04',
          itemCode: '04',
          groupName: '04 - Aplicações e Investimentos (Ativos no Exterior / BDR)',
        };
      case 'option':
      default:
        return {
          groupCode: '99',
          itemCode: '99',
          groupName: '99 - Outros Bens e Direitos (Opções e Derivativos)',
        };
    }
  }
}
