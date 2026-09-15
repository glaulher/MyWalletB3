export interface KpiCardProps {
  title: string;
  value: string;
  icon: string;
  subtext?: string;
  className?: string;
}

export class KpiCard {
  static generateHtml(props: KpiCardProps): string {
    const subtextHtml = props.subtext ? `<div class="kpi-subtext">${props.subtext}</div>` : '';
    return `
      <div class="kpi-card ${props.className || ''}">
        <div class="kpi-header">
          <span class="kpi-title">${props.title}</span>
          <span class="kpi-icon">${props.icon}</span>
        </div>
        <div class="kpi-value">${props.value}</div>
        ${subtextHtml}
      </div>
    `.trim();
  }

  static render(props: KpiCardProps): HTMLElement {
    const el = document.createElement('div');
    el.className = `kpi-card ${props.className || ''}`.trim();
    el.innerHTML = `
      <div class="kpi-header">
        <span class="kpi-title">${props.title}</span>
        <span class="kpi-icon">${props.icon}</span>
      </div>
      <div class="kpi-value">${props.value}</div>
      ${props.subtext ? `<div class="kpi-subtext">${props.subtext}</div>` : ''}
    `;
    return el;
  }
}
