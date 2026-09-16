import { describe, it, expect } from 'bun:test';
import { ColumnChart, ColumnChartItem } from '../../ui/components/ColumnChart.ts';

describe('ColumnChart', () => {
  it('should generate empty message when no data is provided', () => {
    const svgString = ColumnChart.generateSvg([]);
    expect(svgString).toContain('chart-empty');
  });

  it('should generate valid SVG with column bars, labels and tooltips', () => {
    const items: ColumnChartItem[] = [
      { label: 'CPTI11', value: 163.61, percentage: 20 },
      { label: 'HGLG11', value: 146.61, percentage: 18 },
      { label: 'BERK34', value: 129.74, percentage: 16 },
    ];

    const svgString = ColumnChart.generateSvg(items, 500, 250);

    expect(svgString).toContain('<svg');
    expect(svgString).toContain('viewBox="0 0 500 250"');
    expect(svgString).toContain('CPTI11');
    expect(svgString).toContain('HGLG11');
    expect(svgString).toContain('BERK34');
    expect(svgString).toContain('class="column-bar-rect"');
    expect(svgString).toContain('R$ 164'); // Math.round(163.61)
  });

  it('should dynamically expand width to support horizontal scroll when there are many items', () => {
    // 20 items * 68 minSlotWidth = 1360 + padding (68 + 36 = 104) = 1464 > 560
    const manyItems: ColumnChartItem[] = Array.from({ length: 20 }, (_, idx) => ({
      label: `ASSET${idx + 1}`,
      value: (idx + 1) * 100,
      percentage: 5,
    }));

    const svgString = ColumnChart.generateSvg(manyItems, 560, 260, 68);

    expect(svgString).toContain('<svg');
    expect(svgString).toContain('width="1464"');
    expect(svgString).toContain('viewBox="0 0 1464 260"');
    expect(svgString).toContain('ASSET1');
    expect(svgString).toContain('ASSET20');
  });

  it('should render dual comparative bars with legend and gain/loss percentages when compareValue is provided', () => {
    const items: ColumnChartItem[] = [
      { label: 'PETR4', value: 1000, compareValue: 1200 }, // Gain +20%
      { label: 'VALE3', value: 1500, compareValue: 1350 }, // Loss -10%
    ];

    const svgString = ColumnChart.generateSvg(items, 560, 280);

    expect(svgString).toContain('chart-legend');
    expect(svgString).toContain('Custo Investido');
    expect(svgString).toContain('Valor Atual (Lucro)');
    expect(svgString).toContain('Valor Atual (Prejuízo)');
    expect(svgString).toContain('+20.0%');
    expect(svgString).toContain('-10.0%');
    expect(svgString).toContain('PETR4');
    expect(svgString).toContain('VALE3');
    expect(svgString).toContain('C: R$ 1.000');
    expect(svgString).toContain('A: R$ 1.200');
    expect(svgString).toContain('C: R$ 1.500');
    expect(svgString).toContain('A: R$ 1.350');
  });
});
