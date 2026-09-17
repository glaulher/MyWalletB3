import { Asset, AssetType } from '../../core/entities/Asset.ts';
import { Operation, OperationType } from '../../core/entities/Operation.ts';
import { ImportBatch } from '../../core/entities/ImportBatch.ts';
import { Movement, MovementCategory, MovementDirection } from '../../core/entities/Movement.ts';

export interface IDatabaseAdapter {
  init(): Promise<void>;
  saveAssets(assets: Asset[]): Promise<void>;
  getAssets(): Promise<Asset[]>;
  findAssetByTicker(ticker: string): Promise<Asset | null>;
  saveOperations(operations: Operation[]): Promise<void>;
  getOperations(): Promise<Operation[]>;
  removeOperationsByBatchId(batchId: string): Promise<void>;
  removeOperation(id: string): Promise<void>;
  removeOperations(ids: string[]): Promise<void>;
  saveMovements(movements: Movement[]): Promise<void>;
  getMovements(): Promise<Movement[]>;
  removeMovementsByBatchId(batchId: string): Promise<void>;
  removeMovement(id: string): Promise<void>;
  removeMovements(ids: string[]): Promise<void>;
  saveBatch(batch: ImportBatch): Promise<void>;
  getBatches(): Promise<ImportBatch[]>;
  removeBatch(batchId: string): Promise<void>;
  clear(): Promise<void>;
}

export class AppDatabase implements IDatabaseAdapter {
  private static sharedTauriDb: unknown = null;
  private static sharedIdb: IDBDatabase | null = null;
  private static sharedIsTauri = false;
  private static initPromise: Promise<void> | null = null;
  private static writeLock: Promise<void> = Promise.resolve();

  private static async runWithWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = AppDatabase.writeLock;
    let resolveLock: () => void;
    AppDatabase.writeLock = new Promise((resolve) => {
      resolveLock = resolve;
    });

    try {
      await previous;
      return await fn();
    } finally {
      resolveLock!();
    }
  }

  private dbName = 'MyWalletB3_DB';
  private dbVersion = 4;
  private idb: IDBDatabase | null = null;
  private tauriDb: unknown = null;
  private isTauri = false;

  async init(): Promise<void> {
    if (AppDatabase.initPromise) {
      await AppDatabase.initPromise;
      this.tauriDb = AppDatabase.sharedTauriDb;
      this.idb = AppDatabase.sharedIdb;
      this.isTauri = AppDatabase.sharedIsTauri;
      return;
    }

    AppDatabase.initPromise = (async () => {
      // Check if running inside Tauri
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          this.tauriDb = await Database.load('sqlite:mywalletb3.db');
          this.isTauri = true;
          await this.initSqlite();
          await this.autoMigrateFromIndexedDBIfNeeded();
          AppDatabase.sharedTauriDb = this.tauriDb;
          AppDatabase.sharedIsTauri = true;
          return;
        } catch (e) {
          console.warn(
            'Tauri SQL plugin not available or failed to load, falling back to IndexedDB:',
            e,
          );
          this.tauriDb = null;
          this.isTauri = false;
          AppDatabase.sharedTauriDb = null;
          AppDatabase.sharedIsTauri = false;
        }
      }

      // Browser or fallback: IndexedDB
      await this.initIndexedDB();
      AppDatabase.sharedIdb = this.idb;
    })();

    await AppDatabase.initPromise;
    this.tauriDb = AppDatabase.sharedTauriDb;
    this.idb = AppDatabase.sharedIdb;
    this.isTauri = AppDatabase.sharedIsTauri;
  }

  private async autoMigrateFromIndexedDBIfNeeded(): Promise<void> {
    if (!this.isTauri || !this.tauriDb) return;
    if (typeof indexedDB === 'undefined') return;

    try {
      const db = this.tauriDb as { select: <T>(sql: string) => Promise<T[]> };
      const rows = await db.select<{ count: number }>('SELECT COUNT(*) as count FROM operations');
      const count = rows && rows[0] ? Number(rows[0].count) : 0;
      if (count > 0) {
        return;
      }

      const idb = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open(this.dbName, this.dbVersion);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (!idb) return;

      if (!idb.objectStoreNames.contains('operations')) {
        idb.close();
        return;
      }

      const ops = await new Promise<Operation[]>((resolve) => {
        try {
          const tx = idb.transaction('operations', 'readonly');
          const store = tx.objectStore('operations');
          const getReq = store.getAll();
          getReq.onsuccess = () => {
            const list = (
              getReq.result as {
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
          getReq.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });

      if (ops.length === 0) {
        idb.close();
        return;
      }

      let assets: Asset[] = [];
      if (idb.objectStoreNames.contains('assets')) {
        assets = await new Promise<Asset[]>((resolve) => {
          try {
            const tx = idb.transaction('assets', 'readonly');
            const store = tx.objectStore('assets');
            const getReq = store.getAll();
            getReq.onsuccess = () => {
              const list = (
                getReq.result as { ticker: string; type: AssetType; sector: string }[]
              ).map((r) => new Asset(r.ticker, r.type, r.sector));
              resolve(list);
            };
            getReq.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });
      }

      let batches: ImportBatch[] = [];
      if (idb.objectStoreNames.contains('batches')) {
        batches = await new Promise<ImportBatch[]>((resolve) => {
          try {
            const tx = idb.transaction('batches', 'readonly');
            const store = tx.objectStore('batches');
            const getReq = store.getAll();
            getReq.onsuccess = () => {
              const list = (
                getReq.result as {
                  id: string;
                  fileName: string;
                  importedAt: string;
                  operationCount: number;
                }[]
              ).map(
                (r) => new ImportBatch(r.id, r.fileName, new Date(r.importedAt), r.operationCount),
              );
              resolve(list);
            };
            getReq.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });
      }

      idb.close();

      if (assets.length > 0) {
        await this.saveAssets(assets);
      }
      for (const batch of batches) {
        await this.saveBatch(batch);
      }
      await this.saveOperations(ops);
      console.log(`Auto-migrated ${ops.length} operations from IndexedDB to SQLite.`);
    } catch (migrationErr) {
      console.warn('Auto-migration from IndexedDB to SQLite skipped:', migrationErr);
    }
  }

  private async initSqlite(): Promise<void> {
    if (!this.tauriDb) return;
    const db = this.tauriDb as {
      execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
    };

    try {
      await db.execute('PRAGMA journal_mode = WAL;');
      await db.execute('PRAGMA busy_timeout = 10000;');
      await db.execute('PRAGMA synchronous = NORMAL;');
    } catch (e) {
      console.warn('Could not set SQLite pragmas:', e);
    }

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
        asset_ticker TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        fees REAL NOT NULL DEFAULT 0,
        institution TEXT,
        batch_id TEXT
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS movements (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        category TEXT NOT NULL,
        direction TEXT NOT NULL,
        asset_ticker TEXT,
        raw_product TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        total_value REAL NOT NULL DEFAULT 0,
        institution TEXT,
        batch_id TEXT
      );
    `);

    // Performance Indexes to eliminate full-table scans
    try {
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_operations_asset ON operations(asset_ticker);',
      );
      await db.execute('CREATE INDEX IF NOT EXISTS idx_operations_date ON operations(date);');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_operations_batch ON operations(batch_id);');
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_movements_asset ON movements(asset_ticker);',
      );
      await db.execute('CREATE INDEX IF NOT EXISTS idx_movements_batch ON movements(batch_id);');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_batches_date ON batches(imported_at);');
    } catch {
      // ignore index creation errors
    }
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
        if (!db.objectStoreNames.contains('movements')) {
          const movStore = db.createObjectStore('movements', { keyPath: 'id' });
          movStore.createIndex('asset', 'asset', { unique: false });
          movStore.createIndex('date', 'date', { unique: false });
          movStore.createIndex('category', 'category', { unique: false });
          movStore.createIndex('batchId', 'batchId', { unique: false });
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
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        if (assets.length === 0) return;
        if (assets.length > 1) {
          await db.execute('BEGIN TRANSACTION');
        }
        try {
          const CHUNK_SIZE = 50;
          for (let i = 0; i < assets.length; i += CHUNK_SIZE) {
            const chunk = assets.slice(i, i + CHUNK_SIZE);
            const placeholders: string[] = [];
            const params: unknown[] = [];
            chunk.forEach((asset, cIdx) => {
              const base = cIdx * 3;
              placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
              params.push(asset.ticker.toUpperCase(), asset.type, asset.sector || '');
            });
            await db.execute(
              `INSERT OR REPLACE INTO assets (ticker, type, sector) VALUES ${placeholders.join(', ')}`,
              params,
            );
          }
          if (assets.length > 1) {
            await db.execute('COMMIT');
          }
        } catch (err) {
          if (assets.length > 1) {
            try {
              await db.execute('ROLLBACK');
            } catch {
              // ignore
            }
          }
          throw err;
        }
      });
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
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        await db.execute(
          'INSERT OR REPLACE INTO batches (id, file_name, imported_at, operation_count) VALUES ($1, $2, $3, $4)',
          [batch.id, batch.fileName, batch.importedAt.toISOString(), batch.operationCount],
        );
      });
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
      }>('SELECT * FROM batches ORDER BY imported_at DESC, rowid DESC');

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
          list.reverse().sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());
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
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        await db.execute('DELETE FROM batches WHERE id = $1', [batchId]);
      });
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
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        if (operations.length === 0) return;
        if (operations.length > 1) {
          await db.execute('BEGIN TRANSACTION');
        }
        try {
          const CHUNK_SIZE = 50;
          for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
            const chunk = operations.slice(i, i + CHUNK_SIZE);
            const placeholders: string[] = [];
            const params: unknown[] = [];
            chunk.forEach((op, cIdx) => {
              const base = cIdx * 9;
              placeholders.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`,
              );
              params.push(
                op.id,
                op.date.toISOString(),
                op.asset.toUpperCase(),
                op.type,
                op.quantity,
                op.unitPrice,
                op.fees,
                op.institution || '',
                op.batchId || null,
              );
            });
            await db.execute(
              `INSERT OR REPLACE INTO operations (id, date, asset_ticker, type, quantity, unit_price, fees, institution, batch_id)
               VALUES ${placeholders.join(', ')}`,
              params,
            );
          }
          if (operations.length > 1) {
            await db.execute('COMMIT');
          }
        } catch (err) {
          if (operations.length > 1) {
            try {
              await db.execute('ROLLBACK');
            } catch {
              // ignore
            }
          }
          throw err;
        }
      });
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
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        await db.execute('DELETE FROM operations WHERE batch_id = $1', [batchId]);
      });
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

  async removeOperation(id: string): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        await db.execute('DELETE FROM operations WHERE id = $1', [id]);
      });
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('operations', 'readwrite');
        const store = tx.objectStore('operations');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async removeOperations(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if (this.isTauri && this.tauriDb) {
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        // Use batch DELETE with IN ($1, $2, ...) in chunks of 100
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ');
          await db.execute(`DELETE FROM operations WHERE id IN (${placeholders})`, chunk);
        }
      });
    }

    for (const id of ids) {
      await this.removeOperation(id);
    }
  }

  async saveMovements(movements: Movement[]): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        if (movements.length === 0) return;
        if (movements.length > 1) {
          await db.execute('BEGIN TRANSACTION');
        }
        try {
          const CHUNK_SIZE = 40;
          for (let i = 0; i < movements.length; i += CHUNK_SIZE) {
            const chunk = movements.slice(i, i + CHUNK_SIZE);
            const placeholders: string[] = [];
            const params: unknown[] = [];
            chunk.forEach((mov, cIdx) => {
              const base = cIdx * 12;
              placeholders.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`,
              );
              params.push(
                mov.id,
                mov.date.toISOString(),
                mov.movementType,
                mov.category,
                mov.direction,
                mov.asset.toUpperCase(),
                mov.rawProduct,
                mov.quantity,
                mov.unitPrice,
                mov.totalValue,
                mov.institution || '',
                mov.batchId || null,
              );
            });
            await db.execute(
              `INSERT OR REPLACE INTO movements (id, date, movement_type, category, direction, asset_ticker, raw_product, quantity, unit_price, total_value, institution, batch_id)
               VALUES ${placeholders.join(', ')}`,
              params,
            );
          }
          if (movements.length > 1) {
            await db.execute('COMMIT');
          }
        } catch (err) {
          if (movements.length > 1) {
            try {
              await db.execute('ROLLBACK');
            } catch {
              // ignore
            }
          }
          throw err;
        }
      });
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('movements', 'readwrite');
        const store = tx.objectStore('movements');
        for (const mov of movements) {
          store.put({
            id: mov.id,
            date: mov.date.toISOString(),
            movementType: mov.movementType,
            category: mov.category,
            direction: mov.direction,
            asset: mov.asset.toUpperCase(),
            rawProduct: mov.rawProduct,
            quantity: mov.quantity,
            unitPrice: mov.unitPrice,
            totalValue: mov.totalValue,
            institution: mov.institution,
            batchId: mov.batchId,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async getMovements(): Promise<Movement[]> {
    if (this.isTauri && this.tauriDb) {
      const db = this.tauriDb as { select: <T>(sql: string) => Promise<T[]> };
      const rows = await db.select<{
        id: string;
        date: string;
        movement_type: string;
        category: MovementCategory;
        direction: MovementDirection;
        asset_ticker: string;
        raw_product: string;
        quantity: number;
        unit_price: number;
        total_value: number;
        institution?: string;
        batch_id?: string;
      }>('SELECT * FROM movements');

      return rows.map(
        (r) =>
          new Movement(
            r.id,
            new Date(r.date),
            r.movement_type,
            r.category,
            r.direction,
            r.asset_ticker,
            r.raw_product,
            r.quantity,
            r.unit_price,
            r.total_value,
            r.institution,
            r.batch_id,
          ),
      );
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('movements', 'readonly');
        const store = tx.objectStore('movements');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (
            req.result as {
              id: string;
              date: string;
              movementType: string;
              category: MovementCategory;
              direction: MovementDirection;
              asset: string;
              rawProduct: string;
              quantity: number;
              unitPrice: number;
              totalValue: number;
              institution?: string;
              batchId?: string;
            }[]
          ).map(
            (r) =>
              new Movement(
                r.id,
                new Date(r.date),
                r.movementType,
                r.category,
                r.direction,
                r.asset,
                r.rawProduct,
                r.quantity,
                r.unitPrice,
                r.totalValue,
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

  async removeMovementsByBatchId(batchId: string): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        await db.execute('DELETE FROM movements WHERE batch_id = $1', [batchId]);
      });
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('movements', 'readwrite');
        const store = tx.objectStore('movements');
        const req = store.getAll();
        req.onsuccess = () => {
          const movs = req.result as { id: string; batchId?: string }[];
          for (const mov of movs) {
            if (mov.batchId === batchId) {
              store.delete(mov.id);
            }
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async removeMovement(id: string): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        await db.execute('DELETE FROM movements WHERE id = $1', [id]);
      });
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction('movements', 'readwrite');
        const store = tx.objectStore('movements');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async removeMovements(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if (this.isTauri && this.tauriDb) {
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as {
          execute: (sql: string, bindParams?: unknown[]) => Promise<unknown>;
        };
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ');
          await db.execute(`DELETE FROM movements WHERE id IN (${placeholders})`, chunk);
        }
      });
    }

    for (const id of ids) {
      await this.removeMovement(id);
    }
  }

  async clear(): Promise<void> {
    if (this.isTauri && this.tauriDb) {
      return AppDatabase.runWithWriteLock(async () => {
        const db = this.tauriDb as { execute: (sql: string) => Promise<unknown> };
        await db.execute('DELETE FROM operations');
        await db.execute('DELETE FROM movements');
        await db.execute('DELETE FROM batches');
        await db.execute('DELETE FROM assets');
      });
    }

    if (this.idb) {
      return new Promise((resolve, reject) => {
        const tx = this.idb!.transaction(
          ['assets', 'operations', 'movements', 'batches'],
          'readwrite',
        );
        tx.objectStore('assets').clear();
        tx.objectStore('operations').clear();
        if (tx.objectStoreNames.contains('movements')) {
          tx.objectStore('movements').clear();
        }
        if (tx.objectStoreNames.contains('batches')) {
          tx.objectStore('batches').clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }
}
