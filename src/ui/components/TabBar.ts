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
      button.className = `tab-button ${isActive ? 'tab-active' : ''}`;
      button.dataset.tabId = tab.id;

      button.innerHTML = `
        <span class="tab-icon">${tab.icon}</span>
        <span class="tab-label">${tab.label}</span>
      `;

      button.addEventListener('click', () => {
        if (button.classList.contains('tab-active')) return;

        nav.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('tab-active'));
        button.classList.add('tab-active');
        props.onTabChange(tab.id);
      });

      nav.appendChild(button);
    });

    return nav;
  }
}
