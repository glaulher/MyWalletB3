import { DashboardController } from './core/controllers/DashboardController.ts';
import { DashboardView } from './ui/views/DashboardView.ts';

window.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    throw new Error('Root #app container not found.');
  }

  const controller = new DashboardController();
  const view = new DashboardView(appContainer, controller);
  view.render();
});
