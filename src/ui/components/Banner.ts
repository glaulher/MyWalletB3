export type BannerType = 'info' | 'success' | 'error' | 'warning';

export interface BannerProps {
  message: string;
  type?: BannerType;
  id?: string;
  icon?: string;
  className?: string;
}

export class Banner {
  static generateHtml(props: BannerProps): string {
    const typeClass = `status-${props.type || 'info'}`;
    const idAttr = props.id ? `id="${props.id}"` : '';
    const iconSpan = props.icon ? `<span class="banner-icon">${props.icon}</span> ` : '';

    return `
      <div ${idAttr} class="status-banner ${typeClass} ${props.className || ''}">
        ${iconSpan}${props.message}
      </div>
    `.trim();
  }

  static render(props: BannerProps): HTMLElement {
    const el = document.createElement('div');
    const typeClass = `status-${props.type || 'info'}`;
    el.className = `status-banner ${typeClass} ${props.className || ''}`.trim();
    if (props.id) el.id = props.id;

    if (props.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'banner-icon';
      iconSpan.innerHTML = props.icon;
      el.appendChild(iconSpan);
    }

    const textNode = document.createTextNode(props.message);
    el.appendChild(textNode);

    return el;
  }
}
