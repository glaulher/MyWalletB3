import {
  IncomeReportGenerator,
  IncomeReportItem,
} from '../../core/services/IncomeReportGenerator.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Icons } from '../components/Icons.ts';

export class IncomeReportView {
  private container: HTMLElement;
  private operationRepo: IOperationRepository;
  private generator = new IncomeReportGenerator();
  private selectedYear = new Date().getFullYear();

  constructor(
    container: HTMLElement,
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
  ) {
    this.container = container;
    this.operationRepo = operationRepo;
  }

  async render(): Promise<void> {
    const operations = await this.operationRepo.getAll();

    // Detect available years from operations
    const availableYears = Array.from(new Set(operations.map((op) => op.date.getFullYear()))).sort(
      (a, b) => b - a,
    );

    if (availableYears.length > 0 && !availableYears.includes(this.selectedYear)) {
      this.selectedYear = availableYears[0];
    }

    const items: IncomeReportItem[] = this.generator.generateReport(operations, this.selectedYear);
    const totalCostCurrentYear = items.reduce((acc, item) => acc + item.currentYearCost, 0);
    const totalCostPreviousYear = items.reduce((acc, item) => acc + item.previousYearCost, 0);

    this.container.innerHTML = `
      <div class="view-content">
        <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2 class="view-title">${Icons.fileSpreadsheet(22)} Informe para IRPF (Bens e Direitos em 31/12)</h2>
            <p class="view-subtitle">Relatório formatado com códigos e textos oficiais para a Declaração de Ajuste Anual da Receita Federal.</p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 13px; color: var(--text-muted); font-weight: 600;">Ano-Calendário:</label>
            <select id="select-irpf-year" class="select-input" style="font-size: 14px; padding: 6px 12px;">
              ${(availableYears.length > 0 ? availableYears : [this.selectedYear])
                .map(
                  (y) =>
                    `<option value="${y}" ${y === this.selectedYear ? 'selected' : ''}>${y}</option>`,
                )
                .join('')}
            </select>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          ${KpiCard.generateHtml({
            title: `Patrimônio em 31/12/${this.selectedYear}`,
            icon: Icons.wallet(18),
            value: `R$ ${totalCostCurrentYear.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Custo total de aquisição',
          })}
          ${KpiCard.generateHtml({
            title: `Patrimônio em 31/12/${this.selectedYear - 1}`,
            icon: Icons.landmark(18),
            value: `R$ ${totalCostPreviousYear.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Ano anterior',
          })}
          ${KpiCard.generateHtml({
            title: 'Ativos a Declarar',
            icon: Icons.fileText(18),
            value: String(items.length),
            subtext: 'Itens em Bens e Direitos',
          })}
        </div>

        <!-- Tabela de Bens e Direitos -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Ficha de Bens e Direitos (Posição em 31/12/${this.selectedYear})</h3>
              <p class="card-subtitle">Utilize os dados e a discriminação abaixo para preencher o programa da Receita Federal.</p>
            </div>
            <span class="badge badge-info">${items.length} ativos em custódia</span>
          </div>

          ${
            items.length === 0
              ? `<div class="chart-empty" style="padding: 32px;">Nenhum ativo em custódia na data de 31/12/${this.selectedYear}.</div>`
              : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Grupo / Código</th>
                    <th>Ativo</th>
                    <th class="text-right">Quantidade</th>
                    <th class="text-right">Preço Médio</th>
                    <th class="text-right">Situação em 31/12/${this.selectedYear - 1}</th>
                    <th class="text-right">Situação em 31/12/${this.selectedYear}</th>
                    <th>Discriminação e Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map((item, idx) => {
                      const badgeVariant =
                        item.assetType === 'stock'
                          ? 'stock'
                          : item.assetType === 'fii'
                            ? 'fii'
                            : item.assetType === 'unit'
                              ? 'unit'
                              : item.assetType === 'option'
                                ? 'option'
                                : 'bdr';

                      return `
                      <tr>
                        <td>
                          <div class="font-bold">${item.groupCode} - ${item.itemCode}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">${item.groupName}</div>
                        </td>
                        <td>
                          <span class="font-bold">${item.ticker}</span>
                          <div>${Badge.generateHtml({ label: item.assetType.toUpperCase(), variant: badgeVariant })}</div>
                        </td>
                        <td class="text-right">${item.quantity.toLocaleString('pt-BR')}</td>
                        <td class="text-right font-mono">R$ ${item.averagePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                        <td class="text-right font-mono">R$ ${item.previousYearCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right font-mono font-bold">R$ ${item.currentYearCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td style="max-width: 320px;">
                          <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px; line-height: 1.4;">${item.description}</div>
                          <button class="btn btn-secondary btn-small btn-copy-desc" data-index="${idx}">
                            ${Icons.copy(14)}
                            <span>Copiar Texto</span>
                          </button>
                        </td>
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

    this.bindEvents(items);
  }

  private bindEvents(items: IncomeReportItem[]): void {
    const selectYear = this.container.querySelector('#select-irpf-year') as HTMLSelectElement;
    selectYear?.addEventListener('change', () => {
      this.selectedYear = parseInt(selectYear.value, 10);
      this.render();
    });

    this.container.querySelectorAll('.btn-copy-desc').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt((btn as HTMLElement).dataset.index || '0', 10);
        const item = items[idx];
        if (item) {
          await navigator.clipboard.writeText(item.description);
          const originalText = btn.innerHTML;
          btn.innerHTML = `${Icons.check(14)} Copiado!`;
          setTimeout(() => {
            btn.innerHTML = originalText;
          }, 2000);
        }
      });
    });
  }
}
