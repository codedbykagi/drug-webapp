/**
 * DrugTrace sync server.
 *
 * The browser is the source of truth while an officer is in the field; this is
 * where records land once there is a network. It deliberately does very little:
 * store what it is given, hand it back, and never rewrite it.
 *
 *   npm run server        -> http://localhost:8787
 *
 * Then point the frontend at it by setting VITE_API_BASE in .env.local and
 * restarting Vite.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? path.join(here, 'data');
const photoDir = path.join(dataDir, 'photos');
fs.mkdirSync(photoDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'drugtrace.db'));

// WAL so a read during a write does not block, which matters the moment two
// officers sync at once.
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS records (
    id           TEXT PRIMARY KEY,
    sequence     INTEGER NOT NULL,
    case_ref     TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    officer_name TEXT,
    status       TEXT,
    sha256       TEXT NOT NULL,
    prev_sha256  TEXT NOT NULL,
    payload      TEXT NOT NULL,
    received_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id        TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    stage     TEXT NOT NULL,
    filename  TEXT NOT NULL,
    sha256    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reagents (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS records_sequence ON records(sequence);
  CREATE INDEX IF NOT EXISTS photos_record ON photos(record_id);
`);

const app = express();
app.use(express.json({ limit: '2mb' }));

// The officer's phone and this server are rarely the same origin during a
// demo, so CORS is permissive. Lock it to your own origin before this touches
// anything real.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/**
 * Minimal multipart reader. The frontend sends one JSON part named "record"
 * and N image parts named "photos"; pulling in multer for two field names is
 * not worth the dependency.
 */
function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const type = req.headers['content-type'] ?? '';
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
    if (!match) return reject(new Error('Not a multipart request'));
    const boundary = Buffer.from(`--${match[1] ?? match[2]}`);

    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const parts = [];
      let cursor = body.indexOf(boundary);

      while (cursor !== -1) {
        const start = cursor + boundary.length;
        if (body.slice(start, start + 2).toString() === '--') break;
        const next = body.indexOf(boundary, start);
        if (next === -1) break;

        const raw = body.slice(start + 2, next - 2);
        const split = raw.indexOf('\r\n\r\n');
        if (split !== -1) {
          const headers = raw.slice(0, split).toString();
          const name = /name="([^"]+)"/i.exec(headers)?.[1];
          if (name) parts.push({ name, content: raw.slice(split + 4) });
        }
        cursor = next;
      }
      resolve(parts);
    });
  });
}

app.get('/api/health', (_req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM records').get();
  res.json({ ok: true, records: count });
});

app.get('/api/records', (_req, res) => {
  const rows = db.prepare('SELECT payload FROM records ORDER BY sequence DESC').all();
  const photos = db.prepare('SELECT record_id, id, filename FROM photos').all();

  res.json(
    rows.map((row) => {
      const record = JSON.parse(row.payload);
      const files = photos.filter((p) => p.record_id === record.id);
      return {
        ...record,
        shots: (record.shots ?? []).map((shot) => ({
          ...shot,
          url: `/api/photos/${files.find((f) => f.id === shot.id)?.filename ?? ''}`,
        })),
      };
    })
  );
});

app.post('/api/records', async (req, res) => {
  try {
    const parts = await readMultipart(req);
    const meta = parts.find((p) => p.name === 'record');
    if (!meta) return res.status(400).json({ error: 'Missing "record" part' });

    const record = JSON.parse(meta.content.toString('utf8'));
    if (!record.id || !record.sha256Hash) {
      return res.status(400).json({ error: 'Record needs an id and a sha256Hash' });
    }

    // Records are append-only. A resend of one we already hold is a successful
    // no-op rather than an overwrite, which is what makes retrying a failed
    // sync safe.
    const seen = db.prepare('SELECT sha256 FROM records WHERE id = ?').get(record.id);
    if (seen) {
      return res.status(seen.sha256 === record.sha256Hash ? 200 : 409).json({
        stored: seen.sha256 === record.sha256Hash,
        error: seen.sha256 === record.sha256Hash ? undefined : 'Record exists with a different hash',
      });
    }

    const images = parts.filter((p) => p.name === 'photos');
    db.prepare(
      `INSERT INTO records (id, sequence, case_ref, created_at, officer_name, status, sha256, prev_sha256, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      record.sequence ?? 0,
      record.cjisRef ?? '',
      record.createdAt ?? new Date().toISOString(),
      record.officerName ?? '',
      record.status ?? '',
      record.sha256Hash,
      record.previousHash ?? '',
      JSON.stringify(record),
      new Date().toISOString()
    );

    const insertPhoto = db.prepare(
      'INSERT INTO photos (id, record_id, stage, filename, sha256) VALUES (?, ?, ?, ?, ?)'
    );
    images.forEach((image, i) => {
      const shot = record.shots?.[i];
      const id = shot?.id ?? `${record.id}-${i}`;
      const filename = `${id}.jpg`;
      fs.writeFileSync(path.join(photoDir, filename), image.content);
      insertPhoto.run(
        id,
        record.id,
        shot?.stage ?? 'unknown',
        filename,
        crypto.createHash('sha256').update(image.content).digest('hex')
      );
    });

    res.status(201).json({ stored: true, photos: images.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/photos/:filename', (req, res) => {
  // basename() so a crafted filename cannot walk out of the photo directory.
  const file = path.join(photoDir, path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.sendStatus(404);
  res.type('image/jpeg').sendFile(file);
});

app.delete('/api/records/:id', (req, res) => {
  db.prepare('DELETE FROM records WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

app.get('/api/reagents', (_req, res) => {
  res.json(db.prepare('SELECT payload FROM reagents ORDER BY name').all().map((r) => JSON.parse(r.payload)));
});

app.post('/api/reagents', (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [req.body];
  const upsert = db.prepare(
    'INSERT INTO reagents (id, name, payload) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload = excluded.payload'
  );
  for (const reagent of list) {
    if (reagent?.id) upsert.run(reagent.id, reagent.name ?? '', JSON.stringify(reagent));
  }
  res.json({ stored: list.length });
});

app.delete('/api/reagents', (_req, res) => {
  db.prepare('DELETE FROM reagents').run();
  res.json({ cleared: true });
});

/**
 * Re-walks the chain server-side. Useful in a demo: file three cases, edit one
 * photo on disk, hit this endpoint and watch it name the broken record.
 */
app.get('/api/verify', (_req, res) => {
  const rows = db.prepare('SELECT id, sha256, prev_sha256 FROM records ORDER BY sequence ASC').all();
  const photos = db.prepare('SELECT record_id, filename, sha256 FROM photos').all();

  let expected = '0'.repeat(64);
  for (const row of rows) {
    if (row.prev_sha256 !== expected) {
      return res.json({ intact: false, brokenAt: row.id, reason: 'chain link mismatch' });
    }
    for (const photo of photos.filter((p) => p.record_id === row.id)) {
      const file = path.join(photoDir, photo.filename);
      if (!fs.existsSync(file)) {
        return res.json({ intact: false, brokenAt: row.id, reason: `missing photo ${photo.filename}` });
      }
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (actual !== photo.sha256) {
        return res.json({ intact: false, brokenAt: row.id, reason: `photo ${photo.filename} was modified` });
      }
    }
    expected = row.sha256;
  }
  res.json({ intact: true, checked: rows.length });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, '0.0.0.0', () => {
  console.log(`drugtrace sync server on http://0.0.0.0:${port}`);
  console.log(`database: ${path.join(dataDir, 'drugtrace.db')}`);
});
