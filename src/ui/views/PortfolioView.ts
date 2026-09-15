import { DashboardSummary } from '../../core/controllers/DashboardController.ts';
import { AllocationChart, SliceData } from '../components/AllocationChart.ts';
import { ColumnChart, ColumnChartItem } from '../components/ColumnChart.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Icons } from '../components/Icons.ts';

export class PortfolioView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(summary: DashboardSummary): void {
    if (summary.totalOperations === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${Icons.barChart(36)}</div>
          <h2>Nenhuma planilha importada</h2>
          <p>Clique no botão <strong>"Subir Planilha B3 (.xlsx/.csv)"</strong> acima para importar suas movimentações e calcular o preço médio.</p>
        </div>
      `;
      return;
    }

    const topPosition = summary.positions.length > 0 ? summary.positions[0] : null;

    this.container.innerHTML = `
      <div class="view-content">
        <!-- KPI Cards -->
        <section class="kpi-grid">
          ${KpiCard.generateHtml({
            title: 'Patrimônio Total',
            icon: Icons.wallet(18),
            value: `R$ ${summary.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Custo total acumulado',
          })}
          ${KpiCard.generateHtml({
            title: 'Total de Ativos',
            icon: Icons.building(18),
            value: String(summary.totalAssets),
            subtext: 'Ativos em custódia',
          })}
          ${KpiCard.generateHtml({
            title: 'Operações',
            icon: Icons.refresh(18),
            value: String(summary.totalOperations),
            subtext: 'Salvas no banco de dados',
          })}
          ${KpiCard.generateHtml({
            title: 'Maior Posição',
            icon: Icons.star(18),
            value: topPosition ? topPosition.ticker : '-',
            subtext:
              topPosition && summary.totalInvested > 0
                ? `${((topPosition.totalCost / summary.totalInvested) * 100).toFixed(1)}% da carteira`
                : '-',
          })}
        </section>

        <!-- Gráficos -->
        <section class="charts-section">
          <div class="card chart-card">
            <div class="card-header-flex">
              <div>
                <h3 class="card-title">Alocação por Ativo</h3>
                <p class="card-subtitle">Distribuição do custo total por ativo (gráfico de colunas)</p>
              </div>
            </div>
            <div id="portfolio-chart-by-asset" class="chart-wrapper"></div>
          </div>

          <div class="card chart-card">
            <div class="card-header-flex">
              <div>
                <h3 class="card-title">Alocação por Categoria</h3>
                <p class="card-subtitle">Distribuição percentual por classe de ativo</p>
              </div>
            </div>
            <div id="portfolio-chart-by-type" class="chart-wrapper"></div>
          </div>
        </section>

        <!-- Tabela de Posição Consolidada -->
        <section class="card table-card">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Posição Consolidada (Preço Médio)</h3>
              <p class="card-subtitle">Custo médio ponderado por compras e abatimento em vendas</p>
            </div>
            <span class="badge badge-info">${summary.positions.length} posições</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Tipo</th>
                  <th class="text-right">Quantidade</th>
                  <th class="text-right">Preço Médio</th>
                  <th class="text-right">Custo Total</th>
                  <th class="text-right">% Carteira</th>
                </tr>
              </thead>
              <tbody>
                ${summary.positions
                  .map((pos) => {
                    const pct =
                      summary.totalInvested > 0 ? (pos.totalCost / summary.totalInvested) * 100 : 0;
                    const typeLabel =
                      pos.type === 'fii'
                        ? 'FII'
                        : pos.type === 'bdr'
                          ? 'BDR'
                          : pos.type === 'unit'
                            ? 'Unit'
                            : 'Ação';
                    const badgeVariant =
                      pos.type === 'fii'
                        ? 'fii'
                        : pos.type === 'bdr'
                          ? 'bdr'
                          : pos.type === 'unit'
                            ? 'unit'
                            : 'stock';

                    return `
                      <tr>
                        <td class="font-bold">${pos.ticker}</td>
                        <td>${Badge.generateHtml({ label: typeLabel, variant: badgeVariant })}</td>
                        <td class="text-right font-mono">${pos.quantity.toLocaleString('pt-BR')}</td>
                        <td class="text-right font-mono">R$ ${pos.averagePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                        <td class="text-right font-mono font-bold">R$ ${pos.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="text-right">
                          <div class="percent-bar-wrapper">
                            <span class="percent-text">${pct.toFixed(1)}%</span>
                            <div class="percent-bar-bg">
                              <div class="percent-bar-fill" style="width: ${Math.min(100, pct)}%"></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    // Render Column Chart for Assets
    const assetItems: ColumnChartItem[] = summary.allocationByAsset.map((a, idx) => {
      const colors = [
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#ec4899',
        '#06b6d4',
        '#f97316',
        '#14b8a6',
        '#6366f1',
        '#a855f7',
      ];
      return {
        label: a.ticker,
        value: a.totalCost,
        percentage: a.percentage,
        color: colors[idx % colors.length],
      };
    });

    const assetChartContainer = this.container.querySelector('#portfolio-chart-by-asset');
    if (assetChartContainer) {
      assetChartContainer.appendChild(ColumnChart.render(assetItems, 560, 260));
    }

    // Render Donut Chart for Categories
    const typeSlices: SliceData[] = summary.allocationByType.map((t) => ({
      label: t.label,
      value: t.totalCost,
      percentage: t.percentage,
    }));

    const typeChartContainer = this.container.querySelector('#portfolio-chart-by-type');
    if (typeChartContainer) {
      typeChartContainer.appendChild(AllocationChart.render(typeSlices, 240));
    }
  }
}
