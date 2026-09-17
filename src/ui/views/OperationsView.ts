import { Operation } from '../../core/entities/Operation.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { AveragePriceCalculator } from '../../core/services/AveragePriceCalculator.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Icons } from '../components/Icons.ts';
import { escapeHtml } from '../utils/sanitize.ts';

export class OperationsView {
  private container: HTMLElement;
  private operationRepo: IOperationRepository;
  private calculator = new AveragePriceCalculator();
  private filterTicker = '';
  private filterType = 'all';
  private currentPage = 1;
  private pageSize = 50;

  constructor(
    container: HTMLElement,
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
  ) {
    this.container = container;
    this.operationRepo = operationRepo;
  }

  async render(): Promise<void> {
    const rawOps = await this.operationRepo.getAll();
    const sortedOps = this.calculator.sortOperations(rawOps);

    // Apply filters
    const filteredOps = sortedOps.filter((op) => {
      const matchTicker = this.filterTicker
        ? op.asset.toUpperCase().includes(this.filterTicker.toUpperCase())
        : true;
      const matchType =
        this.filterType === 'all'
          ? true
          : this.filterType === 'buy'
            ? op.type === 'buy'
            : op.type === 'sell';
      return matchTicker && matchType;
    });

    const totalPages = Math.ceil(filteredOps.length / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const pagedOps = filteredOps.slice(startIndex, startIndex + this.pageSize);

    const totalBuyValue = filteredOps
      .filter((o) => o.type === 'buy')
      .reduce((acc, o) => acc + o.quantity * o.unitPrice + o.fees, 0);

    const totalSellValue = filteredOps
      .filter((o) => o.type === 'sell')
      .reduce((acc, o) => acc + o.quantity * o.unitPrice - o.fees, 0);

    this.container.innerHTML = `
      <div class="view-content">
        <div class="view-header">
          <div>
            <h2 class="view-title">${Icons.fileText(22)} Extrato de Operações</h2>
            <p class="view-subtitle">Histórico ordenado por Tipo (Compra antes de Venda) e Data do Negócio (mais antigo para mais novo).</p>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          ${KpiCard.generateHtml({
            title: 'Volume de Compras',
            icon: Icons.arrowUpRight(18, 'text-success'),
            value: `R$ ${totalBuyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: `${filteredOps.filter((o) => o.type === 'buy').length} ordens de compra`,
          })}
          ${KpiCard.generateHtml({
            title: 'Volume de Vendas',
            icon: Icons.arrowDownRight(18, 'text-danger'),
            value: `R$ ${totalSellValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: `${filteredOps.filter((o) => o.type === 'sell').length} ordens de venda`,
          })}
          ${KpiCard.generateHtml({
            title: 'Operações Filtradas',
            icon: Icons.search(18),
            value: String(filteredOps.length),
            subtext: `de ${sortedOps.length} registros no total`,
          })}
        </div>

        <!-- Filtros e Tabela -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Registros Importados</h3>
              <p class="card-subtitle">Filtre por ticker ou tipo de operação</p>
            </div>
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <input type="text" id="filter-ticker" placeholder="Filtrar Ticker (ex: CPTI11)..."
                     class="text-input" value="${escapeHtml(this.filterTicker)}" style="padding: 6px 12px; font-size: 13px;" />
              <div class="btn-group" id="filter-type-group">
                <button type="button" class="btn-filter ${this.filterType === 'all' ? 'selected' : ''}" data-type="all">Todas</button>
                <button type="button" class="btn-filter ${this.filterType === 'buy' ? 'selected' : ''}" data-type="buy">Compras</button>
                <button type="button" class="btn-filter ${this.filterType === 'sell' ? 'selected' : ''}" data-type="sell">Vendas</button>
              </div>
            </div>
          </div>

          ${
            filteredOps.length === 0
              ? `<div class="chart-empty" style="padding: 32px;">Nenhuma operação encontrada com os filtros selecionados.</div>`
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
                    <th class="text-right">Valor Total</th>
                    <th>Instituição</th>
                  </tr>
                </thead>
                <tbody>
                  ${pagedOps
                    .map((op: Operation) => {
                      const dateFormatted = `${String(op.date.getDate()).padStart(2, '0')}/${String(op.date.getMonth() + 1).padStart(2, '0')}/${op.date.getFullYear()}`;
                      const isBuy = op.type === 'buy';
                      const totalVal = op.quantity * op.unitPrice + (isBuy ? op.fees : -op.fees);

                      return `
                      <tr>
                        <td class="font-mono">${escapeHtml(dateFormatted)}</td>
                        <td>${Badge.generateHtml({ label: isBuy ? 'Compra' : 'Venda', variant: isBuy ? 'buy' : 'sell' })}</td>
                        <td class="font-bold">${escapeHtml(op.asset)}</td>
                        <td class="text-right font-mono">${op.quantity.toLocaleString('pt-BR')}</td>
                        <td class="text-right font-mono">R$ ${op.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="text-right font-mono text-muted">R$ ${op.fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right font-mono font-bold">R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="text-muted">${escapeHtml(op.institution || '-')}</td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>

            ${
              totalPages > 1
                ? `
              <div class="pagination-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px;">
                <span style="font-size: 13px; color: var(--text-muted);">
                  Mostrando <strong>${startIndex + 1}</strong> a <strong>${Math.min(startIndex + this.pageSize, filteredOps.length)}</strong> de <strong>${filteredOps.length}</strong> operações
                </span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-prev-page" ${this.currentPage === 1 ? 'disabled' : ''}>
                    ${Icons.arrowLeft(14)} Anterior
                  </button>
                  <span style="font-size: 13px; font-weight: 600; padding: 0 8px; color: var(--text-main);">
                    Página ${this.currentPage} de ${totalPages}
                  </span>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-next-page" ${this.currentPage >= totalPages ? 'disabled' : ''}>
                    Próxima ${Icons.arrowRight(14)}
                  </button>
                </div>
              </div>
            `
                : ''
            }
          `
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const inputTicker = this.container.querySelector('#filter-ticker') as HTMLInputElement;
    const filterButtons = this.container.querySelectorAll<HTMLButtonElement>(
      '#filter-type-group .btn-filter',
    );
    const btnPrev = this.container.querySelector('#btn-prev-page') as HTMLButtonElement | null;
    const btnNext = this.container.querySelector('#btn-next-page') as HTMLButtonElement | null;

    inputTicker?.addEventListener('input', () => {
      this.filterTicker = inputTicker.value;
      this.currentPage = 1;
      this.render();
    });

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (type && type !== this.filterType) {
          this.filterType = type;
          this.currentPage = 1;
          this.render();
        }
      });
    });

    btnPrev?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.render();
      }
    });

    btnNext?.addEventListener('click', () => {
      this.currentPage++;
      this.render();
    });
  }
}
