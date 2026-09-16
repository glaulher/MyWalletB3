export interface ColumnChartItem {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
  compareValue?: number;
  compareColor?: string;
  compareLabel?: string;
}

export class ColumnChart {
  /**
   * Generates pure SVG string with coordinate calculations and horizontal scrolling support.
   * Supports both single-bar distribution and comparative dual-bars (e.g. Invested vs Market Value).
   */
  static generateSvg(
    items: ColumnChartItem[],
    width = 560,
    height = 280,
    minSlotWidth?: number,
  ): string {
    if (
      !items ||
      items.length === 0 ||
      items.every((item) => item.value <= 0 && (!item.compareValue || item.compareValue <= 0))
    ) {
      return `<div class="chart-empty">Nenhum dado para exibir no gráfico</div>`;
    }

    const hasComparison = items.some(
      (i) => i.compareValue !== undefined && i.compareValue !== null && i.compareValue > 0,
    );

    const slotWidthMin = minSlotWidth ?? (hasComparison ? 88 : 72);
    const padding = {
      top: hasComparison ? 48 : 36,
      right: 36,
      bottom: 54,
      left: 68,
    };
    const barCount = items.length;

    // Calculate dynamic total width to ensure every bar has enough room for labels without collision
    const neededWidth = padding.left + padding.right + barCount * slotWidthMin;
    const isScrollable = neededWidth > width;
    const actualWidth = Math.max(width, neededWidth);
    const chartWidth = actualWidth - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const allValues = items.flatMap((i) => [i.value, i.compareValue ?? 0]);
    const maxValue = Math.max(...allValues, 1);
    const yAxisMax = Math.ceil(maxValue * 1.15);

    let elements = '';

    // Legend when comparing values
    if (hasComparison) {
      elements += `
        <g class="chart-legend" font-size="11px" font-family="ui-monospace, monospace">
          <rect x="${padding.left}" y="16" width="10" height="10" rx="2" fill="#3b82f6" />
          <text x="${padding.left + 14}" y="25" fill="#94a3b8">Custo Investido</text>

          <rect x="${padding.left + 120}" y="16" width="10" height="10" rx="2" fill="#22c55e" />
          <text x="${padding.left + 134}" y="25" fill="#94a3b8">Valor Atual (Lucro)</text>

          <rect x="${padding.left + 265}" y="16" width="10" height="10" rx="2" fill="#ef4444" />
          <text x="${padding.left + 279}" y="25" fill="#94a3b8">Valor Atual (Prejuízo)</text>
        </g>
      `;
    }

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

    if (hasComparison) {
      // Dual bars side-by-side
      const barWidth = Math.min(26, Math.max(14, slotWidth * 0.36));
      const barGap = 4;
      const totalGroupWidth = barWidth * 2 + barGap;

      items.forEach((item, idx) => {
        const slotCenterX = padding.left + idx * slotWidth + slotWidth / 2;
        const x1 = slotCenterX - totalGroupWidth / 2;
        const x2 = x1 + barWidth + barGap;

        // Bar 1: Cost
        const barHeight1 = (item.value / yAxisMax) * chartHeight;
        const y1 = padding.top + chartHeight - barHeight1;
        const color1 = item.color || '#3b82f6';

        // Bar 2: Market Value
        const cmpVal = item.compareValue ?? 0;
        const barHeight2 = (cmpVal / yAxisMax) * chartHeight;
        const y2 = padding.top + chartHeight - barHeight2;
        const isGain = cmpVal >= item.value;
        const color2 = item.compareColor || (isGain ? '#22c55e' : '#ef4444');

        const diff = cmpVal - item.value;
        const diffPct = item.value > 0 ? (diff / item.value) * 100 : 0;
        const diffSign = diff >= 0 ? '+' : '';
        const pctColor = diff >= 0 ? '#4ade80' : '#f87171';

        const tooltip = `${item.label}\nInvestido: R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\nAtual: R$ ${cmpVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${diffSign}${diffPct.toFixed(1)}%)`;

        elements += `
          <g class="column-bar-group">
            <!-- Barra 1: Custo -->
            <rect x="${x1}" y="${y1}" width="${barWidth}" height="${Math.max(barHeight1, 2)}"
                  rx="3" ry="3" fill="${color1}" class="column-bar-rect">
              <title>${tooltip}</title>
            </rect>

            <!-- Barra 2: Atual -->
            <rect x="${x2}" y="${y2}" width="${barWidth}" height="${Math.max(barHeight2, 2)}"
                  rx="3" ry="3" fill="${color2}" class="column-bar-rect">
              <title>${tooltip}</title>
            </rect>

            <!-- Rótulo do Ativo -->
            <text x="${slotCenterX}" y="${padding.top + chartHeight + 20}" text-anchor="middle"
                  fill="#f1f5f9" font-size="12px" font-weight="600" font-family="ui-monospace, monospace">
              ${item.label}
            </text>

            <!-- % de Ganho / Perda -->
            <text x="${slotCenterX}" y="${padding.top + chartHeight + 36}" text-anchor="middle"
                  fill="${pctColor}" font-size="11px" font-weight="600">
              ${diffSign}${diffPct.toFixed(1)}%
            </text>
          </g>
        `;
      });
    } else {
      // Single bar (default)
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
    }

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
