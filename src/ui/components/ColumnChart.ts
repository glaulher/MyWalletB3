export interface ColumnChartItem {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
}

export class ColumnChart {
  /**
   * Generates pure SVG string with coordinate calculations and horizontal scrolling support.
   */
  static generateSvg(
    items: ColumnChartItem[],
    width = 560,
    height = 280,
    minSlotWidth = 72,
  ): string {
    if (!items || items.length === 0 || items.every((item) => item.value <= 0)) {
      return `<div class="chart-empty">Nenhum dado para exibir no gráfico</div>`;
    }

    const padding = { top: 36, right: 36, bottom: 52, left: 68 };
    const barCount = items.length;

    // Calculate dynamic total width to ensure every bar has enough room for labels without collision
    const neededWidth = padding.left + padding.right + barCount * minSlotWidth;
    const isScrollable = neededWidth > width;
    const actualWidth = Math.max(width, neededWidth);
    const chartWidth = actualWidth - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...items.map((i) => i.value), 1);
    const yAxisMax = Math.ceil(maxValue * 1.15);

    let elements = '';

    // Horizontal grid lines and Y-axis values
    const gridSteps = 4;
    for (let s = 0; s <= gridSteps; s++) {
      const stepVal = (yAxisMax / gridSteps) * s;
      const yPos = padding.top + chartHeight - (stepVal / yAxisMax) * chartHeight;

      elements += `
        <line x1="${padding.left}" y1="${yPos}" x2="${padding.left + chartWidth}" y2="${yPos}"
              stroke="#334155" stroke-width="1" stroke-dasharray="${s === 0 ? 'none' : '3 3'}" opacity="0.6" />
        <text x="${padding.left - 10}" y="${yPos + 4}" text-anchor="end" fill="#94a3b8"
              font-size="11px" font-family="ui-monospace, monospace">
          R$ ${Math.round(stepVal).toLocaleString('pt-BR')}
        </text>
      `;
    }

    // Draw Columns
    const slotWidth = chartWidth / barCount;
    const barWidth = Math.min(46, Math.max(22, slotWidth * 0.55));

    items.forEach((item, idx) => {
      const barHeight = (item.value / yAxisMax) * chartHeight;
      const x = padding.left + idx * slotWidth + (slotWidth - barWidth) / 2;
      const y = padding.top + chartHeight - barHeight;
      const color = item.color || '#3b82f6';
      const pctText = item.percentage !== undefined ? ` (${item.percentage.toFixed(1)}%)` : '';
      const tooltip = `${item.label}: R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${pctText}`;

      elements += `
        <g class="column-bar-group">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 2)}"
                rx="4" ry="4" fill="${color}" class="column-bar-rect">
            <title>${tooltip}</title>
          </rect>
          ${
            barHeight > 18
              ? `<text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" fill="#e2e8f0"
                       font-size="11px" font-weight="bold" font-family="ui-monospace, monospace">
                  R$ ${Math.round(item.value).toLocaleString('pt-BR')}
                </text>`
              : ''
          }
          <text x="${x + barWidth / 2}" y="${padding.top + chartHeight + 20}" text-anchor="middle"
                fill="#f1f5f9" font-size="12px" font-weight="600" font-family="ui-monospace, monospace">
            ${item.label}
          </text>
          ${
            item.percentage !== undefined
              ? `<text x="${x + barWidth / 2}" y="${padding.top + chartHeight + 36}" text-anchor="middle"
                       fill="#94a3b8" font-size="10px">
                  ${item.percentage.toFixed(1)}%
                </text>`
              : ''
          }
        </g>
      `;
    });

    const svgStyle = isScrollable
      ? `width: ${actualWidth}px; min-width: ${actualWidth}px; height: ${height}px; min-height: ${height}px; display: block; flex-shrink: 0;`
      : `width: 100%; min-width: 100%; height: ${height}px; min-height: ${height}px; display: block;`;

    return `
      <svg width="${actualWidth}" height="${height}" viewBox="0 0 ${actualWidth} ${height}" class="column-chart-svg" style="${svgStyle}">
        ${elements}
      </svg>
    `;
  }

  /**
   * Renders a vertical column/bar chart into an HTMLElement.
   */
  static render(
    items: ColumnChartItem[],
    width = 560,
    height = 280,
    minSlotWidth = 72,
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'column-chart-container';
    container.innerHTML = this.generateSvg(items, width, height, minSlotWidth);

    // Mouse wheel horizontal scroll support
    container.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY !== 0 && container.scrollWidth > container.clientWidth) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      },
      { passive: false },
    );

    return container;
  }
}
