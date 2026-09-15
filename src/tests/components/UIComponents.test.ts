import { describe, it, expect } from 'bun:test';
import { Button } from '../../ui/components/Button.ts';
import { Badge } from '../../ui/components/Badge.ts';
import { KpiCard } from '../../ui/components/KpiCard.ts';
import { Banner } from '../../ui/components/Banner.ts';

describe('UI Reusable Components', () => {
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
