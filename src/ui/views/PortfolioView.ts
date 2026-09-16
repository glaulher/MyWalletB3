import { DashboardSummary } from '../../core/controllers/DashboardController.ts';
import { ConsolidatedPosition } from '../../core/entities/ConsolidatedPosition.ts';
import { AllocationChart, SliceData } from '../components/AllocationChart.ts';
import { ColumnChart, ColumnChartItem } from '../components/ColumnChart.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Icons } from '../components/Icons.ts';

export type PortfolioCategoryKey = 'all' | 'fii' | 'fi-infra' | 'stock' | 'bdr' | 'option';

interface CategoryConfig {
  key: PortfolioCategoryKey;
  label: string;
  badgeLabel: string;
  icon: string;
  color: string;
  matches: (pos: ConsolidatedPosition) => boolean;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'fii',
    label: 'Fundos Imobiliários (FII)',
    badgeLabel: 'FII',
    icon: Icons.building(18),
    color: '#f59e0b',
    matches: (pos) => pos.type === 'fii',
  },
  {
    key: 'fi-infra',
    label: 'FIIs de Infraestrutura (FI-Infra)',
    badgeLabel: 'FI-Infra',
    icon: Icons.landmark(18),
    color: '#10b981',
    matches: (pos) => pos.type === 'fi-infra',
  },
  {
    key: 'stock',
    label: 'Ações & Units',
    badgeLabel: 'Ação',
    icon: Icons.trendingUp(18),
    color: '#3b82f6',
    matches: (pos) => pos.type === 'stock' || pos.type === 'unit',
  },
  {
    key: 'bdr',
    label: 'BDRs (Ativos Globais)',
    badgeLabel: 'BDR',
    icon: Icons.star(18),
    color: '#a855f7',
    matches: (pos) => pos.type === 'bdr',
  },
  {
    key: 'option',
    label: 'Opções & Derivativos',
    badgeLabel: 'Opção',
    icon: Icons.tag(18),
    color: '#06b6d4',
    matches: (pos) => pos.type === 'option',
  },
];

export class PortfolioView {
  private container: HTMLElement;
  private selectedCategory: PortfolioCategoryKey = 'all';
  private lastSummary: DashboardSummary | null = null;
  // Set of category keys currently expanded (starts empty so all are collapsed by default)
  private expandedCategories: Set<string> = new Set();

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(summary: DashboardSummary): void {
    this.lastSummary = summary;

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

    // Calculate sub-totals for each category
    const categoryStats = CATEGORY_CONFIGS.map((cfg) => {
      const positions = summary.positions.filter(cfg.matches);
      const totalCost = positions.reduce((acc, p) => acc + p.totalCost, 0);
      const percentage = summary.totalInvested > 0 ? (totalCost / summary.totalInvested) * 100 : 0;
      return {
        ...cfg,
        positions,
        totalCost,
        percentage,
        count: positions.length,
      };
    }).filter((cat) => cat.count > 0);

    this.container.innerHTML = `
      <div class="view-content">
        <!-- KPI Cards -->
        <section class="kpi-grid">
          ${KpiCard.generateHtml({
            title: 'Patrimônio Total',
            icon: Icons.wallet(18),
            value: `R$ ${summary.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Custo total em custódia',
          })}
          ${KpiCard.generateHtml({
            title: 'Total de Ativos',
            icon: Icons.building(18),
            value: String(summary.totalAssets),
            subtext: `${categoryStats.length} classe(s) de ativos`,
          })}
          ${KpiCard.generateHtml({
            title: 'Operações',
            icon: Icons.refresh(18),
            value: String(summary.totalOperations),
            subtext: 'Registros no banco local',
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
                <p class="card-subtitle">Distribuição de custo por código de negociação (role horizontalmente para navegar entre os ativos)</p>
              </div>
            </div>
            <div id="portfolio-chart-by-asset" class="chart-wrapper"></div>
          </div>

          <div class="card chart-card">
            <div class="card-header-flex">
              <div>
                <h3 class="card-title">Alocação por Categoria</h3>
                <p class="card-subtitle">FII, FII de Infra, Ações, Opções e BDRs</p>
              </div>
            </div>
            <div id="portfolio-chart-by-type" class="chart-wrapper"></div>
          </div>
        </section>

        <!-- Seção Dividida por Categoria (Colapsável) -->
        <section class="portfolio-divided-section">
          <div class="card-header-flex" style="margin-bottom: 8px;">
            <div>
              <h3 class="card-title" style="font-size: 18px;">Carteira por Categoria</h3>
              <p class="card-subtitle">Clique no cabeçalho de cada categoria para expandir ou recolher seus ativos</p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <!-- Botões de Ação Rápida de Expansão -->
              <div class="btn-group">
                <button type="button" class="btn-filter" id="btn-expand-all" title="Expandir todas as categorias">
                  Expandir Todas
                </button>
                <button type="button" class="btn-filter" id="btn-collapse-all" title="Recolher todas as categorias">
                  Recolher Todas
                </button>
              </div>

              <!-- Filtro de Categoria -->
              <div class="btn-group" id="portfolio-category-filter">
                <button type="button" class="btn-filter ${this.selectedCategory === 'all' ? 'selected' : ''}" data-category="all">
                  Todas (${summary.positions.length})
                </button>
                ${categoryStats
                  .map(
                    (cat) => `
                  <button type="button" class="btn-filter ${this.selectedCategory === cat.key ? 'selected' : ''}" data-category="${cat.key}">
                    ${cat.icon} ${cat.badgeLabel} (${cat.count})
                  </button>
                `,
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <!-- Cards de Grupos de Categorias Colapsáveis -->
          <div id="category-groups-container">
            ${this.renderCategoryGroups(categoryStats, summary.totalInvested)}
          </div>
        </section>
      </div>
    `;

    // Render Charts
    this.renderCharts(summary, categoryStats);
    this.bindEvents(categoryStats);
  }

  private renderCategoryGroups(
    categories: Array<
      CategoryConfig & {
        positions: ConsolidatedPosition[];
        totalCost: number;
        percentage: number;
        count: number;
      }
    >,
    totalInvested: number,
  ): string {
    const visibleCategories =
      this.selectedCategory === 'all'
        ? categories
        : categories.filter((c) => c.key === this.selectedCategory);

    if (visibleCategories.length === 0) {
      return `<div class="card"><p class="text-muted text-center" style="padding: 24px;">Nenhum ativo encontrado nesta classe.</p></div>`;
    }

    return visibleCategories
      .map((cat) => {
        const isExpanded = this.expandedCategories.has(cat.key);

        return `
        <div class="category-group-card card ${isExpanded ? 'is-expanded' : ''}" data-cat-id="${cat.key}">
          <!-- Cabeçalho Clicável do Accordion -->
          <div class="category-header-clickable" data-toggle-cat="${cat.key}" role="button" tabindex="0" aria-expanded="${isExpanded ? 'true' : 'false'}" title="Clique para ${isExpanded ? 'recolher' : 'expandir'} ${cat.label}">
            <div class="category-title-wrap">
              <div class="category-icon-box" style="color: ${cat.color};">
                ${cat.icon}
              </div>
              <div>
                <h4 class="category-name">${cat.label}</h4>
                <p class="category-meta">${cat.count} ativo(s) em custódia</p>
              </div>
            </div>
            <div class="category-header-right">
              <div class="category-subtotal-wrap">
                <span class="category-subtotal-value">R$ ${cat.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span class="category-subtotal-pct">${cat.percentage.toFixed(1)}% da carteira</span>
              </div>
              <div class="category-chevron">
                ${Icons.chevronDown(16)}
              </div>
            </div>
          </div>

          <!-- Conteúdo da Tabela (Exibido quando aberto) -->
          <div class="category-body">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Classe</th>
                    <th class="text-right">Quantidade</th>
                    <th class="text-right">Preço Médio</th>
                    <th class="text-right">Custo Total</th>
                    <th class="text-right">% na Classe</th>
                    <th class="text-right">% na Carteira</th>
                  </tr>
                </thead>
                <tbody>
                  ${cat.positions
                    .map((pos) => {
                      const pctCategory =
                        cat.totalCost > 0 ? (pos.totalCost / cat.totalCost) * 100 : 0;
                      const pctWallet =
                        totalInvested > 0 ? (pos.totalCost / totalInvested) * 100 : 0;

                      let typeLabel = 'Ação';
                      let badgeVariant: 'stock' | 'fii' | 'fi-infra' | 'bdr' | 'unit' | 'option' =
                        'stock';

                      if (pos.type === 'fi-infra') {
                        typeLabel = 'FI-Infra';
                        badgeVariant = 'fi-infra';
                      } else if (pos.type === 'fii') {
                        typeLabel = 'FII';
                        badgeVariant = 'fii';
                      } else if (pos.type === 'bdr') {
                        typeLabel = 'BDR';
                        badgeVariant = 'bdr';
                      } else if (pos.type === 'unit') {
                        typeLabel = 'Unit';
                        badgeVariant = 'unit';
                      } else if (pos.type === 'option') {
                        typeLabel = 'Opção';
                        badgeVariant = 'option';
                      }

                      return `
                        <tr>
                          <td class="font-bold font-mono">${pos.ticker}</td>
                          <td>${Badge.generateHtml({ label: typeLabel, variant: badgeVariant })}</td>
                          <td class="text-right font-mono">${pos.quantity.toLocaleString('pt-BR')}</td>
                          <td class="text-right font-mono">R$ ${pos.averagePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                          <td class="text-right font-mono font-bold">R$ ${pos.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td class="text-right font-mono text-muted">${pctCategory.toFixed(1)}%</td>
                          <td class="text-right">
                            <div class="percent-bar-wrapper">
                              <span class="percent-text">${pctWallet.toFixed(1)}%</span>
                              <div class="percent-bar-bg">
                                <div class="percent-bar-fill" style="width: ${Math.min(100, pctWallet)}%; background: ${cat.color};"></div>
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
          </div>
        </div>
      `;
      })
      .join('');
  }

  private renderCharts(
    summary: DashboardSummary,
    categoryStats: Array<
      CategoryConfig & {
        positions: ConsolidatedPosition[];
        totalCost: number;
        percentage: number;
      }
    >,
  ): void {
    // 1. Column Chart by Asset
    const assetColors = [
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

    const assetItems: ColumnChartItem[] = summary.allocationByAsset.map((a, idx) => ({
      label: a.ticker,
      value: a.totalCost,
      percentage: a.percentage,
      color: assetColors[idx % assetColors.length],
    }));

    const assetChartContainer = this.container.querySelector('#portfolio-chart-by-asset');
    if (assetChartContainer) {
      assetChartContainer.appendChild(ColumnChart.render(assetItems, 560, 260, 68));
    }

    // 2. Donut Chart by Category (FII, FI-Infra, Ações, BDR, Opções)
    const typeSlices: SliceData[] = categoryStats.map((cat) => ({
      label: cat.label,
      value: cat.totalCost,
      percentage: cat.percentage,
      color: cat.color,
    }));

    const typeChartContainer = this.container.querySelector('#portfolio-chart-by-type');
    if (typeChartContainer) {
      typeChartContainer.appendChild(AllocationChart.render(typeSlices, 240));
    }
  }

  private bindEvents(
    categoryStats: Array<
      CategoryConfig & {
        positions: ConsolidatedPosition[];
        totalCost: number;
        percentage: number;
      }
    >,
  ): void {
    // 1. Category Filter Pills
    const filterButtons = this.container.querySelectorAll<HTMLButtonElement>(
      '#portfolio-category-filter .btn-filter',
    );

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const catKey = btn.dataset.category as PortfolioCategoryKey;
        if (catKey && catKey !== this.selectedCategory && this.lastSummary) {
          this.selectedCategory = catKey;
          // If a specific category was clicked, expand it automatically so user sees its items
          if (catKey !== 'all') {
            this.expandedCategories.add(catKey);
          }
          this.render(this.lastSummary);
        }
      });
    });

    // 2. Click-to-toggle accordion headers
    const clickableHeaders = this.container.querySelectorAll<HTMLElement>(
      '.category-header-clickable',
    );

    clickableHeaders.forEach((header) => {
      const toggle = () => {
        const catKey = header.dataset.toggleCat;
        if (!catKey) return;

        const card = header.closest('.category-group-card');
        if (!card) return;

        if (this.expandedCategories.has(catKey)) {
          this.expandedCategories.delete(catKey);
          card.classList.remove('is-expanded');
          header.setAttribute('aria-expanded', 'false');
          header.setAttribute('title', `Clique para expandir`);
        } else {
          this.expandedCategories.add(catKey);
          card.classList.add('is-expanded');
          header.setAttribute('aria-expanded', 'true');
          header.setAttribute('title', `Clique para recolher`);
        }
      };

      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });

    // 3. Expand All / Collapse All buttons
    const btnExpandAll = this.container.querySelector<HTMLButtonElement>('#btn-expand-all');
    const btnCollapseAll = this.container.querySelector<HTMLButtonElement>('#btn-collapse-all');

    btnExpandAll?.addEventListener('click', () => {
      categoryStats.forEach((cat) => this.expandedCategories.add(cat.key));
      this.container.querySelectorAll('.category-group-card').forEach((card) => {
        card.classList.add('is-expanded');
        card.querySelector('.category-header-clickable')?.setAttribute('aria-expanded', 'true');
      });
    });

    btnCollapseAll?.addEventListener('click', () => {
      this.expandedCategories.clear();
      this.container.querySelectorAll('.category-group-card').forEach((card) => {
        card.classList.remove('is-expanded');
        card.querySelector('.category-header-clickable')?.setAttribute('aria-expanded', 'false');
      });
    });
  }
}
