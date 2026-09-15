export interface TabItem {
  id: string;
  label: string;
  icon: string;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

export class TabBar {
  static render(props: TabBarProps): HTMLElement {
    const nav = document.createElement('nav');
    nav.className = 'tab-navigation';

    props.tabs.forEach((tab) => {
      const button = document.createElement('button');
      const isActive = tab.id === props.activeTabId;
      button.className = `tab-button ${isActive ? 'tab-active selected' : ''}`;
      button.dataset.tabId = tab.id;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');

      button.innerHTML = `
        <span class="tab-icon">${tab.icon}</span>
        <span class="tab-label">${tab.label}</span>
      `;

      button.addEventListener('click', () => {
        if (button.classList.contains('tab-active')) return;

        nav.querySelectorAll('.tab-button').forEach((b) => {
          b.classList.remove('tab-active');
          b.classList.remove('selected');
          b.setAttribute('aria-selected', 'false');
        });
        button.classList.add('tab-active');
        button.classList.add('selected');
        button.setAttribute('aria-selected', 'true');
        props.onTabChange(tab.id);
      });

      nav.appendChild(button);
    });

    return nav;
  }
}
