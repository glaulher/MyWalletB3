import { Movement } from '../../core/entities/Movement.ts';
import { IMovementRepository } from '../../core/repositories/IMovementRepository.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { PersistentMovementRepository } from '../../infrastructure/repositories/PersistentMovementRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { AveragePriceCalculator } from '../../core/services/AveragePriceCalculator.ts';
import { IncomeCalculator } from '../../core/services/IncomeCalculator.ts';
import { B3MovementParser } from '../../core/services/B3MovementParser.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Icons } from '../components/Icons.ts';
import { ColumnChart } from '../components/ColumnChart.ts';
import { AllocationChart } from '../components/AllocationChart.ts';
import { escapeHtml } from '../utils/sanitize.ts';
import { DashboardController } from '../../core/controllers/DashboardController.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';

export class IncomesView {
  private container: HTMLElement;
  private movementRepo: IMovementRepository;
  private operationRepo: IOperationRepository;
  private onRefresh?: () => Promise<void>;
  private controller?: DashboardController;
  private incomeCalculator = new IncomeCalculator();
  private avgCalculator = new AveragePriceCalculator();
  private parser = new B3MovementParser();

  private filterTicker = '';
  private filterCategory: string = 'all'; // 'all' | 'yield' | 'dividend' | 'jcp' | 'other'
  private filterYear: string = 'all';
  private currentPage = 1;
  private pageSize = 50;

  constructor(
    container: HTMLElement,
    onRefresh?: () => Promise<void>,
    movementRepo: IMovementRepository = new PersistentMovementRepository(),
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
    controller?: DashboardController,
  ) {
    this.container = container;
    this.onRefresh = onRefresh;
    this.movementRepo = movementRepo;
    this.operationRepo = operationRepo;
    this.controller = controller;
  }

  async render(): Promise<void> {
    const [allMovements, operations] = await Promise.all([
      this.movementRepo.getAll(),
      this.operationRepo.getAll(),
    ]);

    const sortedOps = this.avgCalculator.sortOperations(operations);
    const positions = this.avgCalculator.calculate(sortedOps);
    const metrics = this.incomeCalculator.calculateMetrics(allMovements, positions);

    if (allMovements.length === 0) {
      this.container.innerHTML = `
        <div class="view-content">
          <div class="view-header">
            <div>
              <h2 class="view-title">${Icons.coins(22)} Proventos & Rendimentos</h2>
              <p class="view-subtitle">Gestão de dividendos, JCP e rendimentos de FIIs/FI-Infra com histórico e Yield on Cost.</p>
            </div>
          </div>

          <div class="empty-state" style="margin-top: 32px;">
            <div class="empty-state-icon">${Icons.coins(36)}</div>
            <h2>Nenhuma movimentação ou provento importado</h2>
            <p>Faça o upload do arquivo <strong>movimentacao-*.xlsx</strong> exportado do Portal do Investidor da B3 para acompanhar seus proventos recebidos, gráficos mensais e Yield on Cost.</p>
            <div style="margin-top: 20px;">
              <button id="btn-cta-upload" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
                ${Icons.upload(16)} Carregar Movimentações B3 (.xlsx/.csv)
              </button>
              <input type="file" id="file-input-mov-empty" accept=".xlsx,.xls,.csv" multiple style="display: none;" />
            </div>
          </div>
        </div>
      `;

      this.bindEmptyEvents();
      return;
    }

    // Available years from movements
    const years = Array.from(
      new Set(allMovements.filter((m) => m.isIncome).map((m) => m.date.getFullYear())),
    ).sort((a, b) => b - a);

    // Apply filters for detailed transaction table
    const filteredMovements = allMovements
      .filter((m) => {
        if (!m.isIncome && this.filterCategory !== 'all' && this.filterCategory !== 'other') {
          return false;
        }

        const matchTicker = this.filterTicker
          ? m.asset.toUpperCase().includes(this.filterTicker.toUpperCase()) ||
            m.rawProduct.toUpperCase().includes(this.filterTicker.toUpperCase())
          : true;

        const matchCategory =
          this.filterCategory === 'all'
            ? true
            : this.filterCategory === 'other'
              ? !m.isIncome
              : m.category === this.filterCategory;

        const matchYear =
          this.filterYear === 'all' ? true : m.date.getFullYear() === parseInt(this.filterYear, 10);

        return matchTicker && matchCategory && matchYear;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const totalPages = Math.ceil(filteredMovements.length / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const pagedMovements = filteredMovements.slice(startIndex, startIndex + this.pageSize);

    // Generate monthly chart items
    const chartItems = metrics.monthlyEvolution.map((m) => ({
      label: m.label,
      value: m.totalValue,
      color: '#10b981',
    }));

    // Generate donut slices
    const donutSlices = metrics.categoryAllocation.map((c) => ({
      label: c.label,
      value: c.value,
      percentage: c.percentage,
      color: c.color,
    }));

    this.container.innerHTML = `
      <div class="view-content">
        <div class="view-header">
          <div>
            <h2 class="view-title">${Icons.coins(22)} Proventos & Rendimentos</h2>
            <p class="view-subtitle">Histórico consolidado de proventos recebidos, evolução mês a mês e análise de Yield on Cost.</p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button id="btn-import-mov" class="btn btn-secondary" style="display: flex; align-items: center; gap: 8px;">
              ${Icons.upload(16)} Importar Movimentações B3 (.xlsx/.csv)
            </button>
            <input type="file" id="file-input-mov" accept=".xlsx,.xls,.csv" multiple style="display: none;" />
          </div>
        </div>

        <!-- Status message banner -->
        <div id="incomes-status" style="margin-bottom: 16px;"></div>

        <!-- KPI Cards Grid -->
        <div class="kpi-grid">
          ${KpiCard.generateHtml({
            title: 'Total em Proventos',
            icon: Icons.coins(18, 'text-success'),
            value: `R$ ${metrics.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: `${allMovements.filter((m) => m.isIncome).length} pagamentos creditados`,
          })}
          ${KpiCard.generateHtml({
            title: 'Rendimentos de FIIs',
            icon: Icons.building(18, 'text-primary'),
            value: `R$ ${metrics.totalYields.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Isentos de Imposto de Renda',
          })}
          ${KpiCard.generateHtml({
            title: 'Dividendos de Ações',
            icon: Icons.trendingUp(18, 'text-primary'),
            value: `R$ ${metrics.totalDividends.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Isentos de Imposto de Renda',
          })}
          ${KpiCard.generateHtml({
            title: 'Juros Sobre Cap. Próprio',
            icon: Icons.calculator(18, 'text-warning'),
            value: `R$ ${metrics.totalJcp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtext: 'Tributação Exclusiva (retido fonte)',
          })}
          ${KpiCard.generateHtml({
            title: 'Média Mensal Ativa',
            icon: Icons.calendar(18),
            value: `R$ ${metrics.averageMonthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês`,
            subtext: `calculada sobre ${metrics.activeMonthsCount} meses com proventos`,
          })}
        </div>

        <!-- Charts Grid -->
        <div class="dashboard-grid" style="margin-top: 24px;">
          <!-- Evolução Mensal SVG -->
          <div class="card" style="display: flex; flex-direction: column;">
            <div class="card-header-flex">
              <div>
                <h3 class="card-title">Evolução Mensal de Proventos</h3>
                <p class="card-subtitle">Volume líquido de proventos creditados mês a mês (R$)</p>
              </div>
            </div>
            <div style="flex: 1; min-height: 280px; overflow-x: auto; padding-top: 8px;">
              ${ColumnChart.generateSvg(chartItems, 520, 270, 48)}
            </div>
          </div>

          <!-- Distribuição por Categoria Donut -->
          <div class="card" style="display: flex; flex-direction: column;">
            <div class="card-header-flex">
              <div>
                <h3 class="card-title">Composição por Categoria</h3>
                <p class="card-subtitle">Distribuição entre Rendimentos, Dividendos e JCP</p>
              </div>
            </div>
            <div id="category-donut-container" style="display: flex; justify-content: center; align-items: center; flex: 1; padding: 12px 0;"></div>
          </div>
        </div>

        <!-- Ranking de Ativos Pagadores -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Ranking de Proventos por Ativo</h3>
              <p class="card-subtitle">Relação de ativos que mais geraram renda passiva e Yield on Cost (YoC)</p>
            </div>
            <span class="badge badge-info">${metrics.assetSummaries.length} ativos pagadores</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th>Tipo</th>
                  <th style="text-align: right;">Total Recebido</th>
                  <th style="text-align: right;">Rendimentos</th>
                  <th style="text-align: right;">Dividendos</th>
                  <th style="text-align: right;">JCP</th>
                  <th style="text-align: right;">Custódia Atual</th>
                  <th style="text-align: right;">Custo Investido</th>
                  <th style="text-align: right;">Yield on Cost (YoC)</th>
                  <th style="text-align: center;">Nº Pagamentos</th>
                </tr>
              </thead>
              <tbody>
                ${
                  metrics.assetSummaries.length === 0
                    ? `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum ativo pagador identificado</td></tr>`
                    : metrics.assetSummaries
                        .map((a) => {
                          const yocBadge =
                            a.yieldOnCost > 0
                              ? `<span class="badge ${a.yieldOnCost >= 10 ? 'badge-success' : 'badge-info'}" style="font-weight: 600;">
                                  ${a.yieldOnCost.toFixed(2)}%
                                </span>`
                              : `<span style="color: var(--text-muted); font-size: 12px;">—</span>`;

                          return `
                      <tr>
                        <td style="font-weight: 600; font-family: ui-monospace, monospace;">${escapeHtml(a.ticker)}</td>
                        <td>${Badge.generateHtml({ label: a.assetType.toUpperCase(), variant: a.assetType })}</td>
                        <td style="text-align: right; font-weight: 700; color: #10b981;">
                          R$ ${a.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style="text-align: right; color: var(--text-muted);">
                          ${a.yieldValue > 0 ? `R$ ${a.yieldValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style="text-align: right; color: var(--text-muted);">
                          ${a.dividendValue > 0 ? `R$ ${a.dividendValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style="text-align: right; color: var(--text-muted);">
                          ${a.jcpValue > 0 ? `R$ ${a.jcpValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style="text-align: right;">${a.currentQuantity.toLocaleString('pt-BR')}</td>
                        <td style="text-align: right;">
                          ${a.currentTotalCost > 0 ? `R$ ${a.currentTotalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style="text-align: right;">${yocBadge}</td>
                        <td style="text-align: center;">${a.paymentCount}</td>
                      </tr>
                    `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tabela Detalhada com Filtros e Paginação -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Extrato Detalhado de Lançamentos</h3>
              <p class="card-subtitle">Registros individuais importados da B3</p>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <input type="text" id="filter-income-ticker" placeholder="Buscar por ticker ou produto..."
                     class="text-input" value="${escapeHtml(this.filterTicker)}" style="padding: 6px 12px; font-size: 13px;" />

              <select id="filter-income-category" class="select-input" style="padding: 6px 36px 6px 12px; font-size: 13px; min-height: 34px;">
                <option value="all" ${this.filterCategory === 'all' ? 'selected' : ''}>Todas as Categorias</option>
                <option value="yield" ${this.filterCategory === 'yield' ? 'selected' : ''}>Rendimentos (FIIs)</option>
                <option value="dividend" ${this.filterCategory === 'dividend' ? 'selected' : ''}>Dividendos (Ações)</option>
                <option value="jcp" ${this.filterCategory === 'jcp' ? 'selected' : ''}>Juros Sobre Cap. Próprio (JCP)</option>
                <option value="other" ${this.filterCategory === 'other' ? 'selected' : ''}>Outras Movimentações</option>
              </select>

              <select id="filter-income-year" class="select-input" style="padding: 6px 36px 6px 12px; font-size: 13px; min-height: 34px;">
                <option value="all" ${this.filterYear === 'all' ? 'selected' : ''}>Todos os Anos</option>
                ${years.map((y) => `<option value="${escapeHtml(y)}" ${this.filterYear === String(y) ? 'selected' : ''}>${escapeHtml(y)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ativo</th>
                  <th>Produto / Descrição B3</th>
                  <th>Tipo na B3</th>
                  <th>Categoria</th>
                  <th>Instituição</th>
                  <th style="text-align: right;">Quantidade</th>
                  <th style="text-align: right;">Valor Unitário</th>
                  <th style="text-align: right;">Valor Líquido</th>
                </tr>
              </thead>
              <tbody>
                ${
                  pagedMovements.length === 0
                    ? `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum registro encontrado para os filtros selecionados</td></tr>`
                    : pagedMovements
                        .map((m) => {
                          const dateStr = m.date.toLocaleDateString('pt-BR');
                          const catBadge =
                            m.category === 'yield'
                              ? `<span class="badge badge-success">Rendimento</span>`
                              : m.category === 'dividend'
                                ? `<span class="badge badge-info">Dividendo</span>`
                                : m.category === 'jcp'
                                  ? `<span class="badge badge-warning">JCP</span>`
                                  : `<span class="badge badge-secondary">${escapeHtml(m.category)}</span>`;

                          const valueColor =
                            m.direction === 'credit'
                              ? 'color: #10b981; font-weight: 600;'
                              : 'color: #ef4444;';
                          const sign = m.direction === 'debit' ? '-' : '';

                          return `
                      <tr>
                        <td>${escapeHtml(dateStr)}</td>
                        <td style="font-weight: 600; font-family: ui-monospace, monospace;">${escapeHtml(m.asset)}</td>
                        <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(m.rawProduct)}">
                          ${escapeHtml(m.rawProduct)}
                        </td>
                        <td><span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(m.movementType)}</span></td>
                        <td>${catBadge}</td>
                        <td style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(m.institution || '—')}</td>
                        <td style="text-align: right;">${m.quantity > 0 ? m.quantity.toLocaleString('pt-BR') : '—'}</td>
                        <td style="text-align: right;">
                          ${m.unitPrice > 0 ? `R$ ${m.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}
                        </td>
                        <td style="text-align: right; ${valueColor}">
                          ${sign}R$ ${m.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div class="pagination-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid var(--border-color, #334155);">
            <div style="font-size: 13px; color: var(--text-secondary);">
              Exibindo <strong>${filteredMovements.length > 0 ? startIndex + 1 : 0}</strong> a <strong>${Math.min(startIndex + this.pageSize, filteredMovements.length)}</strong> de <strong>${filteredMovements.length}</strong> registros
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button id="btn-prev-page" class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" ${this.currentPage <= 1 ? 'disabled' : ''}>
                ${Icons.chevronLeft(14)} Anterior
              </button>
              <span style="font-size: 13px; color: var(--text-primary); font-weight: 500;">
                Página ${this.currentPage} de ${totalPages}
              </span>
              <button id="btn-next-page" class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" ${this.currentPage >= totalPages ? 'disabled' : ''}>
                Próxima ${Icons.chevronRight(14)}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Donut Chart
    const donutContainer = this.container.querySelector(
      '#category-donut-container',
    ) as HTMLElement | null;
    if (donutContainer) {
      donutContainer.appendChild(AllocationChart.render(donutSlices, 240));
    }

    this.bindEvents();
  }

  private bindEvents(): void {
    const btnImport = this.container.querySelector('#btn-import-mov');
    const fileInput = this.container.querySelector('#file-input-mov') as HTMLInputElement | null;

    btnImport?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        await this.handleFilesUpload(files);
      }
    });

    // Filters
    const inputTicker = this.container.querySelector(
      '#filter-income-ticker',
    ) as HTMLInputElement | null;
    inputTicker?.addEventListener('input', (e) => {
      this.filterTicker = (e.target as HTMLInputElement).value;
      this.currentPage = 1;
      this.render();
    });

    const selectCategory = this.container.querySelector(
      '#filter-income-category',
    ) as HTMLSelectElement | null;
    selectCategory?.addEventListener('change', (e) => {
      this.filterCategory = (e.target as HTMLSelectElement).value;
      this.currentPage = 1;
      this.render();
    });

    const selectYear = this.container.querySelector(
      '#filter-income-year',
    ) as HTMLSelectElement | null;
    selectYear?.addEventListener('change', (e) => {
      this.filterYear = (e.target as HTMLSelectElement).value;
      this.currentPage = 1;
      this.render();
    });

    // Pagination
    const btnPrev = this.container.querySelector('#btn-prev-page');
    btnPrev?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.render();
      }
    });

    const btnNext = this.container.querySelector('#btn-next-page');
    btnNext?.addEventListener('click', () => {
      this.currentPage++;
      this.render();
    });
  }

  private bindEmptyEvents(): void {
    const fileInput = this.container.querySelector(
      '#file-input-mov-empty',
    ) as HTMLInputElement | null;
    const btnCta = this.container.querySelector('#btn-cta-upload');

    btnCta?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        await this.handleFilesUpload(files);
      }
    });
  }

  private async handleFilesUpload(files: File[]): Promise<void> {
    const statusEl = this.container.querySelector('#incomes-status') as HTMLElement | null;
    try {
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="banner banner-info" style="display: flex; align-items: center; gap: 8px;">
            <span class="spin-animation">${Icons.refresh(16)}</span>
            <span>Iniciando importação de ${files.length} planilha(s)...</span>
          </div>
        `;
      }

      if (this.controller) {
        const fileBuffers = await Promise.all(
          files.map(async (file) => ({
            buffer: await file.arrayBuffer(),
            name: file.name,
          })),
        );

        const res = await this.controller.importMultipleFiles(
          fileBuffers,
          (current, total, fileName) => {
            if (statusEl) {
              statusEl.innerHTML = `
                <div class="banner banner-info" style="display: flex; align-items: center; gap: 8px;">
                  <span class="spin-animation">${Icons.refresh(16)}</span>
                  <span>Processando arquivo ${current} de ${total} (${escapeHtml(fileName)})...</span>
                </div>
              `;
            }
          },
        );

        if (this.onRefresh) {
          await this.onRefresh();
        } else {
          await this.render();
        }

        const newStatusEl = this.container.querySelector('#incomes-status') as HTMLElement | null;
        if (newStatusEl) {
          if (res.errors.length > 0 && res.totalIncomes === 0) {
            newStatusEl.innerHTML = `
              <div class="banner banner-error" style="display: flex; align-items: center; gap: 8px;">
                ${Icons.alertCircle(16)}
                <span>Falha ao importar: ${res.errors.map((e) => `${escapeHtml(e.fileName)}: ${escapeHtml(e.error)}`).join('; ')}</span>
              </div>
            `;
          } else {
            const errorNotice =
              res.errors.length > 0
                ? `<br><small style="color: var(--text-muted);">${res.errors.length} arquivo(s) com erro: ${res.errors.map((e) => escapeHtml(e.fileName)).join(', ')}</small>`
                : '';
            newStatusEl.innerHTML = `
              <div class="banner banner-success" style="display: flex; align-items: center; gap: 8px;">
                ${Icons.check(16)}
                <div>
                  <strong>Sucesso:</strong> ${res.totalIncomes} proventos importados com sucesso a partir de ${res.movementFiles || res.totalFiles} planilha(s) (R$ ${res.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).
                  ${errorNotice}
                </div>
              </div>
            `;
          }
        }
      } else {
        // Standalone fallback if controller was not injected
        let totalImported = 0;
        let totalReceived = 0;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (statusEl) {
            statusEl.innerHTML = `
              <div class="banner banner-info" style="display: flex; align-items: center; gap: 8px;">
                <span class="spin-animation">${Icons.refresh(16)}</span>
                <span>Processando arquivo ${i + 1} de ${files.length} (${escapeHtml(file.name)})...</span>
              </div>
            `;
          }
          const buffer = await file.arrayBuffer();
          const movements = await this.parser.parse(buffer);
          if (movements.length > 0) {
            const batchId = `batch-mov-${Date.now()}-${i}`;
            const batch = new ImportBatch(batchId, file.name, new Date(), movements.length);
            const taggedMovements = movements.map(
              (m) =>
                new Movement(
                  m.id,
                  m.date,
                  m.movementType,
                  m.category,
                  m.direction,
                  m.asset,
                  m.rawProduct,
                  m.quantity,
                  m.unitPrice,
                  m.totalValue,
                  m.institution,
                  batchId,
                ),
            );
            await this.movementRepo.saveBatch(batch);
            await this.movementRepo.addAll(taggedMovements);
            const incomes = taggedMovements.filter((m) => m.isIncome);
            totalImported += incomes.length;
            totalReceived += incomes.reduce((acc, inc) => acc + inc.totalValue, 0);
          }
        }

        if (this.onRefresh) {
          await this.onRefresh();
        } else {
          await this.render();
        }

        const newStatusEl = this.container.querySelector('#incomes-status') as HTMLElement | null;
        if (newStatusEl) {
          newStatusEl.innerHTML = `
            <div class="banner banner-success" style="display: flex; align-items: center; gap: 8px;">
              ${Icons.check(16)}
              <span>Sucesso: ${totalImported} proventos importados com sucesso a partir de ${files.length} planilha(s) (R$ ${totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).</span>
            </div>
          `;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="banner banner-error" style="display: flex; align-items: center; gap: 8px;">
            ${Icons.alertCircle(16)}
            <span>Erro ao importar movimentações: ${escapeHtml(msg)}</span>
          </div>
        `;
      }
    }
  }
}
