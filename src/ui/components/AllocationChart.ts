export interface SliceData {
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#ef4444', // red
];

export class AllocationChart {
  /**
   * Renders an SVG Donut Chart with mathematical angles (2*PI*radius) and legend.
   */
  static render(slices: SliceData[], size = 260): HTMLElement {
    const container = document.createElement('div');
    container.className = 'allocation-chart-container';

    if (slices.length === 0 || slices.every((s) => s.value <= 0)) {
      container.innerHTML = `<div class="chart-empty">Nenhum dado para exibir no gráfico</div>`;
      return container;
    }

    const total = slices.reduce((acc, s) => acc + s.value, 0);
    const radius = size / 2 - 20;
    const innerRadius = radius * 0.58;
    const cx = size / 2;
    const cy = size / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'donut-chart-svg');

    let currentAngle = -Math.PI / 2; // Start from 12 o'clock

    slices.forEach((slice, idx) => {
      if (slice.value <= 0) return;

      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;
      const color = slice.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

      // Handle full circle edge case
      if (slices.length === 1 || slice.value === total) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String((radius + innerRadius) / 2));
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', String(radius - innerRadius));
        svg.appendChild(circle);
      } else {
        // Compute path coordinates
        const x1 = cx + radius * Math.cos(currentAngle);
        const y1 = cy + radius * Math.sin(currentAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);

        const x3 = cx + innerRadius * Math.cos(endAngle);
        const y3 = cy + innerRadius * Math.sin(endAngle);
        const x4 = cx + innerRadius * Math.cos(currentAngle);
        const y4 = cy + innerRadius * Math.sin(currentAngle);

        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

        const pathData = [
          `M ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
          'Z',
        ].join(' ');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', color);
        path.setAttribute('class', 'donut-slice');

        // Tooltip title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${slice.label}: R$ ${slice.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${slice.percentage.toFixed(1)}%)`;
        path.appendChild(title);

        svg.appendChild(path);
      }

      currentAngle = endAngle;
    });

    // Center label (Total text)
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('class', 'donut-center-text');

    const totalLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    totalLabel.setAttribute('x', String(cx));
    totalLabel.setAttribute('y', String(cy - 6));
    totalLabel.setAttribute('text-anchor', 'middle');
    totalLabel.setAttribute('fill', '#94a3b8');
    totalLabel.setAttribute('font-size', '11px');
    totalLabel.textContent = 'TOTAL';

    const totalValue = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    totalValue.setAttribute('x', String(cx));
    totalValue.setAttribute('y', String(cy + 14));
    totalValue.setAttribute('text-anchor', 'middle');
    totalValue.setAttribute('fill', '#f8fafc');
    totalValue.setAttribute('font-size', '14px');
    totalValue.setAttribute('font-weight', 'bold');
    totalValue.textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    textGroup.appendChild(totalLabel);
    textGroup.appendChild(totalValue);
    svg.appendChild(textGroup);

    // Build Legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';

    slices.forEach((slice, idx) => {
      const color = slice.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-badge" style="background-color: ${color}"></span>
        <span class="legend-label">${slice.label}</span>
        <span class="legend-percent">${slice.percentage.toFixed(1)}%</span>
      `;
      legend.appendChild(item);
    });

    container.appendChild(svg);
    container.appendChild(legend);

    return container;
  }
}
