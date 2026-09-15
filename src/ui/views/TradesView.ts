import { Operation } from '../../core/entities/Operation.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import {
  TradeSummaryCalculator,
  AssetTradeSummary,
} from '../../core/services/TradeSummaryCalculator.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Icons } from '../components/Icons.ts';

export class TradesView {
  private container: HTMLElement;
  private operationRepo: IOperationRepository;
  private calculator = new TradeSummaryCalculator();

  private filterTicker = '';
  private filterCategory = 'all';
  private filterTradeType = 'all'; // 'all' | 'buy' | 'sell'

  constructor(
    container: HTMLElement,
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
  ) {
    this.container = container;
    this.operationRepo = operationRepo;
  }

  async render(): Promise<void> {
    const rawOps = await this.operationRepo.getAll();
    const summaries = this.calculator.calculate(rawOps);

    if (rawOps.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${Icons.refresh(36)}</div>
          <h2>Nenhuma compra ou venda registrada</h2>
          <p>Importe uma planilha da B3 (.xlsx ou .csv) para visualizar o consolidado de compras, vendas e preço médio.</p>
        </div>
      `;
      return;
    }

    // Global KPIs
    const totalBoughtValue = summaries.reduce((acc, s) => acc + s.totalBoughtValue, 0);
    const totalBoughtQty = summaries.reduce((acc, s) => acc + s.totalBoughtQty, 0);
    const totalSoldValue = summaries.reduce((acc, s) => acc + s.totalSoldValue, 0);
    const totalSoldQty = summaries.reduce((acc, s) => acc + s.totalSoldQty, 0);
    const totalRealizedProfit = summaries.reduce((acc, s) => acc + s.realizedProfit, 0);

    // Filtered summaries
    const filteredSummaries = summaries.filter((s) => {
      const matchTicker = this.filterTicker
        ? s.ticker.toUpperCase().includes(this.filterTicker.toUpperCase())
        : true;
      const matchCat =
        this.filterCategory === 'all'
          ? true
          : this.filterCategory === 'stock'
            ? s.type === 'stock' || s.type === 'unit'
            : s.type === this.filterCategory;
      return matchTicker && matchCat;
    });

    // Filtered individual operations
    const filteredOps = rawOps
      .filter((op) => {
        const matchTicker = this.filterTicker
          ? op.asset.toUpperCase().includes(this.filterTicker.toUpperCase())
          : true;
        const matchType =
          this.filterTradeType === 'all'
            ? true
            : this.filterTradeType === 'buy'
              ? op.type === 'buy'
              : op.type === 'sell';
        return matchTicker && matchType;
      })
      .sort((a, b) => {
        // Buys before sells, then date ascending
        if (a.type !== b.type) return a.type === 'buy' ? -1 : 1;
        return a.date.getTime() - b.date.getTime();
      });

    this.container.innerHTML = `
      <div class="view-content">
        <div class="view-header">
          <div>
            <h2 class="view-title">${Icons.refresh(22)} Compras e Vendas</h2>
            <p class="view-subtitle">Consolidado por ativo: quantidades compradas, quantidades vendidas, preço médio e extrato detalhado.</p>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          ${KpiCard.generateHtml({
            title: 'Volume de Compras',
            icon: Icons.arrowUpRight(18, 'text-success'),
            value: `R$ ${totalBoughtValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: `${totalBoughtQty.toLocaleString('pt-BR')} cotas/ações compradas`,
          })}
          ${KpiCard.generateHtml({
            title: 'Volume de Vendas',
            icon: Icons.arrowDownRight(18, 'text-danger'),
            value: `R$ ${totalSoldValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: `${totalSoldQty.toLocaleString('pt-BR')} cotas/ações vendidas`,
          })}
          ${KpiCard.generateHtml({
            title: 'Resultado Realizado',
            icon:
              totalRealizedProfit >= 0
                ? Icons.trendingUp(18, 'text-success')
                : Icons.trendingDown(18, 'text-danger'),
            value: `R$ ${totalRealizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: totalRealizedProfit >= 0 ? 'Lucro líquido em vendas' : 'Prejuízo acumulado',
          })}
          ${KpiCard.generateHtml({
            title: 'Ativos Negociados',
            icon: Icons.building(18),
            value: String(summaries.length),
            subtext: `${summaries.filter((s) => s.currentQty > 0).length} atualmente em custódia`,
          })}
        </div>

        <!-- Tabela Resumo Consolidado de Compras e Vendas -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Resumo de Compras vs Vendas por Ativo</h3>
              <p class="card-subtitle">Quantidades compradas/vendidas, preços médios e saldo atual</p>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <input type="text" id="trades-filter-ticker" placeholder="Buscar Ticker (ex: CPTI11)..."
                     class="text-input" value="${this.filterTicker}" style="padding: 6px 12px; font-size: 13px;" />
              <div class="btn-group" id="trades-category-group">
                <button type="button" class="btn-filter ${this.filterCategory === 'all' ? 'selected' : ''}" data-cat="all">Todas</button>
                <button type="button" class="btn-filter ${this.filterCategory === 'fii' ? 'selected' : ''}" data-cat="fii">FII</button>
                <button type="button" class="btn-filter ${this.filterCategory === 'fi-infra' ? 'selected' : ''}" data-cat="fi-infra">FII de Infra</button>
                <button type="button" class="btn-filter ${this.filterCategory === 'stock' ? 'selected' : ''}" data-cat="stock">Ações</button>
                <button type="button" class="btn-filter ${this.filterCategory === 'bdr' ? 'selected' : ''}" data-cat="bdr">BDR</button>
                <button type="button" class="btn-filter ${this.filterCategory === 'option' ? 'selected' : ''}" data-cat="option">Opções</button>
              </div>
            </div>
          </div>

          ${
            filteredSummaries.length === 0
              ? `<div class="chart-empty" style="padding: 32px;">Nenhum ativo encontrado com os filtros selecionados.</div>`
              : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ativo</th>
                    <th>Classe</th>
                    <th class="text-right" style="color: #34d399;">Qtd Comprada</th>
                    <th class="text-right" style="color: #34d399;">PM Compra</th>
                    <th class="text-right" style="color: #34d399;">Total Comprado</th>
                    <th class="text-right" style="color: #f87171;">Qtd Vendida</th>
                    <th class="text-right" style="color: #f87171;">PM Venda</th>
                    <th class="text-right" style="color: #f87171;">Total Vendido</th>
                    <th class="text-right" style="color: #38bdf8;">Saldo Custódia</th>
                    <th class="text-right" style="color: #38bdf8;">PM Atual</th>
                    <th class="text-right">Lucro Realizado</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredSummaries
                    .map((s: AssetTradeSummary) => {
                      let typeLabel = 'Ação';
                      let badgeVariant: 'stock' | 'fii' | 'fi-infra' | 'bdr' | 'unit' | 'option' =
                        'stock';

                      if (s.type === 'fi-infra') {
                        typeLabel = 'FI-Infra';
                        badgeVariant = 'fi-infra';
                      } else if (s.type === 'fii') {
                        typeLabel = 'FII';
                        badgeVariant = 'fii';
                      } else if (s.type === 'bdr') {
                        typeLabel = 'BDR';
                        badgeVariant = 'bdr';
                      } else if (s.type === 'unit') {
                        typeLabel = 'Unit';
                        badgeVariant = 'unit';
                      } else if (s.type === 'option') {
                        typeLabel = 'Opção';
                        badgeVariant = 'option';
                      }

                      const profitClass =
                        s.realizedProfit > 0
                          ? 'profit-positive'
                          : s.realizedProfit < 0
                            ? 'profit-negative'
                            : 'profit-neutral';

                      return `
                        <tr>
                          <td class="font-bold font-mono">${s.ticker}</td>
                          <td>${Badge.generateHtml({ label: typeLabel, variant: badgeVariant })}</td>
                          <td class="text-right font-mono font-bold" style="color: #34d399;">${s.totalBoughtQty.toLocaleString('pt-BR')}</td>
                          <td class="text-right font-mono">R$ ${s.avgBuyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                          <td class="text-right font-mono">R$ ${s.totalBoughtValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td class="text-right font-mono font-bold" style="color: #f87171;">${s.totalSoldQty.toLocaleString('pt-BR')}</td>
                          <td class="text-right font-mono">${s.totalSoldQty > 0 ? `R$ ${s.avgSellPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '-'}</td>
                          <td class="text-right font-mono">${s.totalSoldQty > 0 ? `R$ ${s.totalSoldValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                          <td class="text-right font-mono font-bold" style="color: #38bdf8;">${s.currentQty.toLocaleString('pt-BR')}</td>
                          <td class="text-right font-mono font-bold" style="color: #38bdf8;">${s.currentQty > 0 ? `R$ ${s.currentAvgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '-'}</td>
                          <td class="text-right font-mono ${profitClass}">${s.totalSoldQty > 0 ? `R$ ${s.realizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
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

        <!-- Tabela com Todas as Operações (Compras e Vendas) -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Extrato Detalhado de Operações</h3>
              <p class="card-subtitle">Todas as movimentações ordenadas por Compra antes de Venda e data ascendente</p>
            </div>
            <div class="btn-group" id="trades-type-filter-group">
              <button type="button" class="btn-filter ${this.filterTradeType === 'all' ? 'selected' : ''}" data-tradetype="all">Todas (${rawOps.length})</button>
              <button type="button" class="btn-filter ${this.filterTradeType === 'buy' ? 'selected' : ''}" data-tradetype="buy">Apenas Compras</button>
              <button type="button" class="btn-filter ${this.filterTradeType === 'sell' ? 'selected' : ''}" data-tradetype="sell">Apenas Vendas</button>
            </div>
          </div>

          ${
            filteredOps.length === 0
              ? `<div class="chart-empty" style="padding: 24px;">Nenhuma operação encontrada com os filtros atuais.</div>`
              : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Ativo</th>
                    <th class="text-right">Quantidade</th>
                    <th class="text-right">Preço Unitário</th>
                    <th class="text-right">Taxas</th>
                    <th class="text-right">Valor Total Líquido</th>
                    <th>Instituição</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredOps
                    .map((op: Operation) => {
                      const dateFormatted = `${String(op.date.getDate()).padStart(2, '0')}/${String(op.date.getMonth() + 1).padStart(2, '0')}/${op.date.getFullYear()}`;
                      const isBuy = op.type === 'buy';
                      const totalVal = op.quantity * op.unitPrice + (isBuy ? op.fees : -op.fees);

                      return `
                        <tr>
                          <td class="font-mono">${dateFormatted}</td>
                          <td>${Badge.generateHtml({ label: isBuy ? 'Compra' : 'Venda', variant: isBuy ? 'buy' : 'sell' })}</td>
                          <td class="font-bold font-mono">${op.asset}</td>
                          <td class="text-right font-mono">${op.quantity.toLocaleString('pt-BR')}</td>
                          <td class="text-right font-mono">R$ ${op.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td class="text-right font-mono text-muted">R$ ${op.fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td class="text-right font-mono font-bold">R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td class="text-muted">${op.institution || '-'}</td>
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

    this.bindEvents();
  }

  private bindEvents(): void {
    const inputTicker = this.container.querySelector('#trades-filter-ticker') as HTMLInputElement;
    const catButtons = this.container.querySelectorAll<HTMLButtonElement>(
      '#trades-category-group .btn-filter',
    );
    const typeButtons = this.container.querySelectorAll<HTMLButtonElement>(
      '#trades-type-filter-group .btn-filter',
    );

    inputTicker?.addEventListener('input', () => {
      this.filterTicker = inputTicker.value;
      this.render();
    });

    catButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        if (cat && cat !== this.filterCategory) {
          this.filterCategory = cat;
          this.render();
        }
      });
    });

    typeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tType = btn.dataset.tradetype;
        if (tType && tType !== this.filterTradeType) {
          this.filterTradeType = tType;
          this.render();
        }
      });
    });
  }
}
