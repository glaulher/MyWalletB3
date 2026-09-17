import {
  DashboardController,
  DashboardSummary,
} from '../../core/controllers/DashboardController.ts';
import { TabBar, TabItem } from '../components/TabBar.ts';
import { Button } from '../components/Button.ts';
import { Banner } from '../components/Banner.ts';
import { Icons } from '../components/Icons.ts';
import { PortfolioView } from './PortfolioView.ts';
import { TradesView } from './TradesView.ts';
import { CalendarView } from './CalendarView.ts';
import { OperationsView } from './OperationsView.ts';
import { IncomesView } from './IncomesView.ts';
import { CorrectionsView } from './CorrectionsView.ts';
import { DarfView } from './DarfView.ts';
import { IncomeReportView } from './IncomeReportView.ts';
import { BackupView } from './BackupView.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { PersistentAssetRepository } from '../../infrastructure/repositories/PersistentAssetRepository.ts';
import { PersistentMovementRepository } from '../../infrastructure/repositories/PersistentMovementRepository.ts';
import { escapeHtml } from '../utils/sanitize.ts';

export class DashboardView {
  private container: HTMLElement;
  private controller: DashboardController;
  private fileInput!: HTMLInputElement;
  private statusMessageEl!: HTMLElement;
  private activeTabId = 'wallet';
  private renderedTabs = new Set<string>();

  private tabs: TabItem[] = [
    { id: 'wallet', label: 'Carteira', icon: Icons.wallet(16) },
    { id: 'trades', label: 'Compras e Vendas', icon: Icons.refresh(16) },
    { id: 'incomes', label: 'Proventos', icon: Icons.coins(16) },
    { id: 'operations', label: 'Extrato', icon: Icons.fileText(16) },
    { id: 'corrections', label: 'Correções', icon: Icons.shieldCheck(16) },
    { id: 'darf', label: 'Calculadora DARF', icon: Icons.calculator(16) },
    { id: 'irpf', label: 'Informe IRPF', icon: Icons.fileSpreadsheet(16) },
    { id: 'backup', label: 'Backup & Dados', icon: Icons.database(16) },
  ];

  constructor(container: HTMLElement, controller: DashboardController) {
    this.container = container;
    this.controller = controller;
  }

  async render(): Promise<void> {
    const summary = await this.controller.load();

    this.container.innerHTML = `
      <div class="dashboard-wrapper">
        <header class="app-header">
          <div class="header-left">
            <div class="app-brand">
              <span class="brand-icon">${Icons.appLogo(44)}</span>
              <div>
                <h1 class="brand-title">MyWalletB3</h1>
                <p class="brand-subtitle">Gestão de Carteira, Preço Médio e Fiscal B3</p>
              </div>
            </div>
          </div>
          <div class="header-actions">
            <input type="file" id="file-uploader" accept=".xlsx,.csv" multiple class="hidden-input" />
            ${Button.generateHtml({
              id: 'btn-upload',
              label: 'Subir Planilhas B3 (.xlsx/.csv)',
              icon: Icons.upload(16),
              variant: 'primary',
            })}
            ${Button.generateHtml({
              id: 'btn-rollback',
              label: 'Desfazer Último Lote',
              icon: Icons.undo(16),
              variant: 'secondary',
              className: summary.lastBatch ? '' : 'hidden-el',
              title: 'Desfazer a última planilha importada e restaurar o estado anterior',
            })}
          </div>
        </header>

        <div id="status-message"></div>

        <!-- Ponto de Restauração Ativo -->
        <div id="batch-info-container">
          ${
            summary.lastBatch
              ? `
            <div class="batch-banner">
              <div class="batch-chip">
                <span class="batch-chip-icon">${Icons.shieldCheck(14)}</span>
                <span>Ponto de restauração: <strong>${escapeHtml(summary.lastBatch.fileName)}</strong> (${escapeHtml(summary.lastBatch.importedAt.toLocaleString('pt-BR'))})</span>
              </div>
            </div>
          `
              : ''
          }
        </div>

        <!-- Barra de Abas -->
        <div id="tab-bar-container" style="margin-bottom: 24px;"></div>

        <!-- Área de Conteúdo das Abas (Keep-Alive Panes) -->
        <main id="tab-content-area" class="dashboard-body">
          ${this.tabs
            .map(
              (tab) => `
            <div id="tab-pane-${tab.id}" class="tab-pane" style="display: ${tab.id === this.activeTabId ? 'block' : 'none'};"></div>
          `,
            )
            .join('')}
        </main>
      </div>
    `;

    this.bindEvents();
    this.renderTabBar();
    await this.renderActiveTab(summary);
  }

  private renderTabBar(): void {
    const tabBarContainer = this.container.querySelector('#tab-bar-container');
    if (!tabBarContainer) return;

    tabBarContainer.innerHTML = '';
    const tabBarEl = TabBar.render({
      tabs: this.tabs,
      activeTabId: this.activeTabId,
      onTabChange: async (tabId) => {
        this.activeTabId = tabId;
        await this.renderActiveTab();
      },
    });

    tabBarContainer.appendChild(tabBarEl);
  }

  private async renderActiveTab(summary?: DashboardSummary): Promise<void> {
    // Show active pane, hide all inactive panes
    this.tabs.forEach((tab) => {
      const pane = this.container.querySelector(`#tab-pane-${tab.id}`) as HTMLElement | null;
      if (pane) {
        pane.style.display = tab.id === this.activeTabId ? 'block' : 'none';
      }
    });

    // If tab was already rendered in DOM, return immediately (0ms)
    if (this.renderedTabs.has(this.activeTabId)) {
      return;
    }

    const targetPane = this.container.querySelector(`#tab-pane-${this.activeTabId}`) as HTMLElement;
    if (!targetPane) return;

    switch (this.activeTabId) {
      case 'wallet': {
        const walletSummary = summary || (await this.controller.load());
        if (walletSummary.totalOperations === 0) {
          const portfolioView = new PortfolioView(targetPane);
          portfolioView.render(walletSummary);
        } else {
          targetPane.innerHTML = `
            <div id="portfolio-main-section"></div>
            <div id="dashboard-calendar-section" style="margin-top: 36px;">
              <div class="card-header-flex" style="margin-bottom: 14px;">
                <div>
                  <h2 class="view-title" style="font-size: 20px; display: flex; align-items: center; gap: 8px;">
                    ${Icons.calendar(22)} Calendário de Operações
                  </h2>
                  <p class="view-subtitle">
                    Acompanhamento diário de compras, vendas e apuração de resultados com as cores do Google
                  </p>
                </div>
              </div>
              <div id="calendar-view-mount"></div>
            </div>
          `;
          const portfolioContainer = targetPane.querySelector(
            '#portfolio-main-section',
          ) as HTMLElement;
          const calendarContainer = targetPane.querySelector('#calendar-view-mount') as HTMLElement;

          const portfolioView = new PortfolioView(portfolioContainer);
          portfolioView.render(walletSummary);

          const calendarView = new CalendarView(
            calendarContainer,
            this.controller.getOperationRepo(),
          );
          await calendarView.render();
        }
        break;
      }
      case 'trades': {
        const tradesView = new TradesView(targetPane, this.controller.getOperationRepo());
        await tradesView.render();
        break;
      }
      case 'incomes': {
        const incomesView = new IncomesView(
          targetPane,
          async () => {
            await this.invalidateAndRefresh();
          },
          this.controller.getMovementRepo(),
          this.controller.getOperationRepo(),
          this.controller,
        );
        await incomesView.render();
        break;
      }
      case 'operations': {
        const opsView = new OperationsView(targetPane, this.controller.getOperationRepo());
        await opsView.render();
        break;
      }
      case 'corrections': {
        const correctionsView = new CorrectionsView(
          targetPane,
          async () => {
            await this.invalidateAndRefresh();
          },
          this.controller.getOperationRepo(),
        );
        await correctionsView.render();
        break;
      }
      case 'darf': {
        const darfView = new DarfView(targetPane, this.controller.getOperationRepo());
        await darfView.render();
        break;
      }
      case 'irpf': {
        const irpfView = new IncomeReportView(targetPane, this.controller.getOperationRepo());
        await irpfView.render();
        break;
      }
      case 'backup': {
        const backupView = new BackupView(
          targetPane,
          async () => {
            await this.invalidateAndRefresh();
          },
          this.controller.getOperationRepo(),
          this.controller.getAssetRepo(),
          this.controller.getMovementRepo(),
        );
        await backupView.render();
        break;
      }
      default:
        targetPane.innerHTML = `<div>Aba não encontrada.</div>`;
    }

    this.renderedTabs.add(this.activeTabId);
  }

  private async invalidateAndRefresh(): Promise<void> {
    this.renderedTabs.clear();
    this.controller.invalidateCache();
    PersistentOperationRepository.invalidateCache();
    PersistentAssetRepository.invalidateCache();
    PersistentMovementRepository.invalidateCache();
    await this.render();
  }

  private bindEvents(): void {
    this.fileInput = this.container.querySelector('#file-uploader') as HTMLInputElement;
    this.statusMessageEl = this.container.querySelector('#status-message') as HTMLElement;

    const btnUpload = this.container.querySelector('#btn-upload');
    const btnRollback = this.container.querySelector('#btn-rollback') as HTMLButtonElement | null;

    btnUpload?.addEventListener('click', () => this.fileInput.click());

    this.fileInput?.addEventListener('change', async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        await this.handleFilesUpload(files);
      }
    });

    btnRollback?.addEventListener('click', async () => {
      if (
        confirm('Deseja desfazer o último lote importado e restaurar o ponto de fallback anterior?')
      ) {
        btnRollback.setAttribute('disabled', 'true');
        btnRollback.innerHTML = `<span class="spin-animation">${Icons.refresh(16)}</span> <span>Desfazendo...</span>`;
        await this.controller.rollbackLastBatch();
        await this.invalidateAndRefresh();
        this.showMessage('Último lote desfeito com sucesso. Estado anterior restaurado.', 'info');
      }
    });
  }

  private async handleFilesUpload(files: File[]): Promise<void> {
    try {
      if (files.length === 1) {
        const file = files[0];
        this.showMessage(
          `<span style="display: flex; align-items: center; gap: 8px;">
            <span class="spin-animation">${Icons.refresh(16)}</span>
            <span>Processando e gravando "${escapeHtml(file.name)}"...</span>
          </span>`,
          'info',
        );
      } else {
        this.showMessage(
          `<span style="display: flex; align-items: center; gap: 8px;">
            <span class="spin-animation">${Icons.refresh(16)}</span>
            <span id="multi-upload-status">Preparando importação de ${files.length} planilhas...</span>
          </span>`,
          'info',
        );
      }

      await new Promise((r) => setTimeout(r, 40));

      const fileBuffers = await Promise.all(
        files.map(async (f) => ({
          buffer: await f.arrayBuffer(),
          name: f.name,
        })),
      );

      const statusEl = this.container.querySelector('#multi-upload-status');

      const result = await this.controller.importMultipleFiles(
        fileBuffers,
        (current, total, fileName) => {
          if (statusEl) {
            statusEl.textContent = `Processando ${current} de ${total} planilhas ("${fileName}")...`;
          }
        },
      );

      let msg = '';
      if (result.totalFiles === 1) {
        const f = files[0];
        if (result.tradeFiles > 0) {
          msg = `Planilha de negociação "${f.name}" importada com sucesso! ${result.totalOperations} operações salvas no banco.`;
        } else if (result.movementFiles > 0) {
          const valStr = result.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          msg = `Planilha de movimentação "${f.name}" importada com sucesso! ${result.totalMovements} lançamentos registrados (${result.totalIncomes} proventos totalizando R$ ${valStr}).`;
        } else {
          msg = `Planilha "${f.name}" processada.`;
        }
      } else {
        const parts = [];
        if (result.totalOperations > 0) parts.push(`${result.totalOperations} operações`);
        if (result.totalMovements > 0) parts.push(`${result.totalMovements} movimentações`);
        const details = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        msg = `${result.totalFiles} planilhas importadas com sucesso!${details}`;
      }

      if (result.tradeFiles > 0 && this.activeTabId === 'incomes') {
        this.activeTabId = 'wallet';
      } else if (
        result.movementFiles > 0 &&
        result.tradeFiles === 0 &&
        this.activeTabId === 'wallet'
      ) {
        this.activeTabId = 'incomes';
      }

      await this.invalidateAndRefresh();

      if (result.errors.length > 0) {
        const errDetails = result.errors.map((e) => `"${e.fileName}": ${e.error}`).join(' | ');
        msg += ` | Avisos: ${errDetails}`;
        this.showMessage(msg, 'error');
      } else {
        this.showMessage(msg, 'success');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.showMessage(`Erro ao importar planilhas: ${errorMsg}`, 'error');
    } finally {
      this.fileInput.value = '';
    }
  }

  private showMessage(message: string, type: 'info' | 'success' | 'error'): void {
    if (!this.statusMessageEl) return;
    this.statusMessageEl.innerHTML = Banner.generateHtml({ message, type });

    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (this.statusMessageEl) this.statusMessageEl.innerHTML = '';
      }, 6000);
    }
  }
}
