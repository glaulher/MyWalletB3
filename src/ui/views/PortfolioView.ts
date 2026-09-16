import { DashboardSummary } from '../../core/controllers/DashboardController.ts';
import { ConsolidatedPosition } from '../../core/entities/ConsolidatedPosition.ts';
import { AllocationChart, SliceData } from '../components/AllocationChart.ts';
import { ColumnChart, ColumnChartItem } from '../components/ColumnChart.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Icons } from '../components/Icons.ts';
import {
  MarketQuoteService,
  MarketQuote,
  PositionMarketResult,
} from '../../core/services/MarketQuoteService.ts';

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
  private expandedCategories: Set<string> = new Set();
  private quoteService = new MarketQuoteService();
  private quotes: Record<string, MarketQuote> = {};
  private isUpdatingQuotes = false;
  private lastFetchTime: Date | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(summary: DashboardSummary): void {
    this.lastSummary = summary;
    this.quotes = this.quoteService.getCachedQuotes();

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

    // Calculate market position results for each asset
    const resultMap = new Map<string, PositionMarketResult>();
    let totalMarketValue = 0;
    let hasAnyQuote = false;

    summary.positions.forEach((pos) => {
      const quote = this.quotes[pos.ticker];
      const res = MarketQuoteService.calculatePositionResult(pos, quote);
      resultMap.set(pos.ticker, res);
      totalMarketValue += res.marketValue;
      if (res.hasQuote) hasAnyQuote = true;
    });

    const totalProfitLoss = hasAnyQuote ? totalMarketValue - summary.totalInvested : 0;
    const totalProfitLossPct =
      summary.totalInvested > 0 ? (totalProfitLoss / summary.totalInvested) * 100 : 0;
    const quotesCount = Object.keys(this.quotes).length;

    const topPosition = summary.positions.length > 0 ? summary.positions[0] : null;

    // Calculate sub-totals for each category (using market value if available, else cost)
    const categoryStats = CATEGORY_CONFIGS.map((cfg) => {
      const positions = summary.positions.filter(cfg.matches);
      const totalCost = positions.reduce((acc, p) => acc + p.totalCost, 0);
      const totalCatMarket = positions.reduce((acc, p) => {
        const res = resultMap.get(p.ticker);
        return acc + (res?.hasQuote ? res.marketValue : p.totalCost);
      }, 0);
      const percentage = summary.totalInvested > 0 ? (totalCost / summary.totalInvested) * 100 : 0;
      return {
        ...cfg,
        positions,
        totalCost,
        totalCatMarket,
        percentage,
        count: positions.length,
      };
    }).filter((cat) => cat.count > 0);

    const isProfit = totalProfitLoss >= 0;
    const profitClass = isProfit ? 'profit-val' : 'loss-val';
    const profitSign = isProfit ? '+' : '';

    this.container.innerHTML = `
      <div class="view-content">
        <!-- Quotes Action Bar -->
        <div class="quotes-action-bar">
          <div class="quotes-status-info">
            <span class="quotes-status-dot ${this.isUpdatingQuotes ? 'updating' : hasAnyQuote ? 'online' : 'offline'}"></span>
            <span>
              ${
                this.isUpdatingQuotes
                  ? '<strong>Buscando cotações em tempo real na B3 via Yahoo Finance...</strong>'
                  : hasAnyQuote
                    ? `Cotações ativas (${quotesCount} ativos) • Atualizado ${this.lastFetchTime ? `às ${this.lastFetchTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'via Yahoo Finance / Cache'}`
                    : 'Cotações em tempo real não carregadas. Clique em "Atualizar Cotações" para sincronizar com a B3.'
              }
            </span>
          </div>
          <div class="quotes-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-quotes" ${this.isUpdatingQuotes ? 'disabled' : ''} title="Consultar cotações atualizadas na B3">
              <span class="${this.isUpdatingQuotes ? 'spin-animation' : ''}">${Icons.refresh(14)}</span>
              ${this.isUpdatingQuotes ? 'Atualizando...' : 'Atualizar Cotações'}
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <section class="kpi-grid">
          ${KpiCard.generateHtml({
            title: hasAnyQuote ? 'Patrimônio Atual (Mercado)' : 'Patrimônio Total (Custo)',
            icon: Icons.wallet(18),
            value: `R$ ${(hasAnyQuote ? totalMarketValue : summary.totalInvested).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: hasAnyQuote
              ? `Custo investido: R$ ${summary.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'Custo total em custódia',
          })}
          ${KpiCard.generateHtml({
            title: 'Resultado da Carteira',
            icon: Icons.trendingUp(18),
            value: hasAnyQuote
              ? `<span class="${profitClass}">${profitSign}R$ ${totalProfitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`
              : '-',
            subtext: hasAnyQuote
              ? `<span class="${profitClass}" style="font-weight: 600;">${profitSign}${totalProfitLossPct.toFixed(2)}% de retorno</span>`
              : 'Clique em "Atualizar Cotações"',
          })}
          ${KpiCard.generateHtml({
            title: 'Total de Ativos',
            icon: Icons.building(18),
            value: String(summary.totalAssets),
            subtext: `${categoryStats.length} classe(s) • ${quotesCount} cotações`,
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
                <h3 class="card-title">Alocação por Ativo ${hasAnyQuote ? '(Custo vs. Valor Atual)' : ''}</h3>
                <p class="card-subtitle">
                  ${
                    hasAnyQuote
                      ? 'Comparativo entre Custo Investido e Valor de Mercado Atual (role horizontalmente para navegar)'
                      : 'Distribuição de custo por código de negociação (role horizontalmente para navegar)'
                  }
                </p>
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
            ${this.renderCategoryGroups(categoryStats, summary.totalInvested, resultMap)}
          </div>
        </section>
      </div>
    `;

    // Render Charts
    this.renderCharts(summary, categoryStats, resultMap);
    this.bindEvents(categoryStats, summary);
  }

  private renderCategoryGroups(
    categories: Array<
      CategoryConfig & {
        positions: ConsolidatedPosition[];
        totalCost: number;
        totalCatMarket: number;
        percentage: number;
        count: number;
      }
    >,
    totalInvested: number,
    resultMap: Map<string, PositionMarketResult>,
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
                    <th class="text-right">Total Investido</th>
                    <th class="text-right">Cotação Atual</th>
                    <th class="text-right">Valor Atual</th>
                    <th class="text-right">Resultado</th>
                    <th class="text-right">% Carteira</th>
                  </tr>
                </thead>
                <tbody>
                  ${cat.positions
                    .map((pos) => {
                      const res = resultMap.get(pos.ticker);
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

                      // Quote display
                      let quoteHtml = `<span class="text-muted" style="font-size: 11px;">-</span>`;
                      let marketValueHtml = `<span class="text-muted font-mono" style="font-size: 12px;">R$ ${pos.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;
                      let resultHtml = `<span class="text-muted font-mono" style="font-size: 11px;">-</span>`;

                      if (res && res.hasQuote) {
                        const q = res.quote;
                        const changePct = q ? q.changePercent : 0;
                        const isChangePositive = changePct > 0;
                        const isChangeNegative = changePct < 0;
                        const pillClass = isChangePositive
                          ? 'positive'
                          : isChangeNegative
                            ? 'negative'
                            : 'neutral';
                        const changeSign = isChangePositive ? '+' : '';

                        quoteHtml = `
                          <div class="quote-cell-wrap">
                            <span class="font-mono font-bold">R$ ${res.marketPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span class="quote-variation-pill ${pillClass}">
                              ${changeSign}${changePct.toFixed(1)}%
                            </span>
                            <button type="button" class="btn-icon-subtle btn-manual-quote" data-ticker="${pos.ticker}" data-current="${res.marketPrice}" title="Ajustar cotação manualmente">
                              ${Icons.edit(12)}
                            </button>
                          </div>
                        `;

                        marketValueHtml = `
                          <span class="font-mono font-bold">
                            R$ ${res.marketValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        `;

                        const isProfitPos = res.profitLoss >= 0;
                        const posProfitClass = isProfitPos ? 'profit-val' : 'loss-val';
                        const posProfitSign = isProfitPos ? '+' : '';

                        resultHtml = `
                          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                            <span class="font-mono ${posProfitClass}">
                              ${posProfitSign}R$ ${res.profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span style="font-size: 10px; font-weight: 600;" class="${posProfitClass}">
                              ${posProfitSign}${res.profitLossPercent.toFixed(2)}%
                            </span>
                          </div>
                        `;
                      } else {
                        // Quick manual edit button even without quote
                        quoteHtml = `
                          <div class="quote-cell-wrap">
                            <span class="text-muted" style="font-size: 11px;">Sem cotação</span>
                            <button type="button" class="btn-icon-subtle btn-manual-quote" data-ticker="${pos.ticker}" data-current="${pos.averagePrice}" title="Inserir cotação manual">
                              ${Icons.edit(12)}
                            </button>
                          </div>
                        `;
                      }

                      return `
                        <tr>
                          <td class="font-bold font-mono">${pos.ticker}</td>
                          <td>${Badge.generateHtml({ label: typeLabel, variant: badgeVariant })}</td>
                          <td class="text-right font-mono">${pos.quantity.toLocaleString('pt-BR')}</td>
                          <td class="text-right font-mono">R$ ${pos.averagePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                          <td class="text-right font-mono font-bold">R$ ${pos.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td class="text-right">${quoteHtml}</td>
                          <td class="text-right">${marketValueHtml}</td>
                          <td class="text-right">${resultHtml}</td>
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
    resultMap: Map<string, PositionMarketResult>,
  ): void {
    // 1. Column Chart by Asset (Comparing Cost vs Market Value)
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

    const assetItems: ColumnChartItem[] = summary.allocationByAsset.map((a, idx) => {
      const res = resultMap.get(a.ticker);
      return {
        label: a.ticker,
        value: a.totalCost,
        compareValue: res && res.hasQuote ? res.marketValue : undefined,
        percentage: a.percentage,
        color: assetColors[idx % assetColors.length],
      };
    });

    const assetChartContainer = this.container.querySelector('#portfolio-chart-by-asset');
    if (assetChartContainer) {
      assetChartContainer.appendChild(ColumnChart.render(assetItems, 560, 270, 88));
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
    summary: DashboardSummary,
  ): void {
    // 1. Refresh Quotes Button
    const btnRefreshQuotes = this.container.querySelector<HTMLButtonElement>('#btn-refresh-quotes');
    btnRefreshQuotes?.addEventListener('click', async () => {
      if (this.isUpdatingQuotes) return;

      this.isUpdatingQuotes = true;
      this.render(summary);

      try {
        const tickers = summary.positions.map((p) => p.ticker);
        await this.quoteService.fetchQuotes(tickers);
        this.quotes = this.quoteService.getCachedQuotes();
        this.lastFetchTime = new Date();
      } catch (err) {
        console.error('Failed to update market quotes:', err);
      } finally {
        this.isUpdatingQuotes = false;
        this.render(summary);
      }
    });

    // 2. Manual Quote Edit buttons
    const manualButtons = this.container.querySelectorAll<HTMLButtonElement>('.btn-manual-quote');
    manualButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = btn.dataset.ticker;
        const current = btn.dataset.current || '0';
        if (!ticker) return;

        const input = window.prompt(
          `Definir cotação manual para ${ticker} em R$ (ex: 34.50):`,
          Number(current).toFixed(2),
        );

        if (input !== null) {
          const parsedPrice = parseFloat(input.replace(',', '.').trim());
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            this.quoteService.saveManualQuote(ticker, parsedPrice);
            this.quotes = this.quoteService.getCachedQuotes();
            this.render(summary);
          } else {
            window.alert('Por favor, informe um valor numérico válido maior que zero.');
          }
        }
      });
    });

    // 3. Category Filter Pills
    const filterButtons = this.container.querySelectorAll<HTMLButtonElement>(
      '#portfolio-category-filter .btn-filter',
    );

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const catKey = btn.dataset.category as PortfolioCategoryKey;
        if (catKey && catKey !== this.selectedCategory && this.lastSummary) {
          this.selectedCategory = catKey;
          if (catKey !== 'all') {
            this.expandedCategories.add(catKey);
          }
          this.render(this.lastSummary);
        }
      });
    });

    // 4. Click-to-toggle accordion headers
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

    // 5. Expand All / Collapse All buttons
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
