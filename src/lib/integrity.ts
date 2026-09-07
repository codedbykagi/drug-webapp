/**
 * Tamper evidence.
 *
 * Each record is hashed over its own canonical form plus the raw bytes of every
 * photo attached to it, and that hash is folded into the next record. Change
 * one pixel of an old photo and every hash after it stops matching, which is
 * something you can demonstrate on stage in about ten seconds.
 *
 * This is integrity, not authenticity. It proves the file has not been edited
 * since it was written; it does not prove who wrote it. For that you need a
 * signing key held somewhere the officer cannot reach, which is a server-side
 * problem. See docs/architecture.md.
 */

import type { TestRecord } from '../types';

export const GENESIS_HASH = '0'.repeat(64);

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256(bytes: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

/**
 * Key order has to be stable or the hash is meaningless, so we build the
 * canonical string by hand rather than trusting JSON.stringify's insertion
 * order.
 */
function canonicalise(record: Omit<TestRecord, 'sha256Hash'>): string {
  const fields: Array<[string, unknown]> = [
    ['id', record.id],
    ['sequence', record.sequence],
    ['previousHash', record.previousHash],
    ['createdAt', record.createdAt],
    ['officerName', record.officerName],
    ['officerBadge', record.officerBadge],
    ['designation', record.designation],
    ['stationUnit', record.stationUnit],
    ['reason', record.reason],
    ['reagentName', record.reagentName],
    ['reagentId', record.reagentId],
    ['suspectedDrug', record.suspectedDrug],
    ['identifiedSubstance', record.identifiedSubstance],
    ['status', record.status],
    ['hexColor', record.hexColor],
    ['cieLab', [record.cieLab.L, record.cieLab.a, record.cieLab.b]],
    ['deltaE', record.deltaE],
    ['notes', record.notes],
    ['gps', record.geo ? [record.geo.latitude, record.geo.longitude, record.geo.accuracyM] : null],
    [
      'shots',
      record.shots.map((s) => [s.id, s.stage, s.capturedAt, s.source, s.measurement?.hex ?? null]),
    ],
  ];
  return fields.map(([k, v]) => `${k}=${JSON.stringify(v ?? null)}`).join('\n');
}

export async function hashRecord(record: Omit<TestRecord, 'sha256Hash'>): Promise<string> {
  const encoder = new TextEncoder();
  const header = encoder.encode(canonicalise(record));

  const photoBytes = await Promise.all(record.shots.map((s) => s.blob.arrayBuffer()));
  const totalPhotoLength = photoBytes.reduce((n, b) => n + b.byteLength, 0);

  const combined = new Uint8Array(header.byteLength + totalPhotoLength);
  combined.set(header, 0);
  let offset = header.byteLength;
  for (const buf of photoBytes) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  return sha256(combined);
}

export interface ChainVerification {
  intact: boolean;
  brokenAt: string | null;
  checked: number;
}

/** Re-hashes every record in order and reports the first one that disagrees. */
export async function verifyChain(records: TestRecord[]): Promise<ChainVerification> {
  const ordered = [...records].sort((a, b) => a.sequence - b.sequence);
  let expectedPrevious = GENESIS_HASH;

  for (const record of ordered) {
    if (record.previousHash !== expectedPrevious) {
      return { intact: false, brokenAt: record.id, checked: ordered.length };
    }
    const { sha256Hash, ...rest } = record;
    if ((await hashRecord(rest)) !== sha256Hash) {
      return { intact: false, brokenAt: record.id, checked: ordered.length };
    }
    expectedPrevious = record.sha256Hash;
  }

  return { intact: true, brokenAt: null, checked: ordered.length };
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}
