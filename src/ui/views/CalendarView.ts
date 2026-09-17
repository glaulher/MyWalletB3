import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import {
  CalendarTradeCalculator,
  CalendarCalculationResult,
} from '../../core/services/CalendarTradeCalculator.ts';
import { Icons } from '../components/Icons.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Badge } from '../components/Badge.ts';
import { escapeHtml } from '../utils/sanitize.ts';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export class CalendarView {
  private container: HTMLElement;
  private operationRepo: IOperationRepository;
  private calculator = new CalendarTradeCalculator();

  private currentYear: number = new Date().getFullYear();
  private currentMonth: number = new Date().getMonth(); // 0-11
  private selectedDayKey: string | null = null;
  private scopeMode: 'month' | 'year' = 'month';

  private calcResult: CalendarCalculationResult | null = null;

  constructor(
    container: HTMLElement,
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
  ) {
    this.container = container;
    this.operationRepo = operationRepo;
  }

  async render(): Promise<void> {
    const rawOps = await this.operationRepo.getAll();

    if (rawOps.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${Icons.calendar(36)}</div>
          <h2>Nenhuma operação registrada</h2>
          <p>Importe uma planilha da B3 (.xlsx ou .csv) para visualizar o calendário financeiro de compras e vendas.</p>
        </div>
      `;
      return;
    }

    this.calcResult = this.calculator.calculate(rawOps);
    const availableYears = this.calcResult.getAvailableYears();

    // Default to the most recent operation year and month if not yet set
    const allOps = this.calcResult.getAllEnrichedOperations();
    if (allOps.length > 0 && !availableYears.includes(this.currentYear)) {
      const latestOp = allOps[allOps.length - 1];
      this.currentYear = latestOp.date.getFullYear();
      this.currentMonth = latestOp.date.getMonth();
    } else if (allOps.length > 0 && this.scopeMode === 'month' && this.selectedDayKey === null) {
      // Find latest op month in current year if any
      const opsInYear = allOps.filter((o) => o.date.getFullYear() === this.currentYear);
      if (opsInYear.length > 0) {
        const latestInYear = opsInYear[opsInYear.length - 1];
        // If current month has no ops, jump to the month that does
        const hasOpsInCurMonth = opsInYear.some((o) => o.date.getMonth() === this.currentMonth);
        if (!hasOpsInCurMonth) {
          this.currentMonth = latestInYear.date.getMonth();
        }
      }
    }

    this.renderView();
  }

  private renderView(): void {
    if (!this.calcResult) return;

    const availableYears = this.calcResult.getAvailableYears();
    const monthSummary = this.calcResult.getMonthSummary(this.currentYear, this.currentMonth);
    const yearSummary = this.calcResult.getYearSummary(this.currentYear);

    // Active KPI metrics based on selection
    let kpiTitleSuffix = `${MONTH_NAMES[this.currentMonth]} de ${this.currentYear}`;
    let displayBought = monthSummary.totalBought;
    let displaySold = monthSummary.totalSold;
    let displayProfit = monthSummary.realizedProfit;
    let displayOpsCount = monthSummary.operationsCount;
    let displayBoughtQty = monthSummary.boughtQty;
    let displaySoldQty = monthSummary.soldQty;

    if (this.selectedDayKey) {
      const dayData = this.calcResult.getDaySummary(this.selectedDayKey);
      if (dayData) {
        const [y, m, d] = this.selectedDayKey.split('-');
        kpiTitleSuffix = `Dia ${d}/${m}/${y}`;
        displayBought = dayData.totalBought;
        displaySold = dayData.totalSold;
        displayProfit = dayData.realizedProfit;
        displayOpsCount = dayData.operations.length;
        displayBoughtQty = dayData.boughtQty;
        displaySoldQty = dayData.soldQty;
      }
    } else if (this.scopeMode === 'year') {
      kpiTitleSuffix = `Ano ${this.currentYear}`;
      displayBought = yearSummary.totalBought;
      displaySold = yearSummary.totalSold;
      displayProfit = yearSummary.realizedProfit;
      displayOpsCount = yearSummary.operationsCount;
      displayBoughtQty = yearSummary.boughtQty;
      displaySoldQty = yearSummary.soldQty;
    }

    const profitSign = displayProfit > 0 ? '+' : '';
    const profitCardClass =
      displayProfit > 0.001 ? 'profit-card' : displayProfit < -0.001 ? 'loss-card' : '';

    this.container.innerHTML = `
      <div class="view-content">
        <!-- Calendar Header Control Bar -->
        <div class="calendar-header-card">
          <div class="calendar-toolbar">
            <!-- Left: Navigation Controls -->
            <div class="calendar-nav-group">
              <button id="cal-btn-prev" class="btn btn-secondary btn-icon" title="Mês Anterior">
                ${Icons.chevronLeft(16)}
              </button>

              <select id="cal-select-month" class="calendar-select" aria-label="Mês">
                ${MONTH_NAMES.map(
                  (name, idx) =>
                    `<option value="${idx}" ${idx === this.currentMonth ? 'selected' : ''}>${name}</option>`,
                ).join('')}
              </select>

              <select id="cal-select-year" class="calendar-select" aria-label="Ano">
                ${availableYears
                  .map(
                    (yr) =>
                      `<option value="${yr}" ${yr === this.currentYear ? 'selected' : ''}>${yr}</option>`,
                  )
                  .join('')}
              </select>

              <button id="cal-btn-next" class="btn btn-secondary btn-icon" title="Próximo Mês">
                ${Icons.chevronRight(16)}
              </button>

              <button id="cal-btn-today" class="btn btn-secondary" style="font-size: 13px; padding: 7px 12px;">
                Mês Atual
              </button>
            </div>

            <!-- Right: Scope Toggles & Active Filter -->
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              ${
                this.selectedDayKey
                  ? `
                <div class="calendar-active-filter">
                  <span>${Icons.calendar(14)}</span>
                  <span>Filtro: <strong>Dia ${this.selectedDayKey.split('-').reverse().join('/')}</strong></span>
                  <button id="cal-btn-clear-day" class="calendar-clear-btn" title="Limpar filtro de dia">
                    ✕
                  </button>
                </div>
              `
                  : ''
              }

              <div class="calendar-scope-tabs">
                <button id="cal-scope-month" class="calendar-scope-btn ${this.scopeMode === 'month' && !this.selectedDayKey ? 'active' : ''}">
                  Mês (${MONTH_NAMES[this.currentMonth].substring(0, 3)})
                </button>
                <button id="cal-scope-year" class="calendar-scope-btn ${this.scopeMode === 'year' && !this.selectedDayKey ? 'active' : ''}">
                  Ano (${this.currentYear})
                </button>
              </div>
            </div>
          </div>

          <!-- Dynamic KPI Cards for the Filtered Period -->
          <div class="kpi-grid" style="margin-bottom: 0;">
            ${KpiCard.generateHtml({
              title: `Total Comprado (${kpiTitleSuffix})`,
              value: `R$ ${displayBought.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              subtext: `${displayBoughtQty.toLocaleString('pt-BR')} cotas/ações compradas`,
              icon: Icons.upload(18),
            })}

            ${KpiCard.generateHtml({
              title: `Total Vendido (${kpiTitleSuffix})`,
              value: `R$ ${displaySold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              subtext: `${displaySoldQty.toLocaleString('pt-BR')} cotas/ações vendidas`,
              icon: Icons.download(18),
            })}

            ${KpiCard.generateHtml({
              title: `Resultado Líquido Realizado (${kpiTitleSuffix})`,
              value: `${profitSign}R$ ${displayProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              subtext:
                displayProfit > 0
                  ? 'Lucro líquido realizado nas vendas'
                  : displayProfit < 0
                    ? 'Prejuízo líquido realizado nas vendas (Vermelho)'
                    : 'Sem vendas com ganho/perda',
              icon: displayProfit >= 0 ? Icons.trendingUp(18) : Icons.trendingDown(18),
              className: profitCardClass,
            })}

            ${KpiCard.generateHtml({
              title: `Total de Operações (${kpiTitleSuffix})`,
              value: `${displayOpsCount}`,
              subtext: 'Transações registradas no período',
              icon: Icons.refresh(18),
            })}
          </div>
        </div>

        <!-- Weekday Headers -->
        <div class="calendar-weekdays">
          ${WEEKDAY_NAMES.map(
            (day, idx) => `
            <div class="calendar-weekday ${idx === 0 || idx === 6 ? 'weekend' : ''}">${day}</div>
          `,
          ).join('')}
        </div>

        <!-- 7-Column Calendar Monthly Grid -->
        <div id="calendar-month-grid" class="calendar-grid">
          ${this.buildMonthGridHtml()}
        </div>

        <!-- Legend (Google Colors) -->
        <div class="cal-legend">
          <span style="font-weight: 600; color: var(--text-main);">Cores do Calendário:</span>
          <div class="cal-legend-item">
            <span class="cal-legend-color loss"></span>
            <span>Venda com Prejuízo (Quadrado Vermelho)</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-color profit"></span>
            <span>Venda com Lucro (Verde Google)</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-color buy"></span>
            <span>Apenas Compras (Azul Google)</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-color neutral"></span>
            <span>Sem Operações</span>
          </div>
        </div>

        <!-- Day Detail Panel (Visible when a day is selected) -->
        <div id="calendar-day-detail-area">
          ${this.buildDayDetailHtml()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private buildMonthGridHtml(): string {
    if (!this.calcResult) return '';

    const year = this.currentYear;
    const month = this.currentMonth;

    // First day of current month (0: Sunday, 1: Monday, ..., 6: Saturday)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Number of days in current month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    // Number of days in previous month
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const todayKey = CalendarTradeCalculator.toDateKey(today);

    const cellsHtml: string[] = [];

    // 1. Padding cells from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, prevDay);
      const dateKey = CalendarTradeCalculator.toDateKey(prevDate);
      cellsHtml.push(`
        <div class="cal-day-cell other-month" data-date="${dateKey}">
          <div class="cal-day-top">
            <span class="cal-day-number">${prevDay}</span>
          </div>
        </div>
      `);
    }

    // 2. Days of the current month
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const dateKey = CalendarTradeCalculator.toDateKey(cellDate);
      const daySummary = this.calcResult.getDaySummary(dateKey);

      const isToday = dateKey === todayKey;
      const isSelected = dateKey === this.selectedDayKey;

      // Status classes
      // MANDATORY RULE: If negative sales result, square is RED (.cal-day-loss)
      let statusClass = '';
      let badgeHtml = '';

      if (daySummary && daySummary.operations.length > 0) {
        if (daySummary.status === 'loss') {
          statusClass = 'cal-day-loss';
          badgeHtml = `<span class="cal-day-badge cal-badge-loss" title="Prejuízo líquido de R$ ${Math.abs(daySummary.realizedProfit).toFixed(2)}">-R$ ${Math.abs(daySummary.realizedProfit).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>`;
        } else if (daySummary.status === 'profit') {
          statusClass = 'cal-day-profit';
          badgeHtml = `<span class="cal-day-badge cal-badge-profit" title="Lucro líquido de R$ ${daySummary.realizedProfit.toFixed(2)}">+R$ ${daySummary.realizedProfit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>`;
        } else if (daySummary.status === 'buy-only') {
          statusClass = 'cal-day-buy';
          badgeHtml = `<span class="cal-day-badge cal-badge-buy" title="Compras totais de R$ ${daySummary.totalBought.toFixed(2)}">R$ ${daySummary.totalBought.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>`;
        }
      }

      // Build chips inside cell (up to 2 operations + "+N mais")
      let chipsHtml = '';
      if (daySummary && daySummary.operations.length > 0) {
        const ops = daySummary.operations;
        const visibleOps = ops.slice(0, 2);
        const remaining = ops.length - visibleOps.length;

        const chips = visibleOps.map((op) => {
          if (op.type === 'buy') {
            return `
              <div class="cal-chip cal-chip-buy" title="Compra: ${op.quantity}x ${op.asset} a R$ ${op.unitPrice.toFixed(2)} (Total R$ ${op.totalValue.toFixed(2)})">
                <span>🛒 ${escapeHtml(op.asset)}</span>
                <span class="font-mono">${op.quantity}</span>
              </div>
            `;
          } else {
            const isLoss = op.realizedProfit < 0;
            const chipClass = isLoss ? 'cal-chip-sell-loss' : 'cal-chip-sell-profit';
            const icon = isLoss ? '⚠️' : '💰';
            const sign = op.realizedProfit >= 0 ? '+' : '';
            return `
              <div class="cal-chip ${chipClass}" title="Venda: ${op.quantity}x ${op.asset} a R$ ${op.unitPrice.toFixed(2)} | Resultado: ${sign}R$ ${op.realizedProfit.toFixed(2)}">
                <span>${icon} ${escapeHtml(op.asset)}</span>
                <span class="font-mono">${sign}${Math.round(op.realizedProfit)}</span>
              </div>
            `;
          }
        });

        if (remaining > 0) {
          chips.push(`<div class="cal-chip-more">+${remaining} mais</div>`);
        }

        chipsHtml = `<div class="cal-chips-container">${chips.join('')}</div>`;
      }

      cellsHtml.push(`
        <div class="cal-day-cell ${statusClass} ${isToday ? 'is-today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateKey}">
          <div class="cal-day-top">
            <span class="cal-day-number">${day}</span>
            ${badgeHtml}
          </div>
          ${chipsHtml}
        </div>
      `);
    }

    // 3. Padding cells for next month to complete row of 7
    const totalRendered = cellsHtml.length;
    const remainingInGrid = totalRendered % 7 === 0 ? 0 : 7 - (totalRendered % 7);
    for (let nextDay = 1; nextDay <= remainingInGrid; nextDay++) {
      const nextDate = new Date(year, month + 1, nextDay);
      const dateKey = CalendarTradeCalculator.toDateKey(nextDate);
      cellsHtml.push(`
        <div class="cal-day-cell other-month" data-date="${dateKey}">
          <div class="cal-day-top">
            <span class="cal-day-number">${nextDay}</span>
          </div>
        </div>
      `);
    }

    return cellsHtml.join('');
  }

  private buildDayDetailHtml(): string {
    if (!this.selectedDayKey || !this.calcResult) {
      return '';
    }

    const dayData = this.calcResult.getDaySummary(this.selectedDayKey);
    const [y, m, d] = this.selectedDayKey.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    if (!dayData || dayData.operations.length === 0) {
      return `
        <div class="cal-detail-card">
          <div class="cal-detail-header">
            <div class="cal-detail-title-group">
              <span style="color: #38bdf8;">${Icons.calendar(20)}</span>
              <h3 class="cal-detail-title">Operações em ${formattedDate}</h3>
            </div>
            <button id="cal-btn-close-detail" class="btn btn-secondary btn-icon" title="Fechar">✕</button>
          </div>
          <p class="text-muted">Nenhuma compra ou venda registrada nesta data.</p>
        </div>
      `;
    }

    const profitSign = dayData.realizedProfit > 0 ? '+' : '';

    return `
      <div class="cal-detail-card">
        <div class="cal-detail-header">
          <div class="cal-detail-title-group">
            <span style="color: #38bdf8;">${Icons.calendar(22)}</span>
            <div>
              <h3 class="cal-detail-title">Operações em ${formattedDate}</h3>
              <p class="text-muted" style="font-size: 13px;">${dayData.operations.length} operação(ões) registrada(s) no dia</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="cal-detail-summary-chips">
              ${
                dayData.totalBought > 0
                  ? `<span class="badge badge-info font-mono">Compras: R$ ${dayData.totalBought.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`
                  : ''
              }
              ${
                dayData.totalSold > 0
                  ? `<span class="badge badge-neutral font-mono">Vendas: R$ ${dayData.totalSold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`
                  : ''
              }
              ${
                dayData.hasSell
                  ? `<span class="badge ${dayData.hasLoss ? 'badge-danger' : 'badge-success'} font-mono">Resultado: ${profitSign}R$ ${dayData.realizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`
                  : ''
              }
            </div>
            <button id="cal-btn-close-detail" class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;">
              ✕ Voltar ao Mês
            </button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ativo</th>
                <th class="text-right">Quantidade</th>
                <th class="text-right">Preço Unitário</th>
                <th class="text-right">Taxas</th>
                <th class="text-right">Valor Total Líquido</th>
                <th class="text-right">PM na Venda</th>
                <th class="text-right">Resultado Realizado</th>
              </tr>
            </thead>
            <tbody>
              ${dayData.operations
                .map((op) => {
                  const isBuy = op.type === 'buy';
                  const typeBadge = isBuy
                    ? Badge.generateHtml({ label: 'COMPRA', variant: 'buy' })
                    : Badge.generateHtml({ label: 'VENDA', variant: 'sell' });

                  const opProfitSign = op.realizedProfit > 0 ? '+' : '';
                  const opProfitClass =
                    op.realizedProfit > 0.001
                      ? 'profit-val'
                      : op.realizedProfit < -0.001
                        ? 'loss-val'
                        : 'neutral-val';

                  return `
                  <tr>
                    <td>${typeBadge}</td>
                    <td>
                      <span class="font-bold text-main">${escapeHtml(op.asset)}</span>
                    </td>
                    <td class="text-right font-mono">${op.quantity.toLocaleString('pt-BR')}</td>
                    <td class="text-right font-mono">R$ ${op.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="text-right font-mono text-muted">R$ ${op.fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td class="text-right font-mono font-bold">R$ ${op.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="text-right font-mono text-muted">
                      ${!isBuy && op.avgPriceBefore > 0 ? `R$ ${op.avgPriceBefore.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}
                    </td>
                    <td class="text-right font-mono ${opProfitClass}">
                      ${!isBuy ? `${opProfitSign}R$ ${op.realizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Month navigation buttons
    const btnPrev = this.container.querySelector('#cal-btn-prev');
    const btnNext = this.container.querySelector('#cal-btn-next');
    const btnToday = this.container.querySelector('#cal-btn-today');
    const selectMonth = this.container.querySelector('#cal-select-month') as HTMLSelectElement;
    const selectYear = this.container.querySelector('#cal-select-year') as HTMLSelectElement;

    btnPrev?.addEventListener('click', () => {
      if (this.currentMonth === 0) {
        this.currentMonth = 11;
        this.currentYear--;
      } else {
        this.currentMonth--;
      }
      this.selectedDayKey = null;
      this.renderView();
    });

    btnNext?.addEventListener('click', () => {
      if (this.currentMonth === 11) {
        this.currentMonth = 0;
        this.currentYear++;
      } else {
        this.currentMonth++;
      }
      this.selectedDayKey = null;
      this.renderView();
    });

    btnToday?.addEventListener('click', () => {
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth();
      this.selectedDayKey = null;
      this.scopeMode = 'month';
      this.renderView();
    });

    selectMonth?.addEventListener('change', () => {
      this.currentMonth = parseInt(selectMonth.value, 10);
      this.selectedDayKey = null;
      this.renderView();
    });

    selectYear?.addEventListener('change', () => {
      this.currentYear = parseInt(selectYear.value, 10);
      this.selectedDayKey = null;
      this.renderView();
    });

    // Scope buttons
    const btnScopeMonth = this.container.querySelector('#cal-scope-month');
    const btnScopeYear = this.container.querySelector('#cal-scope-year');
    const btnClearDay = this.container.querySelector('#cal-btn-clear-day');
    const btnCloseDetail = this.container.querySelector('#cal-btn-close-detail');

    btnScopeMonth?.addEventListener('click', () => {
      this.scopeMode = 'month';
      this.selectedDayKey = null;
      this.renderView();
    });

    btnScopeYear?.addEventListener('click', () => {
      this.scopeMode = 'year';
      this.selectedDayKey = null;
      this.renderView();
    });

    const clearSelection = () => {
      this.selectedDayKey = null;
      this.renderView();
    };

    btnClearDay?.addEventListener('click', clearSelection);
    btnCloseDetail?.addEventListener('click', clearSelection);

    // Day cell click handlers
    const dayCells = this.container.querySelectorAll('.cal-day-cell:not(.other-month)');
    dayCells.forEach((cell) => {
      cell.addEventListener('click', () => {
        const dateKey = cell.getAttribute('data-date');
        if (!dateKey) return;

        if (this.selectedDayKey === dateKey) {
          // Toggle off
          this.selectedDayKey = null;
        } else {
          this.selectedDayKey = dateKey;
          this.scopeMode = 'month';
        }
        this.renderView();

        // Scroll smoothly to detail if opened
        if (this.selectedDayKey) {
          const detailEl = this.container.querySelector('#calendar-day-detail-area');
          detailEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }
}
