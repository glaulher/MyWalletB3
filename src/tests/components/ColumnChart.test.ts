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
    // 20 items * 68 minSlotWidth = 1360 + padding = 1456 > 560
    const manyItems: ColumnChartItem[] = Array.from({ length: 20 }, (_, idx) => ({
      label: `ASSET${idx + 1}`,
      value: (idx + 1) * 100,
      percentage: 5,
    }));

    const svgString = ColumnChart.generateSvg(manyItems, 560, 260, 68);

    expect(svgString).toContain('<svg');
    expect(svgString).toContain('width="1456"');
    expect(svgString).toContain('viewBox="0 0 1456 260"');
    expect(svgString).toContain('ASSET1');
    expect(svgString).toContain('ASSET20');
  });
});
