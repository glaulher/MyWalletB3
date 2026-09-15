import { Asset, AssetType } from '../../core/entities/Asset.ts';
import { Operation, OperationType } from '../../core/entities/Operation.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';

export interface IDatabaseAdapter {
  init(): Promise<void>;
  saveAssets(assets: Asset[]): Promise<void>;
  getAssets(): Promise<Asset[]>;
  findAssetByTicker(ticker: string): Promise<Asset | null>;
  saveOperations(operations: Operation[]): Promise<void>;
  getOperations(): Promise<Operation[]>;
  removeOperationsByBatchId(batchId: string): Promise<void>;
  saveBatch(batch: ImportBatch): Promise<void>;
  getBatches(): Promise<ImportBatch[]>;
  removeBatch(batchId: string): Promise<void>;
  clear(): Promise<void>;
}

export class AppDatabase implements IDatabaseAdapter {
  private dbName = 'MyWalletB3_DB';
  private dbVersion = 2;
  private idb: IDBDatabase | null = null;
  private tauriDb: unknown = null;
  private isTauri = false;

  async init(): Promise<void> {
    // Check if running inside Tauri
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const Database = (await import('@tauri-apps/plugin-sql')).default;
        this.tauriDb = await Database.load('sqlite:mywalletb3.db');
        this.isTauri = true;
        await this.initSqlite();
        return;
      } catch (e) {
        console.warn(
          'Tauri SQL plugin not available or failed to load, falling back to IndexedDB:',
          e,
        );
      }
    }

    // Browser or fallback: IndexedDB
    await this.initIndexedDB();
  }

  private async initSqlite(): Promise<void> {
    if (!this.tauriDb) return;
    const db = this.tauriDb as {
      execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
    };
    await db.execute(`
      CREATE TABLE IF NOT EXISTS assets (
        ticker TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        sector TEXT
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        operation_count INTEGER NOT NULL
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        asset_ticker TEXT NOT NULL REFERENCES assets(ticker),
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        fees REAL NOT NULL DEFAULT 0,
        institution TEXT,
        batch_id TEXT REFERENCES batches(id)
      );
    `);
  }

  private async initIndexedDB(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'ticker' });
        }
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('operations')) {
          const opStore = db.createObjectStore('operations', { keyPath: 'id' });
          opStore.createIndex('asset', 'asset', { unique: false });
          opStore.createIndex('date', 'date', { unique: false });
          opStore.createIndex('batchId', 'batchId', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.idb = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async saveAssets(assets: Asset[]): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as {
        execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
      };
      for (const asset of assets) {
        await db.execute(
          'INSERT OR REPLACE INTO assets (ticker, type, sector) VALUES ($1, $2, $3)',
          [asset.ticker.toUpperCase(), asset.type, asset.sector || ''],
        );
      }
      return;
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('assets', 'readwrite');
        const store = tx.objectStore('assets');
        for (const asset of assets) {
          store.put({
            ticker: asset.ticker.toUpperCase(),
            type: asset.type,
            sector: asset.sector,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async getAssets(): Promise<Asset[]> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as { select: <T>(sql: string) => Promise<T[]> };
      const rows = await db.select<{ ticker: string; type: AssetType; sector: string }>(
        'SELECT * FROM assets',
      );
      return rows.map((r) => new Asset(r.ticker, r.type, r.sector));
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('assets', 'readonly');
        const store = tx.objectStore('assets');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result as { ticker: string; type: AssetType; sector: string }[]).map(
            (r) => new Asset(r.ticker, r.type, r.sector),
          );
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    return [];
  }

  async findAssetByTicker(ticker: string): Promise<Asset | null> {
    const assets = await this.getAssets();
    return assets.find((a) => a.ticker.toUpperCase() === ticker.toUpperCase()) || null;
  }

  async saveBatch(batch: ImportBatch): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as {
        execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
      };
      await db.execute(
        'INSERT OR REPLACE INTO batches (id, file_name, imported_at, operation_count) VALUES ($1, $2, $3, $4)',
        [batch.id, batch.fileName, batch.importedAt.toISOString(), batch.operationCount],
      );
      return;
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('batches', 'readwrite');
        const store = tx.objectStore('batches');
        store.put({
          id: batch.id,
          fileName: batch.fileName,
          importedAt: batch.importedAt.toISOString(),
          operationCount: batch.operationCount,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async getBatches(): Promise<ImportBatch[]> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as { select: <T>(sql: string) => Promise<T[]> };
      const rows = await db.select<{
        id: string;
        file_name: string;
        imported_at: string;
        operation_count: number;
      }>('SELECT * FROM batches ORDER BY imported_at DESC');

      return rows.map(
        (r) => new ImportBatch(r.id, r.file_name, new Date(r.imported_at), r.operation_count),
      );
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('batches', 'readonly');
        const store = tx.objectStore('batches');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (
            req.result as {
              id: string;
              fileName: string;
              importedAt: string;
              operationCount: number;
            }[]
          ).map((r) => new ImportBatch(r.id, r.fileName, new Date(r.importedAt), r.operationCount));
          list.sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    return [];
  }

  async removeBatch(batchId: string): Promise<void> {
    await this.removeOperationsByBatchId(batchId);

    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as {
        execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
      };
      await db.execute('DELETE FROM batches WHERE id = $1', [batchId]);
      return;
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('batches', 'readwrite');
        const store = tx.objectStore('batches');
        store.delete(batchId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async saveOperations(operations: Operation[]): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as {
        execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
      };
      for (const op of operations) {
        await db.execute(
          `INSERT OR REPLACE INTO operations (id, date, asset_ticker, type, quantity, unit_price, fees, institution, batch_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            op.id,
            op.date.toISOString(),
            op.asset.toUpperCase(),
            op.type,
            op.quantity,
            op.unitPrice,
            op.fees,
            op.institution || '',
            op.batchId || '',
          ],
        );
      }
      return;
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('operations', 'readwrite');
        const store = tx.objectStore('operations');
        for (const op of operations) {
          store.put({
            id: op.id,
            date: op.date.toISOString(),
            asset: op.asset.toUpperCase(),
            type: op.type,
            quantity: op.quantity,
            unitPrice: op.unitPrice,
            fees: op.fees,
            institution: op.institution,
            batchId: op.batchId,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async getOperations(): Promise<Operation[]> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as { select: <T>(sql: string) => Promise<T[]> };
      const rows = await db.select<{
        id: string;
        date: string;
        asset_ticker: string;
        type: OperationType;
        quantity: number;
        unit_price: number;
        fees: number;
        institution?: string;
        batch_id?: string;
      }>('SELECT * FROM operations');

      return rows.map(
        (r) =>
          new Operation(
            r.id,
            new Date(r.date),
            r.asset_ticker,
            r.type,
            r.quantity,
            r.unit_price,
            r.fees,
            r.institution,
            r.batch_id,
          ),
      );
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('operations', 'readonly');
        const store = tx.objectStore('operations');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (
            req.result as {
              id: string;
              date: string;
              asset: string;
              type: OperationType;
              quantity: number;
              unitPrice: number;
              fees: number;
              institution?: string;
              batchId?: string;
            }[]
          ).map(
            (r) =>
              new Operation(
                r.id,
                new Date(r.date),
                r.asset,
                r.type,
                r.quantity,
                r.unitPrice,
                r.fees,
                r.institution,
                r.batchId,
              ),
          );
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    return [];
  }

  async removeOperationsByBatchId(batchId: string): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as {
        execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
      };
      await db.execute('DELETE FROM operations WHERE batch_id = $1', [batchId]);
      return;
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('operations', 'readwrite');
        const store = tx.objectStore('operations');
        const req = store.getAll();
        req.onsuccess = () => {
          const ops = req.result as { id: string; batchId?: string }[];
          for (const op of ops) {
            if (op.batchId === batchId) {
              store.delete(op.id);
            }
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async clear(): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as { execute: (sql: string) => Promise<unknown> };
      await db.execute('DELETE FROM operations');
      await db.execute('DELETE FROM batches');
      await db.execute('DELETE FROM assets');
      return;
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction(['assets', 'operations', 'batches'], 'readwrite');
        tx.objectStore('assets').clear();
        tx.objectStore('operations').clear();
        if (tx.objectStoreNames.contains('batches')) {
          tx.objectStore('batches').clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }
}
