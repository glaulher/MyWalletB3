import { DashboardController } from './core/controllers/DashboardController.ts';
import { DashboardView } from './ui/views/DashboardView.ts';
import { PersistentOperationRepository } from './infrastructure/repositories/PersistentOperationRepository.ts';
import { PersistentAssetRepository } from './infrastructure/repositories/PersistentAssetRepository.ts';
import { PersistentMovementRepository } from './infrastructure/repositories/PersistentMovementRepository.ts';

async function bootstrap(): Promise<void> {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('Root #app container not found.');
    return;
  }

  try {
    const operationRepo = new PersistentOperationRepository();
    const assetRepo = new PersistentAssetRepository();
    const movementRepo = new PersistentMovementRepository();
    const controller = new DashboardController(operationRepo, assetRepo, movementRepo);
    const view = new DashboardView(appContainer, controller);
    await view.render();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    appContainer.innerHTML = `
      <div style="padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ef4444; max-width: 640px; margin: 60px auto; background: #fff; border-radius: 12px; border: 1px solid #fca5a5; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
        <h2 style="margin-top: 0; color: #b91c1c; font-size: 20px;">Erro ao inicializar o aplicativo</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">Ocorreu uma falha durante o carregamento inicial da aplicação no desktop:</p>
        <pre style="background: #fef2f2; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: #991b1b; border: 1px solid #fee2e2;">${
          error instanceof Error ? error.stack || error.message : String(error)
        }</pre>
        <button onclick="window.location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px;">
          Tentar novamente
        </button>
      </div>
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap();
  });
} else {
  bootstrap();
}
