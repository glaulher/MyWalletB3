import { DarfCalculator } from '../../core/services/DarfCalculator.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';

export class DarfView {
  private container: HTMLElement;
  private operationRepo: IOperationRepository;
  private darfCalculator = new DarfCalculator();

  constructor(
    container: HTMLElement,
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
  ) {
    this.container = container;
    this.operationRepo = operationRepo;
  }

  async render(): Promise<void> {
    const operations = await this.operationRepo.getAll();
    const darfs = this.darfCalculator.calculate(operations);

    const totalTaxDue = darfs.reduce((acc, d) => acc + d.taxDue, 0);
    const monthsWithTax = darfs.filter((d) => d.taxDue > 0).length;
    const latestDarf = darfs.length > 0 ? darfs[0] : null;
    const accumulatedLoss = latestDarf ? latestDarf.totalLossesCarriedOver : 0;

    this.container.innerHTML = `
      <div class="view-content">
        <div class="view-header">
          <div>
            <h2 class="view-title">🧾 Calculadora e Apuração de DARF</h2>
            <p class="view-subtitle">Apuração mensal segundo regras da B3/Receita: Ações Swing 15% (isenção até R$ 20k), Day Trade 20%, Opções Swing 15% (sem isenção), Units (ex: TAEE11) 20% fixa, BDRs 20% fixa e FIIs 20% fixa.</p>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          ${KpiCard.generateHtml({
            title: 'Total de Imposto Devido',
            icon: '💰',
            value: `R$ ${totalTaxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: `${monthsWithTax} meses com imposto a pagar`,
          })}
          ${KpiCard.generateHtml({
            title: 'Meses com Venda',
            icon: '📅',
            value: String(darfs.length),
            subtext: 'Competências apuradas',
          })}
          ${KpiCard.generateHtml({
            title: 'Prejuízo a Compensar',
            icon: '📉',
            value: `R$ ${accumulatedLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            subtext: 'Saldo acumulado para meses futuros',
          })}
          ${KpiCard.generateHtml({
            title: 'Código da Receita',
            icon: '🏷️',
            value: '6015',
            subtext: 'Pessoa Física - Ganhos Líquidos em Bolsa',
          })}
        </div>

        <!-- Tabela Mensal -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Apuração Mensal por Competência</h3>
              <p class="card-subtitle">Cálculo individualizado aplicando compensação de prejuízos e alíquotas oficiais.</p>
            </div>
            <span class="badge badge-info">${darfs.length} meses apurados</span>
          </div>

          ${
            darfs.length === 0
              ? `<div class="chart-empty" style="padding: 32px;">Nenhuma operação de venda registrada para apuração de imposto.</div>`
              : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Mês/Ano</th>
                    <th class="text-right">Vendas Ações</th>
                    <th>Isenção Ações</th>
                    <th class="text-right">Lucro Ações (15%)</th>
                    <th class="text-right">Day Trade (20%)</th>
                    <th class="text-right">Opções (15%)</th>
                    <th class="text-right">Units TAEE11 (20%)</th>
                    <th class="text-right">BDRs (20%)</th>
                    <th class="text-right">FIIs (20%)</th>
                    <th class="text-right">Prejuízo a Transp.</th>
                    <th class="text-right">DARF Devido</th>
                    <th>Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  ${darfs
                    .map((d) => {
                      const isExemptBadge = d.isStockExempt
                        ? Badge.generateHtml({ label: 'Isento (< 20k)', variant: 'info' })
                        : Badge.generateHtml({ label: 'Tributável (> 20k)', variant: 'warning' });

                      const taxClass = d.taxDue > 0 ? 'font-bold text-danger' : 'text-muted';
                      const dueDateStr = d.dueDate
                        ? `${String(d.dueDate.getDate()).padStart(2, '0')}/${String(d.dueDate.getMonth() + 1).padStart(2, '0')}/${d.dueDate.getFullYear()}`
                        : '-';

                      return `
                      <tr>
                        <td class="font-bold font-mono">${d.monthYear}</td>
                        <td class="text-right font-mono">R$ ${d.stockSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td>${isExemptBadge}</td>
                        <td class="text-right font-mono ${d.stockProfit > 0 ? 'text-success' : d.stockProfit < 0 ? 'text-danger' : ''}">
                          R$ ${d.stockProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td class="text-right font-mono ${d.dayTradeProfit > 0 ? 'text-success' : d.dayTradeProfit < 0 ? 'text-danger' : ''}">
                          R$ ${d.dayTradeProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td class="text-right font-mono ${d.optionProfit > 0 ? 'text-success' : d.optionProfit < 0 ? 'text-danger' : ''}">
                          R$ ${d.optionProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td class="text-right font-mono ${d.unitProfit > 0 ? 'text-success' : d.unitProfit < 0 ? 'text-danger' : ''}">
                          R$ ${d.unitProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td class="text-right font-mono ${d.bdrProfit > 0 ? 'text-success' : d.bdrProfit < 0 ? 'text-danger' : ''}">
                          R$ ${d.bdrProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td class="text-right font-mono ${d.fiiProfit > 0 ? 'text-success' : d.fiiProfit < 0 ? 'text-danger' : ''}">
                          R$ ${d.fiiProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td class="text-right font-mono text-muted">
                          R$ ${d.totalLossesCarriedOver.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td class="text-right font-mono ${taxClass}">
                          R$ ${d.taxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td>${dueDateStr}</td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      </div>
    `;
  }
}
