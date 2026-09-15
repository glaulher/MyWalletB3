export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';
export type ButtonSize = 'small' | 'normal' | 'large';

export interface ButtonProps {
  label: string;
  icon?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  id?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  selected?: boolean;
  onClick?: (e: MouseEvent) => void;
}

export class Button {
  static generateHtml(props: ButtonProps): string {
    const variantClass = `btn-${props.variant || 'primary'}`;
    const sizeClass =
      props.size === 'large' ? 'btn-large' : props.size === 'small' ? 'btn-small' : '';
    const selectedClass = props.selected ? 'btn-selected' : '';
    const selectedAttr = props.selected ? 'aria-selected="true"' : '';
    const idAttr = props.id ? `id="${props.id}"` : '';
    const titleAttr = props.title ? `title="${props.title}"` : '';
    const disabledAttr = props.disabled ? 'disabled' : '';
    const iconSpan = props.icon ? `<span class="btn-icon">${props.icon}</span>` : '';
    const customClass = props.className || '';

    return `
      <button ${idAttr} class="btn ${variantClass} ${sizeClass} ${selectedClass} ${customClass}" ${titleAttr} ${disabledAttr} ${selectedAttr}>
        ${iconSpan}
        <span>${props.label}</span>
      </button>
    `.trim();
  }

  static render(props: ButtonProps): HTMLButtonElement {
    const button = document.createElement('button');
    const variantClass = `btn-${props.variant || 'primary'}`;
    const sizeClass =
      props.size === 'large' ? 'btn-large' : props.size === 'small' ? 'btn-small' : '';
    const selectedClass = props.selected ? 'btn-selected' : '';

    button.className =
      `btn ${variantClass} ${sizeClass} ${selectedClass} ${props.className || ''}`.trim();
    if (props.id) button.id = props.id;
    if (props.title) button.title = props.title;
    if (props.disabled) button.disabled = true;
    if (props.selected) button.setAttribute('aria-selected', 'true');

    if (props.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'btn-icon';
      iconSpan.textContent = props.icon;
      button.appendChild(iconSpan);
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = props.label;
    button.appendChild(textSpan);

    if (props.onClick) {
      button.addEventListener('click', props.onClick);
    }

    return button;
  }
}
