/**
 * Persistence.
 *
 * The app talks to a `Store`. Two implementations ship:
 *
 *   LocalStore  - IndexedDB in the browser. Survives refresh, close, reboot and
 *                 flight mode. Zero setup. This is the default and it is not a
 *                 placeholder: offline-first is the correct architecture when
 *                 the user is standing at a checkpost with one bar of signal.
 *
 *   RemoteStore - HTTP against the Express server in /server. Turn it on by
 *                 setting VITE_API_BASE. Records already on the device are
 *                 pushed on the next sync; nothing is lost if the server is
 *                 down.
 *
 * Photos are stored as Blobs, not base64 data URLs. Base64 is 33% larger and
 * IndexedDB handles Blobs natively, which matters once an officer has a few
 * hundred cases with two 4MB photos each.
 */

import type { ReagentProfile, Shot, TestRecord } from '../types';

const DB_NAME = 'drugtrace';
const DB_VERSION = 1;

export interface Store {
  listRecords(): Promise<TestRecord[]>;
  saveRecord(record: TestRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  listReagents(): Promise<ReagentProfile[]>;
  saveReagents(reagents: ReagentProfile[]): Promise<void>;
  clearReagents(): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) {
        const records = db.createObjectStore('records', { keyPath: 'id' });
        records.createIndex('sequence', 'sequence');
      }
      if (!db.objectStoreNames.contains('reagents')) {
        db.createObjectStore('reagents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
    req.onblocked = () => reject(new Error('Database upgrade blocked by another open tab'));
  });
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let request: IDBRequest<T> | void;
        try {
          request = fn(store);
        } catch (err) {
          tx.abort();
          db.close();
          reject(err);
          return;
        }
        tx.oncomplete = () => {
          db.close();
          resolve(request ? request.result : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('Transaction aborted'));
        };
      })
  );
}

export class LocalStore implements Store {
  async listRecords(): Promise<TestRecord[]> {
    const all = (await run<TestRecord[]>('records', 'readonly', (s) => s.getAll())) ?? [];
    return all.sort((a, b) => b.sequence - a.sequence);
  }

  async saveRecord(record: TestRecord): Promise<void> {
    await run('records', 'readwrite', (s) => s.put(record));
  }

  async deleteRecord(id: string): Promise<void> {
    await run('records', 'readwrite', (s) => s.delete(id));
  }

  async listReagents(): Promise<ReagentProfile[]> {
    const all = (await run<ReagentProfile[]>('reagents', 'readonly', (s) => s.getAll())) ?? [];
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveReagents(reagents: ReagentProfile[]): Promise<void> {
    await run('reagents', 'readwrite', (s) => {
      for (const r of reagents) s.put(r);
    });
  }

  async clearReagents(): Promise<void> {
    await run('reagents', 'readwrite', (s) => s.clear());
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const value = await run<T>('settings', 'readonly', (s) => s.get(key));
    return value ?? null;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await run('settings', 'readwrite', (s) => s.put(value, key));
  }
}

/**
 * Blobs do not survive JSON. Shots are sent as multipart so the server keeps
 * the original bytes and the record keeps referencing them by id.
 */
export class RemoteStore implements Store {
  constructor(private base: string, private fallback: Store = new LocalStore()) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
  }

  async listRecords(): Promise<TestRecord[]> {
    try {
      const rows = await this.request<Array<Omit<TestRecord, 'shots'> & { shots: Array<Omit<Shot, 'blob'> & { url: string }> }>>(
        '/api/records'
      );
      return Promise.all(
        rows.map(async (row) => ({
          ...row,
          shots: await Promise.all(
            row.shots.map(async ({ url, ...shot }) => ({
              ...shot,
              blob: await fetch(`${this.base}${url}`).then((r) => r.blob()),
            }))
          ),
        }))
      );
    } catch {
      return this.fallback.listRecords();
    }
  }

  async saveRecord(record: TestRecord): Promise<void> {
    // Always land it locally first. If the network drops mid-save the officer
    // still has the record and the sync button will retry.
    await this.fallback.saveRecord(record);

    const form = new FormData();
    const { shots, ...meta } = record;
    form.set(
      'record',
      JSON.stringify({ ...meta, shots: shots.map(({ blob, ...rest }) => rest) })
    );
    for (const shot of shots) {
      form.append('photos', shot.blob, `${shot.id}.jpg`);
    }
    await this.request('/api/records', { method: 'POST', body: form });
    await this.fallback.saveRecord({ ...record, synced: true });
  }

  async deleteRecord(id: string): Promise<void> {
    await this.fallback.deleteRecord(id);
    await this.request(`/api/records/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  async listReagents(): Promise<ReagentProfile[]> {
    try {
      return await this.request<ReagentProfile[]>('/api/reagents');
    } catch {
      return this.fallback.listReagents();
    }
  }

  async saveReagents(reagents: ReagentProfile[]): Promise<void> {
    await this.fallback.saveReagents(reagents);
    await this.request('/api/reagents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reagents),
    }).catch(() => undefined);
  }

  async clearReagents(): Promise<void> {
    await this.fallback.clearReagents();
    await this.request('/api/reagents', { method: 'DELETE' }).catch(() => undefined);
  }

  getSetting<T>(key: string) {
    return this.fallback.getSetting<T>(key);
  }

  setSetting<T>(key: string, value: T) {
    return this.fallback.setSetting(key, value);
  }
}

const apiBase = import.meta.env?.VITE_API_BASE as string | undefined;

export const store: Store = apiBase ? new RemoteStore(apiBase.replace(/\/$/, '')) : new LocalStore();

export const usingRemoteStore = Boolean(apiBase);

/**
 * Ask the browser to keep this origin's data out of the eviction queue. Without
 * it, IndexedDB is "best effort" and Safari in particular will bin it after
 * seven days of no visits.
 */
export async function requestDurableStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function storageUsage(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMb: usage / 1048576, quotaMb: quota / 1048576 };
}
