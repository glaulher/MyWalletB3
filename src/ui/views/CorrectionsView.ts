import { IOperationRepository } from '../../core/repositories/IOperationRepository.ts';
import { PersistentOperationRepository } from '../../infrastructure/repositories/PersistentOperationRepository.ts';
import { AveragePriceCalculator } from '../../core/services/AveragePriceCalculator.ts';
import { B3PositionParser, B3PositionItem } from '../../core/services/B3PositionParser.ts';
import {
  ReconciliationService,
  ReconciliationItem,
} from '../../core/services/ReconciliationService.ts';
import { Badge } from '../components/Badge.ts';
import { KpiCard } from '../components/KpiCard.ts';
import { Button } from '../components/Button.ts';
import { Banner } from '../components/Banner.ts';
import { Icons } from '../components/Icons.ts';

export class CorrectionsView {
  private container: HTMLElement;
  private operationRepo: IOperationRepository;
  private onDataChanged?: () => Promise<void>;

  private calculator = new AveragePriceCalculator();
  private positionParser = new B3PositionParser();
  private reconciliationService = new ReconciliationService();

  private b3Items: B3PositionItem[] | null = null;
  private reconciliationResults: ReconciliationItem[] | null = null;
  private filterStatus: 'all' | 'diffs' | 'matched' = 'diffs';
  private activeSubTool: 'worthless' | 'split' | 'reverse_split' | 'subscription' = 'worthless';
  private statusMessage: { text: string; type: 'success' | 'info' | 'error' } | null = null;

  constructor(
    container: HTMLElement,
    onDataChanged?: () => Promise<void>,
    operationRepo: IOperationRepository = new PersistentOperationRepository(),
  ) {
    this.container = container;
    this.onDataChanged = onDataChanged;
    this.operationRepo = operationRepo;
  }

  async render(): Promise<void> {
    const rawOps = await this.operationRepo.getAll();
    const positions = this.calculator.calculate(rawOps);

    if (this.b3Items) {
      this.reconciliationResults = this.reconciliationService.reconcile(
        positions,
        this.b3Items,
        rawOps,
      );
    }

    const openOptions = positions.filter((p) => p.type === 'option' && p.quantity > 0);
    const optionPurchaseMap = new Map<
      string,
      {
        purchaseDate: Date;
        expirationDate: Date;
        formattedBuy: string;
        formattedExp: string;
        formattedInputExp: string;
      }
    >();

    for (const opt of openOptions) {
      const buyOps = rawOps
        .filter((o) => o.asset.toUpperCase().trim() === opt.ticker && o.type === 'buy')
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const pDate = buyOps.length > 0 ? buyOps[0].date : new Date();
      const eDate = this.reconciliationService.calculateOptionExpirationDate(opt.ticker, pDate);

      const pDay = String(pDate.getDate()).padStart(2, '0');
      const pMonth = String(pDate.getMonth() + 1).padStart(2, '0');
      const pYear = pDate.getFullYear();

      const eDay = String(eDate.getDate()).padStart(2, '0');
      const eMonth = String(eDate.getMonth() + 1).padStart(2, '0');
      const eYear = eDate.getFullYear();

      optionPurchaseMap.set(opt.ticker, {
        purchaseDate: pDate,
        expirationDate: eDate,
        formattedBuy: `${pDay}/${pMonth}/${pYear}`,
        formattedExp: `${eDay}/${eMonth}/${eYear}`,
        formattedInputExp: `${eYear}-${eMonth}-${eDay}`,
      });
    }

    const allTickersInWallet = positions.map((p) => p.ticker);

    const diffsCount = this.reconciliationResults
      ? this.reconciliationResults.filter((r) => r.type !== 'MATCH').length
      : 0;
    const matchCount = this.reconciliationResults
      ? this.reconciliationResults.filter((r) => r.type === 'MATCH').length
      : 0;

    const filteredRecon = this.reconciliationResults
      ? this.reconciliationResults.filter((r) => {
          if (this.filterStatus === 'diffs') return r.type !== 'MATCH';
          if (this.filterStatus === 'matched') return r.type === 'MATCH';
          return true;
        })
      : [];

    this.container.innerHTML = `
      <div class="view-content">
        <div class="view-header">
          <div>
            <h2 class="view-title">${Icons.shieldCheck(22)} Correções, Eventos e Conciliação B3</h2>
            <p class="view-subtitle">Concilie sua custódia com a planilha oficial de Posição da B3, dê baixa em opções que viraram pó e lance desdobramentos, grupamentos e subscrições.</p>
          </div>
        </div>

        ${
          this.statusMessage
            ? `<div id="corrections-status">${Banner.generateHtml({ message: this.statusMessage.text, type: this.statusMessage.type, icon: Icons.check(16) })}</div>`
            : ''
        }

        <!-- Seção 1: Conciliação Automática via Planilha de Posição da B3 -->
        <div class="card">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Conciliação Automática com a Posição B3</h3>
              <p class="card-subtitle">Cruze a custódia calculada no aplicativo com o extrato oficial de custódia da B3</p>
            </div>
            <input type="file" id="posicao-file-input" accept=".xlsx" class="hidden-input" />
          </div>

          <div class="reconciliation-upload-box">
            <div class="svg-icon" style="color: #22c55e; margin-bottom: 8px;">${Icons.fileSpreadsheet(32)}</div>
            <h4 class="reconciliation-upload-title">${this.reconciliationResults ? 'Substituir ou Atualizar Arquivo de Posição' : 'Envie seu arquivo de Posição da B3'}</h4>
            <p class="reconciliation-upload-desc">
              Baixe a planilha <strong>Posição</strong> no Portal da B3 (menu <em>Extratos &gt; Posição &gt; Exportar Excel</em>). O sistema identificará automaticamente opções que viraram pó, desdobramentos (splits), grupamentos e sobras de subscrição.
            </p>
            ${Button.generateHtml({
              id: 'btn-trigger-upload',
              label: this.reconciliationResults
                ? 'Selecionar Outra Planilha de Posição'
                : 'Selecionar Planilha da Posição (posicao-*.xlsx)',
              icon: Icons.folderOpen(16),
              variant: 'primary',
            })}
          </div>

          ${
            this.reconciliationResults
              ? `
            <!-- Diagnóstico da Conciliação -->
            <div class="kpi-grid" style="margin: 20px 0;">
              ${KpiCard.generateHtml({
                title: 'Ativos Verificados',
                icon: Icons.search(18),
                value: String(this.reconciliationResults.length),
                subtext: 'Cruzados entre App e B3',
              })}
              ${KpiCard.generateHtml({
                title: '100% Conciliados',
                icon: Icons.shieldCheck(18, 'text-success'),
                value: String(matchCount),
                subtext: 'Quantidades batem perfeitamente',
              })}
              ${KpiCard.generateHtml({
                title: 'Divergências',
                icon:
                  diffsCount > 0
                    ? Icons.alertCircle(18, 'text-danger')
                    : Icons.check(18, 'text-success'),
                value: String(diffsCount),
                subtext: diffsCount > 0 ? 'Requerem ajuste/correção' : 'Nenhuma divergência',
              })}
            </div>

            <div class="card-header-flex" style="margin-top: 16px;">
              <div class="btn-group" id="recon-filter-group">
                <button type="button" class="btn-filter ${this.filterStatus === 'diffs' ? 'selected' : ''}" data-status="diffs">
                  ${Icons.alertCircle(14, 'text-warning')} Apenas Divergências (${diffsCount})
                </button>
                <button type="button" class="btn-filter ${this.filterStatus === 'all' ? 'selected' : ''}" data-status="all">
                  ${Icons.database(14)} Todos os Ativos (${this.reconciliationResults.length})
                </button>
                <button type="button" class="btn-filter ${this.filterStatus === 'matched' ? 'selected' : ''}" data-status="matched">
                  ${Icons.shieldCheck(14, 'text-success')} Conciliados (${matchCount})
                </button>
              </div>

              ${
                diffsCount > 0
                  ? Button.generateHtml({
                      id: 'btn-apply-all-recon',
                      label: 'Conciliar Todas as Divergências com a B3',
                      icon: Icons.check(16),
                      variant: 'success',
                      title: 'Ajusta automaticamente todas as diferenças para igualar à B3',
                    })
                  : ''
              }
            </div>

            <!-- Tabela de Conciliação -->
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ativo</th>
                    <th>Classe</th>
                    <th class="text-right">Qtd no App</th>
                    <th class="text-right">Qtd na B3</th>
                    <th class="text-right">Diferença</th>
                    <th>Diagnóstico</th>
                    <th class="text-right">Ação Recomendada</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    filteredRecon.length === 0
                      ? `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">Nenhum item para este filtro.</td></tr>`
                      : filteredRecon
                          .map((r) => {
                            let badgeClass = 'badge-status-match';
                            let badgeIcon = Icons.shieldCheck(12);
                            let badgeLabel = 'Conciliado';

                            if (r.type === 'OPTION_WORTHLESS') {
                              badgeClass = 'badge-status-powder';
                              badgeIcon = Icons.target(12);
                              badgeLabel = 'Virou Pó (Expirada)';
                            } else if (r.type === 'SPLIT_SUSPECTED') {
                              badgeClass = 'badge-status-split';
                              badgeIcon = Icons.zap(12);
                              badgeLabel = `Desdobramento (1:${r.ratio})`;
                            } else if (r.type === 'REVERSE_SPLIT_SUSPECTED') {
                              badgeClass = 'badge-status-reverse';
                              badgeIcon = Icons.gitMerge(12);
                              badgeLabel = `Grupamento (${r.ratio}:1)`;
                            } else if (r.type === 'MISSING_IN_APP') {
                              badgeClass = 'badge-status-deficit';
                              badgeIcon = Icons.alertCircle(12);
                              badgeLabel = 'Falta no App';
                            } else if (r.type === 'DEFICIT_IN_APP') {
                              badgeClass = 'badge-status-deficit';
                              badgeIcon = Icons.alertCircle(12);
                              badgeLabel = `Faltam +${r.diffQty}`;
                            } else if (r.type === 'EXCESS_IN_APP') {
                              badgeClass = 'badge-status-excess';
                              badgeIcon = Icons.alertCircle(12);
                              badgeLabel = `Excesso de ${Math.abs(r.diffQty)}`;
                            }

                            const diffText =
                              r.diffQty > 0
                                ? `+${r.diffQty.toLocaleString('pt-BR')}`
                                : r.diffQty < 0
                                  ? r.diffQty.toLocaleString('pt-BR')
                                  : '0';

                            const diffColor =
                              r.diffQty > 0
                                ? 'color: #34d399;'
                                : r.diffQty < 0
                                  ? 'color: #f87171;'
                                  : 'color: var(--text-muted);';

                            return `
                            <tr>
                              <td>
                                <span class="font-bold font-mono">${r.ticker}</span>
                                ${r.productName ? `<div class="text-muted" style="font-size: 11px;">${r.productName}</div>` : ''}
                              </td>
                              <td>${Badge.generateHtml({ label: r.assetType.toUpperCase(), variant: r.assetType as any })}</td>
                              <td class="text-right font-mono">${r.calculatedQty.toLocaleString('pt-BR')}</td>
                              <td class="text-right font-mono font-bold">${r.b3Qty.toLocaleString('pt-BR')}</td>
                              <td class="text-right font-mono font-bold" style="${diffColor}">${diffText}</td>
                              <td>
                                <span class="badge ${badgeClass}" style="display: inline-flex; align-items: center; gap: 4px;">
                                  ${badgeIcon}
                                  <span>${badgeLabel}</span>
                                </span>
                                <div class="text-muted" style="font-size: 11px; margin-top: 4px;">${r.description}</div>
                              </td>
                              <td class="text-right">
                                ${
                                  r.type === 'MATCH'
                                    ? `<span class="text-muted" style="font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">${Icons.shieldCheck(14, 'text-success')} OK</span>`
                                    : `<button type="button" class="btn btn-small btn-secondary btn-apply-single-recon" data-ticker="${r.ticker}" style="display: inline-flex; align-items: center; gap: 4px;">
                                        ${
                                          r.type === 'OPTION_WORTHLESS'
                                            ? `${Icons.trash(13)} Baixar a R$ 0`
                                            : r.type === 'SPLIT_SUSPECTED'
                                              ? `${Icons.zap(13)} Aplicar Split`
                                              : `${Icons.check(13)} Ajustar para B3`
                                        }
                                      </button>`
                                }
                              </td>
                            </tr>
                          `;
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          `
              : ''
          }
        </div>

        <!-- Seção 2: Ferramentas Manuais Rápidas -->
        <div class="card sub-tools-card">
          <div class="card-header-flex">
            <div>
              <h3 class="card-title">Ajustes e Eventos Manuais</h3>
              <p class="card-subtitle">Realize correções manuais sem precisar enviar planilhas</p>
            </div>
            <div class="btn-group" id="subtools-tab-group">
              <button type="button" class="btn-filter ${this.activeSubTool === 'worthless' ? 'selected' : ''}" data-tool="worthless">
                ${Icons.target(14)} Opção Virou Pó
              </button>
              <button type="button" class="btn-filter ${this.activeSubTool === 'split' ? 'selected' : ''}" data-tool="split">
                ${Icons.zap(14)} Desdobramento (Split)
              </button>
              <button type="button" class="btn-filter ${this.activeSubTool === 'reverse_split' ? 'selected' : ''}" data-tool="reverse_split">
                ${Icons.gitMerge(14)} Grupamento
              </button>
              <button type="button" class="btn-filter ${this.activeSubTool === 'subscription' ? 'selected' : ''}" data-tool="subscription">
                ${Icons.plusCircle(14)} Subscrição / Bonificação
              </button>
            </div>
          </div>

          <!-- 1. Opção Virou Pó -->
          <div class="sub-tool-panel ${this.activeSubTool === 'worthless' ? '' : 'hidden-el'}" id="panel-worthless">
            <h4 style="color: #fff; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              ${Icons.target(18, 'text-danger')} Baixar Opção por Expiração (Virou Pó)
            </h4>
            <p class="card-subtitle" style="margin-bottom: 16px;">
              Gera automaticamente uma venda a <strong>R$ 0,00</strong> na data do vencimento. A data de compra é identificada no seu histórico e a data de vencimento oficial da B3 (3ª sexta-feira do mês) é calculada e preenchida automaticamente.
            </p>
            <div class="correction-form-grid">
              <div class="form-group">
                <label class="form-label">Opção em Custódia</label>
                <select id="worthless-option-select" class="select-input">
                  ${
                    openOptions.length === 0
                      ? `<option value="">Nenhuma opção com saldo positivo em carteira</option>`
                      : openOptions
                          .map((o) => {
                            const details = optionPurchaseMap.get(o.ticker);
                            const extra = details
                              ? ` (Comprada em ${details.formattedBuy} • Vencimento: ${details.formattedExp})`
                              : '';
                            return `<option value="${o.ticker}" data-exp="${details?.formattedInputExp || ''}" data-buy="${details?.formattedBuy || ''}" data-exp-fmt="${details?.formattedExp || ''}">
                              ${o.ticker} — ${o.quantity} un (PM R$ ${o.averagePrice.toFixed(2)})${extra}
                            </option>`;
                          })
                          .join('')
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Data de Expiração (Vencimento B3)</label>
                <input type="date" id="worthless-date" class="text-input" value="${openOptions.length > 0 && optionPurchaseMap.get(openOptions[0].ticker)?.formattedInputExp ? optionPurchaseMap.get(openOptions[0].ticker)!.formattedInputExp : new Date().toISOString().split('T')[0]}" />
              </div>
              <div>
                ${Button.generateHtml({
                  id: 'btn-submit-worthless',
                  label: 'Baixar Opção a R$ 0,00',
                  icon: Icons.trash(16),
                  variant: 'danger',
                })}
              </div>
            </div>
            <div id="worthless-auto-info" style="margin-top: 12px;"></div>
          </div>

          <!-- 2. Desdobramento (Split) -->
          <div class="sub-tool-panel ${this.activeSubTool === 'split' ? '' : 'hidden-el'}" id="panel-split">
            <h4 style="color: #fff; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              ${Icons.zap(18, 'text-warning')} Desdobramento de Ações / Cotas (Split)
            </h4>
            <p class="card-subtitle" style="margin-bottom: 16px;">
              Multiplica a quantidade de ações pelo fator do desdobramento e divide o preço médio proporcionalmente, sem alterar o custo total investido.
            </p>
            <div class="correction-form-grid">
              <div class="form-group">
                <label class="form-label">Ativo a Desdobrar</label>
                <select id="split-ticker-select" class="select-input">
                  ${
                    allTickersInWallet.length === 0
                      ? `<option value="">Nenhum ativo em carteira</option>`
                      : allTickersInWallet.map((t) => `<option value="${t}">${t}</option>`).join('')
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Proporção (1 ação virou:)</label>
                <select id="split-ratio-select" class="select-input">
                  <option value="2">2 ações (1 : 2)</option>
                  <option value="3">3 ações (1 : 3)</option>
                  <option value="4">4 ações (1 : 4)</option>
                  <option value="5">5 ações (1 : 5)</option>
                  <option value="10">10 ações (1 : 10)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Data do Evento</label>
                <input type="date" id="split-date" class="text-input" value="${new Date().toISOString().split('T')[0]}" />
              </div>
              <div>
                ${Button.generateHtml({
                  id: 'btn-submit-split',
                  label: 'Aplicar Desdobramento',
                  icon: Icons.zap(16),
                  variant: 'primary',
                })}
              </div>
            </div>
          </div>

          <!-- 3. Grupamento (Reverse Split) -->
          <div class="sub-tool-panel ${this.activeSubTool === 'reverse_split' ? '' : 'hidden-el'}" id="panel-reverse-split">
            <h4 style="color: #fff; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              ${Icons.gitMerge(18, 'text-info')} Grupamento de Ações / Cotas (Reverse Split)
            </h4>
            <p class="card-subtitle" style="margin-bottom: 16px;">
              Agrupa múltiplos de ações em uma única ação, multiplicando o preço médio proporcionalmente.
            </p>
            <div class="correction-form-grid">
              <div class="form-group">
                <label class="form-label">Ativo a Agrupar</label>
                <select id="reverse-ticker-select" class="select-input">
                  ${
                    allTickersInWallet.length === 0
                      ? `<option value="">Nenhum ativo em carteira</option>`
                      : allTickersInWallet.map((t) => `<option value="${t}">${t}</option>`).join('')
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Proporção (ações que viraram 1:)</label>
                <select id="reverse-ratio-select" class="select-input">
                  <option value="2">2 ações viraram 1 (2 : 1)</option>
                  <option value="5">5 ações viraram 1 (5 : 1)</option>
                  <option value="10">10 ações viraram 1 (10 : 1)</option>
                  <option value="20">20 ações viraram 1 (20 : 1)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Data do Evento</label>
                <input type="date" id="reverse-date" class="text-input" value="${new Date().toISOString().split('T')[0]}" />
              </div>
              <div>
                ${Button.generateHtml({
                  id: 'btn-submit-reverse',
                  label: 'Aplicar Grupamento',
                  icon: Icons.gitMerge(16),
                  variant: 'primary',
                })}
              </div>
            </div>
          </div>

          <!-- 4. Subscrição / Bonificação -->
          <div class="sub-tool-panel ${this.activeSubTool === 'subscription' ? '' : 'hidden-el'}" id="panel-subscription">
            <h4 style="color: #fff; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              ${Icons.plusCircle(18, 'text-success')} Lançar Subscrição ou Bonificação de Ações/Cotas
            </h4>
            <p class="card-subtitle" style="margin-bottom: 16px;">
              Adiciona novas cotas subscritas pelo preço de emissão ou cotas bonificadas (preço R$ 0,00 ou valor homologado).
            </p>
            <div class="correction-form-grid">
              <div class="form-group">
                <label class="form-label">Ticker do Ativo</label>
                <input type="text" id="sub-ticker-input" class="text-input" placeholder="Ex: CPTI11, ITSA4" />
              </div>
              <div class="form-group">
                <label class="form-label">Quantidade de Cotas</label>
                <input type="number" id="sub-qty-input" class="text-input" placeholder="Ex: 10" min="1" step="1" />
              </div>
              <div class="form-group">
                <label class="form-label">Preço Unitário (R$ 0 se bonificação)</label>
                <input type="number" id="sub-price-input" class="text-input" placeholder="Ex: 80.50" min="0" step="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">Data</label>
                <input type="date" id="sub-date" class="text-input" value="${new Date().toISOString().split('T')[0]}" />
              </div>
              <div>
                ${Button.generateHtml({
                  id: 'btn-submit-sub',
                  label: 'Lançar Subscrição',
                  icon: Icons.plusCircle(16),
                  variant: 'success',
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(positions);
  }

  private bindEvents(positions: ReturnType<AveragePriceCalculator['calculate']>): void {
    const fileInput = this.container.querySelector('#posicao-file-input') as HTMLInputElement;
    const btnTriggerUpload = this.container.querySelector('#btn-trigger-upload');

    btnTriggerUpload?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const buffer = await file.arrayBuffer();
        try {
          this.b3Items = this.positionParser.parse(buffer);
          this.statusMessage = {
            text: `Planilha "${file.name}" carregada com sucesso! ${this.b3Items.length} ativos oficiais analisados da B3.`,
            type: 'success',
          };
          await this.render();
        } catch (err) {
          alert('Erro ao ler planilha de posição: ' + (err as Error).message);
        }
      }
    });

    // Filter status buttons
    const filterButtons = this.container.querySelectorAll<HTMLButtonElement>(
      '#recon-filter-group .btn-filter',
    );
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = btn.dataset.status as 'all' | 'diffs' | 'matched';
        if (status) {
          this.filterStatus = status;
          this.render();
        }
      });
    });

    // Sub-tools tab buttons
    const subToolButtons = this.container.querySelectorAll<HTMLButtonElement>(
      '#subtools-tab-group .btn-filter',
    );
    subToolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool as any;
        if (tool) {
          this.activeSubTool = tool;
          this.render();
        }
      });
    });

    // Action: Apply Single Reconciliation
    const singleActionButtons =
      this.container.querySelectorAll<HTMLButtonElement>('.btn-apply-single-recon');
    singleActionButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ticker = btn.dataset.ticker;
        if (!ticker || !this.reconciliationResults) return;

        const item = this.reconciliationResults.find((r) => r.ticker === ticker);
        if (!item) return;

        await this.applySingleReconciliation(item, positions);
      });
    });

    // Action: Apply All Reconciliations
    const btnApplyAll = this.container.querySelector<HTMLButtonElement>('#btn-apply-all-recon');
    btnApplyAll?.addEventListener('click', async () => {
      if (!this.reconciliationResults) return;

      const diffItems = this.reconciliationResults.filter((r) => r.type !== 'MATCH');
      if (diffItems.length === 0) return;

      if (
        confirm(
          `Deseja aplicar as correções automáticas para todas as ${diffItems.length} divergências encontradas?`,
        )
      ) {
        for (const item of diffItems) {
          await this.applySingleReconciliation(item, positions, false);
        }
        this.statusMessage = {
          text: `Todas as ${diffItems.length} divergências foram conciliadas com sucesso com a B3!`,
          type: 'success',
        };
        if (this.onDataChanged) await this.onDataChanged();
        await this.render();
      }
    });

    // Manual Tool 1: Opção Virou Pó
    const worthlessSelect = this.container.querySelector<HTMLSelectElement>(
      '#worthless-option-select',
    );
    const worthlessDateInput = this.container.querySelector<HTMLInputElement>('#worthless-date');
    const worthlessAutoInfo = this.container.querySelector<HTMLElement>('#worthless-auto-info');

    const updateWorthlessInfo = () => {
      const selectedOpt = worthlessSelect?.selectedOptions[0];
      if (!selectedOpt || !selectedOpt.value) {
        if (worthlessAutoInfo) worthlessAutoInfo.innerHTML = '';
        return;
      }
      const expInput = selectedOpt.dataset.exp;
      const buyFmt = selectedOpt.dataset.buy;
      const expFmt = selectedOpt.dataset.expFmt;

      if (expInput && worthlessDateInput) {
        worthlessDateInput.value = expInput;
      }

      if (worthlessAutoInfo && buyFmt && expFmt) {
        worthlessAutoInfo.innerHTML = `
          <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 6px; padding: 8px 14px; display: inline-flex; align-items: center; gap: 12px; color: #4ade80; font-size: 13px;">
            <span style="display: inline-flex; align-items: center; gap: 6px;">${Icons.calendar(14)} Comprada em: <strong>${buyFmt}</strong></span>
            <span>•</span>
            <span style="display: inline-flex; align-items: center; gap: 6px;">${Icons.target(14)} Vencimento B3 detectado: <strong>${expFmt}</strong> (3ª sexta-feira)</span>
          </div>
        `;
      }
    };

    worthlessSelect?.addEventListener('change', updateWorthlessInfo);
    updateWorthlessInfo();

    const btnSubmitWorthless =
      this.container.querySelector<HTMLButtonElement>('#btn-submit-worthless');
    btnSubmitWorthless?.addEventListener('click', async () => {
      const select = this.container.querySelector('#worthless-option-select') as HTMLSelectElement;
      const dateInput = this.container.querySelector('#worthless-date') as HTMLInputElement;

      const ticker = select?.value;
      if (!ticker) {
        alert('Selecione uma opção válida em carteira.');
        return;
      }

      const pos = positions.find((p) => p.ticker === ticker);
      if (!pos || pos.quantity <= 0) {
        alert('Esta opção não possui quantidade positiva em custódia.');
        return;
      }

      const date = dateInput.value ? new Date(dateInput.value + 'T12:00:00') : new Date();
      const op = this.reconciliationService.createWorthlessOptionOperation(
        ticker,
        pos.quantity,
        date,
      );
      await this.operationRepo.add(op);

      this.statusMessage = {
        text: `Opção ${ticker} baixada com sucesso na data de vencimento ${date.toLocaleDateString('pt-BR')} (prejuízo de 100% reconhecido a R$ 0,00).`,
        type: 'success',
      };
      if (this.onDataChanged) await this.onDataChanged();
      await this.render();
    });

    // Manual Tool 2: Desdobramento (Split)
    const btnSubmitSplit = this.container.querySelector<HTMLButtonElement>('#btn-submit-split');
    btnSubmitSplit?.addEventListener('click', async () => {
      const selectTicker = this.container.querySelector(
        '#split-ticker-select',
      ) as HTMLSelectElement;
      const selectRatio = this.container.querySelector('#split-ratio-select') as HTMLSelectElement;
      const dateInput = this.container.querySelector('#split-date') as HTMLInputElement;

      const ticker = selectTicker?.value;
      const ratio = parseInt(selectRatio?.value, 10);
      if (!ticker || isNaN(ratio) || ratio <= 1) return;

      const pos = positions.find((p) => p.ticker === ticker);
      if (!pos || pos.quantity <= 0) {
        alert('O ativo selecionado não possui saldo em carteira.');
        return;
      }

      const date = dateInput.value ? new Date(dateInput.value) : new Date();
      const op = this.reconciliationService.createSplitOperation(ticker, pos.quantity, ratio, date);
      await this.operationRepo.add(op);

      this.statusMessage = {
        text: `Desdobramento 1:${ratio} aplicado em ${ticker}! Quantidade atualizada para ${pos.quantity * ratio} cotas e preço médio recalculado.`,
        type: 'success',
      };
      if (this.onDataChanged) await this.onDataChanged();
      await this.render();
    });

    // Manual Tool 3: Grupamento (Reverse Split)
    const btnSubmitReverse = this.container.querySelector<HTMLButtonElement>('#btn-submit-reverse');
    btnSubmitReverse?.addEventListener('click', async () => {
      const selectTicker = this.container.querySelector(
        '#reverse-ticker-select',
      ) as HTMLSelectElement;
      const selectRatio = this.container.querySelector(
        '#reverse-ratio-select',
      ) as HTMLSelectElement;
      const dateInput = this.container.querySelector('#reverse-date') as HTMLInputElement;

      const ticker = selectTicker?.value;
      const ratio = parseInt(selectRatio?.value, 10);
      if (!ticker || isNaN(ratio) || ratio <= 1) return;

      const pos = positions.find((p) => p.ticker === ticker);
      if (!pos || pos.quantity <= 0) {
        alert('O ativo selecionado não possui saldo em carteira.');
        return;
      }

      const targetQty = Math.max(1, Math.round(pos.quantity / ratio));
      const diff = pos.quantity - targetQty;
      const date = dateInput.value ? new Date(dateInput.value) : new Date();

      // Adjust custody down to targetQty
      const op = this.reconciliationService.createAdjustmentOperation(
        ticker,
        'sell',
        diff,
        pos.averagePrice,
        `Grupamento (${ratio}:1)`,
        date,
      );
      await this.operationRepo.add(op);

      this.statusMessage = {
        text: `Grupamento ${ratio}:1 aplicado em ${ticker}! Quantidade ajustada para ${targetQty} cotas.`,
        type: 'success',
      };
      if (this.onDataChanged) await this.onDataChanged();
      await this.render();
    });

    // Manual Tool 4: Subscrição / Bonificação
    const btnSubmitSub = this.container.querySelector<HTMLButtonElement>('#btn-submit-sub');
    btnSubmitSub?.addEventListener('click', async () => {
      const tickerInput = this.container.querySelector('#sub-ticker-input') as HTMLInputElement;
      const qtyInput = this.container.querySelector('#sub-qty-input') as HTMLInputElement;
      const priceInput = this.container.querySelector('#sub-price-input') as HTMLInputElement;
      const dateInput = this.container.querySelector('#sub-date') as HTMLInputElement;

      const ticker = tickerInput?.value.toUpperCase().trim();
      const qty = parseInt(qtyInput?.value, 10);
      const price = parseFloat(priceInput?.value) || 0;
      const date = dateInput.value ? new Date(dateInput.value) : new Date();

      if (!ticker || isNaN(qty) || qty <= 0) {
        alert('Preencha um ticker e uma quantidade válidos.');
        return;
      }

      const op = this.reconciliationService.createAdjustmentOperation(
        ticker,
        'buy',
        qty,
        price,
        price === 0 ? 'Bonificação' : 'Subscrição',
        date,
      );
      await this.operationRepo.add(op);

      this.statusMessage = {
        text: `Entrada de ${qty} cotas de ${ticker} a R$ ${price.toFixed(2)} lançada com sucesso!`,
        type: 'success',
      };
      if (this.onDataChanged) await this.onDataChanged();
      await this.render();
    });
  }

  private async applySingleReconciliation(
    item: ReconciliationItem,
    positions: ReturnType<AveragePriceCalculator['calculate']>,
    rerender: boolean = true,
  ): Promise<void> {
    const pos = positions.find((p) => p.ticker === item.ticker);

    if (item.type === 'OPTION_WORTHLESS') {
      const op = this.reconciliationService.createWorthlessOptionOperation(
        item.ticker,
        item.calculatedQty,
        item.expirationDate || new Date(),
      );
      await this.operationRepo.add(op);
    } else if (item.type === 'SPLIT_SUSPECTED' && item.ratio) {
      const op = this.reconciliationService.createSplitOperation(
        item.ticker,
        item.calculatedQty,
        item.ratio,
      );
      await this.operationRepo.add(op);
    } else if (item.diffQty > 0) {
      // B3 has more: add missing shares
      const price = item.closePrice || pos?.averagePrice || 0;
      const op = this.reconciliationService.createAdjustmentOperation(
        item.ticker,
        'buy',
        item.diffQty,
        price,
        'Conciliação B3 (Entrada / Subscrição)',
      );
      await this.operationRepo.add(op);
    } else if (item.diffQty < 0) {
      // App has excess: adjust custody down
      const price = item.closePrice || pos?.averagePrice || 0;
      const op = this.reconciliationService.createAdjustmentOperation(
        item.ticker,
        'sell',
        Math.abs(item.diffQty),
        price,
        'Conciliação B3 (Saída / Venda Pendente)',
      );
      await this.operationRepo.add(op);
    }

    if (rerender) {
      this.statusMessage = {
        text: `Ativo ${item.ticker} conciliado com sucesso com a B3!`,
        type: 'success',
      };
      if (this.onDataChanged) await this.onDataChanged();
      await this.render();
    }
  }
}
