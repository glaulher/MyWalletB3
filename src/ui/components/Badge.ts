export type BadgeVariant =
  | 'stock'
  | 'fii'
  | 'fi-infra'
  | 'bdr'
  | 'unit'
  | 'option'
  | 'buy'
  | 'sell'
  | 'info'
  | 'success'
  | 'danger'
  | 'warning'
  | 'secondary';

export interface BadgeProps {
  label: string;
  variant: BadgeVariant;
  className?: string;
}

export class Badge {
  static generateHtml(props: BadgeProps): string {
    const variantClass = this.getVariantClass(props.variant);
    const customClass = props.className || '';
    return `<span class="badge ${variantClass} ${customClass}">${props.label}</span>`;
  }

  static render(props: BadgeProps): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = `badge ${this.getVariantClass(props.variant)} ${props.className || ''}`.trim();
    span.textContent = props.label;
    return span;
  }

  private static getVariantClass(variant: BadgeVariant): string {
    switch (variant) {
      case 'stock':
        return 'badge-type-stock';
      case 'fii':
        return 'badge-type-fii';
      case 'fi-infra':
        return 'badge-type-fi-infra';
      case 'bdr':
        return 'badge-type-bdr';
      case 'unit':
        return 'badge-type-unit';
      case 'option':
        return 'badge-type-option';
      case 'buy':
        return 'badge-buy';
      case 'sell':
        return 'badge-sell';
      case 'info':
        return 'badge-info';
      case 'success':
        return 'badge-buy';
      case 'danger':
        return 'badge-sell';
      case 'warning':
        return 'badge-warning';
      case 'secondary':
      default:
        return 'badge-secondary';
    }
  }
}
