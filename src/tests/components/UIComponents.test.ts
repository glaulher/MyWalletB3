import { describe, it, expect } from 'bun:test';
import { Button } from '../../ui/components/Button.ts';
import { Badge } from '../../ui/components/Badge.ts';
import { KpiCard } from '../../ui/components/KpiCard.ts';
import { Banner } from '../../ui/components/Banner.ts';
import { Icons } from '../../ui/components/Icons.ts';

describe('UI Reusable Components', () => {
  it('Icons should generate valid SVG strings', () => {
    const walletSvg = Icons.wallet(20, 'test-class');
    expect(walletSvg).toContain('<svg');
    expect(walletSvg).toContain('width="20"');
    expect(walletSvg).toContain('height="20"');
    expect(walletSvg).toContain('viewBox="0 0 24 24"');
    expect(walletSvg).toContain('test-class');
    expect(walletSvg).toContain('svg-icon');

    const downloadSvg = Icons.download();
    expect(downloadSvg).toContain('<svg');
    expect(downloadSvg).toContain('stroke="currentColor"');

    const chevronSvg = Icons.chevronDown(16);
    expect(chevronSvg).toContain('<svg');
    expect(chevronSvg).toContain('width="16"');

    const targetSvg = Icons.target(16);
    expect(targetSvg).toContain('<svg');
    expect(targetSvg).toContain('width="16"');

    const zapSvg = Icons.zap(14);
    expect(zapSvg).toContain('<svg');
    expect(zapSvg).toContain('polygon');

    const gitMergeSvg = Icons.gitMerge(14);
    expect(gitMergeSvg).toContain('<svg');

    const plusCircleSvg = Icons.plusCircle(14);
    expect(plusCircleSvg).toContain('<svg');

    const appLogoSvg = Icons.appLogo(32, 'my-logo');
    expect(appLogoSvg).toContain('<svg');
    expect(appLogoSvg).toContain('width="32"');
    expect(appLogoSvg).toContain('my-logo');
    expect(appLogoSvg).toContain('app-logo-icon');
  });

  it('Button should generate valid HTML with variants and icons', () => {
    const html = Button.generateHtml({
      label: 'Salvar',
      icon: '💾',
      variant: 'primary',
      id: 'btn-test',
    });
    expect(html).toContain('btn-primary');
    expect(html).toContain('id="btn-test"');
    expect(html).toContain('💾');
    expect(html).toContain('Salvar');

    const selectedHtml = Button.generateHtml({
      label: 'Filtrar',
      variant: 'secondary',
      selected: true,
    });
    expect(selectedHtml).toContain('btn-selected');
    expect(selectedHtml).toContain('aria-selected="true"');
  });

  it('Badge should generate valid badge classes for asset types and operations', () => {
    const stockHtml = Badge.generateHtml({ label: 'Ação', variant: 'stock' });
    expect(stockHtml).toContain('badge-type-stock');
    expect(stockHtml).toContain('Ação');

    const fiiHtml = Badge.generateHtml({ label: 'FII', variant: 'fii' });
    expect(fiiHtml).toContain('badge-type-fii');

    const fiInfraHtml = Badge.generateHtml({ label: 'FI-Infra', variant: 'fi-infra' });
    expect(fiInfraHtml).toContain('badge-type-fi-infra');

    const buyHtml = Badge.generateHtml({ label: 'Compra', variant: 'buy' });
    expect(buyHtml).toContain('badge-buy');

    const sellHtml = Badge.generateHtml({ label: 'Venda', variant: 'sell' });
    expect(sellHtml).toContain('badge-sell');

    const optionHtml = Badge.generateHtml({ label: 'Opção', variant: 'option' });
    expect(optionHtml).toContain('badge-type-option');
  });

  it('KpiCard should generate valid HTML structure', () => {
    const html = KpiCard.generateHtml({
      title: 'Patrimônio',
      value: 'R$ 50.000,00',
      icon: '💰',
      subtext: 'Total acumulado',
    });
    expect(html).toContain('kpi-card');
    expect(html).toContain('Patrimônio');
    expect(html).toContain('R$ 50.000,00');
    expect(html).toContain('💰');
    expect(html).toContain('Total acumulado');
  });

  it('Banner should generate status banner HTML with type', () => {
    const html = Banner.generateHtml({
      message: 'Operação concluída',
      type: 'success',
      icon: '✅',
    });
    expect(html).toContain('status-banner');
    expect(html).toContain('status-success');
    expect(html).toContain('Operação concluída');
  });
});
