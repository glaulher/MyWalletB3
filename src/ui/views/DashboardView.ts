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
import { OperationsView } from './OperationsView.ts';
import { CorrectionsView } from './CorrectionsView.ts';
import { DarfView } from './DarfView.ts';
import { IncomeReportView } from './IncomeReportView.ts';
import { BackupView } from './BackupView.ts';

export class DashboardView {
  private container: HTMLElement;
  private controller: DashboardController;
  private fileInput!: HTMLInputElement;
  private statusMessageEl!: HTMLElement;
  private activeTabId = 'wallet';

  private tabs: TabItem[] = [
    { id: 'wallet', label: 'Carteira', icon: Icons.wallet(16) },
    { id: 'trades', label: 'Compras e Vendas', icon: Icons.refresh(16) },
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
              <span class="brand-icon">${Icons.trendingUp(24)}</span>
              <div>
                <h1 class="brand-title">MyWalletB3</h1>
                <p class="brand-subtitle">Gestão de Carteira, Preço Médio e Fiscal B3</p>
              </div>
            </div>
          </div>
          <div class="header-actions">
            <input type="file" id="file-uploader" accept=".xlsx,.csv" class="hidden-input" />
            ${Button.generateHtml({
              id: 'btn-upload',
              label: 'Subir Planilha B3 (.xlsx/.csv)',
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
                <span>Ponto de restauração: <strong>${summary.lastBatch.fileName}</strong> (${summary.lastBatch.importedAt.toLocaleString('pt-BR')})</span>
              </div>
            </div>
          `
              : ''
          }
        </div>

        <!-- Barra de Abas -->
        <div id="tab-bar-container" style="margin-bottom: 24px;"></div>

        <!-- Área de Conteúdo da Aba Ativa -->
        <main id="tab-content-area" class="dashboard-body"></main>
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
        const summary = await this.controller.load();
        await this.renderActiveTab(summary);
      },
    });

    tabBarContainer.appendChild(tabBarEl);
  }

  private async renderActiveTab(summary: DashboardSummary): Promise<void> {
    const contentArea = this.container.querySelector('#tab-content-area') as HTMLElement;
    if (!contentArea) return;

    contentArea.innerHTML = '';

    switch (this.activeTabId) {
      case 'wallet': {
        const portfolioView = new PortfolioView(contentArea);
        portfolioView.render(summary);
        break;
      }
      case 'trades': {
        const tradesView = new TradesView(contentArea);
        await tradesView.render();
        break;
      }
      case 'operations': {
        const opsView = new OperationsView(contentArea);
        await opsView.render();
        break;
      }
      case 'corrections': {
        const correctionsView = new CorrectionsView(contentArea, async () => {
          await this.controller.load();
        });
        await correctionsView.render();
        break;
      }
      case 'darf': {
        const darfView = new DarfView(contentArea);
        await darfView.render();
        break;
      }
      case 'irpf': {
        const irpfView = new IncomeReportView(contentArea);
        await irpfView.render();
        break;
      }
      case 'backup': {
        const backupView = new BackupView(contentArea, async () => {
          await this.render();
        });
        await backupView.render();
        break;
      }
      default:
        contentArea.innerHTML = `<div>Aba não encontrada.</div>`;
    }
  }

  private bindEvents(): void {
    this.fileInput = this.container.querySelector('#file-uploader') as HTMLInputElement;
    this.statusMessageEl = this.container.querySelector('#status-message') as HTMLElement;

    const btnUpload = this.container.querySelector('#btn-upload');
    const btnRollback = this.container.querySelector('#btn-rollback');

    btnUpload?.addEventListener('click', () => this.fileInput.click());

    this.fileInput.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        await this.handleFileUpload(file);
      }
    });

    btnRollback?.addEventListener('click', async () => {
      if (
        confirm('Deseja desfazer o último lote importado e restaurar o ponto de fallback anterior?')
      ) {
        await this.controller.rollbackLastBatch();
        this.showMessage('Último lote desfeito com sucesso. Estado anterior restaurado.', 'info');
        await this.render();
      }
    });
  }

  private async handleFileUpload(file: File): Promise<void> {
    try {
      this.showMessage(`Processando e gravando no banco "${file.name}"...`, 'info');
      const buffer = await file.arrayBuffer();
      const summary = await this.controller.importFile(buffer, file.name);
      this.showMessage(
        `Planilha "${file.name}" importada com sucesso! ${summary.totalOperations} operações salvas no banco.`,
        'success',
      );
      await this.render();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.showMessage(`Erro ao importar planilha: ${errorMsg}`, 'error');
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
