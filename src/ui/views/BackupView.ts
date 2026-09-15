import { BackupService } from '../../core/services/BackupService.ts';
import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { IAssetRepository } from '../../core/repositories/IAssetRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { PersistentAssetRepository } from '../../infrastructure/repositories/PersistentAssetRepository.ts';
import { Button } from '../components/Button.ts';
import { Banner } from '../components/Banner.ts';
import { Icons } from '../components/Icons.ts';

export class BackupView {
  private container: HTMLElement;
  private backupService: BackupService;
  private operationRepo: IOperationRepository;
  private onStateChange: () => void;

  constructor(
    container: HTMLElement,
    onStateChange: () => void,
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
    assetRepo: IAssetRepository = new PersistentAssetRepository(),
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.operationRepo = operationRepo;
    this.backupService = new BackupService(operationRepo, assetRepo);
  }

  async render(): Promise<void> {
    const batches = await this.operationRepo.getBatches();
    const operations = await this.operationRepo.getAll();

    this.container.innerHTML = `
      <div class="view-content">
        <div class="view-header">
          <div>
            <h2 class="view-title">${Icons.database(22)} Backup e Restauração de Dados</h2>
            <p class="view-subtitle">Exporte cópias de segurança, restaure backups anteriores ou reverta lotes importados.</p>
          </div>
        </div>

        <div id="backup-status-banner"></div>

        <div class="backup-grid">
          <!-- Card Exportar -->
          <div class="card backup-card">
            <div class="backup-card-header">
              <span class="backup-icon">${Icons.download(24)}</span>
              <div>
                <h3 class="card-title">Exportar Banco de Dados</h3>
                <p class="card-subtitle">Download de arquivo .json estruturado com ${operations.length} operações e ${batches.length} lotes.</p>
              </div>
            </div>
            <div class="backup-card-body">
              <p class="text-muted" style="margin-bottom: 24px; font-size: 13px; line-height: 1.5;">
                Gere um arquivo de segurança contendo todas as operações cadastradas, preços médios e histórico de importações.
              </p>
              ${Button.generateHtml({
                id: 'btn-export-backup',
                label: 'Baixar Backup Completo (.json)',
                icon: Icons.download(16),
                variant: 'primary',
                className: 'btn-full-width',
                disabled: operations.length === 0,
              })}
            </div>
          </div>

          <!-- Card Restaurar -->
          <div class="card backup-card">
            <div class="backup-card-header">
              <span class="backup-icon">${Icons.upload(24)}</span>
              <div>
                <h3 class="card-title">Restaurar de um Arquivo</h3>
                <p class="card-subtitle">Suba um arquivo .json gerado previamente para recuperar seus dados.</p>
              </div>
            </div>
            <div class="backup-card-body">
              <input type="file" id="backup-file-input" accept=".json" class="hidden-input" />
              <div style="margin-bottom: 16px;">
                <label for="restore-mode" style="display: block; font-size: 13px; font-weight: 500; color: var(--text-muted); margin-bottom: 8px;">
                  Modo de Restauração:
                </label>
                <select id="restore-mode" class="select-input" style="width: 100%;">
                  <option value="overwrite">Substituir dados atuais (Limpa banco e importa)</option>
                  <option value="merge">Mesclar com dados atuais (Preserva existentes)</option>
                </select>
              </div>
              ${Button.generateHtml({
                id: 'btn-select-backup',
                label: 'Selecionar Arquivo de Backup',
                icon: Icons.folderOpen(16),
                variant: 'secondary',
                className: 'btn-full-width',
              })}
            </div>
          </div>
        </div>

        <!-- Histórico de Lotes / Pontos de Restauração -->
        <div class="card table-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Pontos de Fallback (Lotes Importados)</h3>
              <p class="card-subtitle">Histórico de planilhas subidas no sistema. Você pode desfazer qualquer lote individualmente.</p>
            </div>
            <span class="badge badge-info">${batches.length} lotes registrados</span>
          </div>

          ${
            batches.length === 0
              ? `<div class="chart-empty" style="padding: 24px;">Nenhum lote importado ainda.</div>`
              : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Data/Hora de Importação</th>
                    <th>Arquivo de Origem</th>
                    <th class="text-right">Operações no Lote</th>
                    <th class="text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${batches
                    .map(
                      (b) => `
                    <tr>
                      <td>${b.importedAt.toLocaleString('pt-BR')}</td>
                      <td class="font-bold">${b.fileName}</td>
                      <td class="text-right">${b.operationCount}</td>
                      <td class="text-right">
                        <button class="btn btn-danger btn-small btn-remove-batch" data-batch-id="${b.id}" data-file-name="${b.fileName}">
                          ${Icons.undo(14)}
                          <span>Desfazer Este Lote</span>
                        </button>
                      </td>
                    </tr>
                  `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>

        <!-- Zona de Perigo -->
        <div class="card danger-zone-card" style="margin-top: 24px;">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title" style="color: #f87171; display: flex; align-items: center; gap: 8px;">
                ${Icons.alertCircle(18)}
                <span>Zona de Perigo</span>
              </h3>
              <p class="card-subtitle">Apagar permanentemente todas as operações e redefinir o banco.</p>
            </div>
            ${Button.generateHtml({
              id: 'btn-danger-reset',
              label: 'Zerar Banco de Dados',
              icon: Icons.trash(16),
              variant: 'danger',
            })}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const btnExport = this.container.querySelector('#btn-export-backup');
    const btnSelect = this.container.querySelector('#btn-select-backup');
    const fileInput = this.container.querySelector('#backup-file-input') as HTMLInputElement;
    const restoreModeSelect = this.container.querySelector('#restore-mode') as HTMLSelectElement;
    const btnReset = this.container.querySelector('#btn-danger-reset');

    btnExport?.addEventListener('click', async () => {
      try {
        const json = await this.backupService.exportBackup();
        this.backupService.downloadBackupFile(json);
        this.showBanner('Backup exportado e baixado com sucesso!', 'success');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.showBanner(`Erro ao exportar backup: ${errorMsg}`, 'error');
      }
    });

    btnSelect?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        try {
          const text = await file.text();
          const mode = (restoreModeSelect?.value as 'overwrite' | 'merge') || 'overwrite';
          const result = await this.backupService.importBackup(text, mode);
          this.showBanner(
            `Backup "${file.name}" restaurado com sucesso! (${result.operationsRestored} operações restauradas)`,
            'success',
          );
          await this.render();
          this.onStateChange();
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.showBanner(`Falha ao restaurar backup: ${errorMsg}`, 'error');
        }
      }
    });

    this.container.querySelectorAll('.btn-remove-batch').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const batchId = (btn as HTMLElement).dataset.batchId;
        const fileName = (btn as HTMLElement).dataset.fileName;
        if (!batchId) return;

        if (
          confirm(
            `Deseja realmente remover o lote "${fileName}"? As operações importadas por ele serão desfeitas.`,
          )
        ) {
          await this.operationRepo.removeBatch(batchId);
          this.showBanner(`Lote "${fileName}" desfeito com sucesso.`, 'info');
          await this.render();
          this.onStateChange();
        }
      });
    });

    btnReset?.addEventListener('click', async () => {
      if (
        confirm(
          'ATENÇÃO: Você está prestes a apagar todos os dados salvos no banco. Tem certeza absoluta?',
        )
      ) {
        await this.operationRepo.clear();
        this.showBanner('Banco de dados zerado com sucesso.', 'info');
        await this.render();
        this.onStateChange();
      }
    });
  }

  private showBanner(message: string, type: 'info' | 'success' | 'error'): void {
    const el = this.container.querySelector('#backup-status-banner');
    if (!el) return;
    el.innerHTML = Banner.generateHtml({ message, type });
    setTimeout(() => {
      el.innerHTML = '';
    }, 6000);
  }
}
