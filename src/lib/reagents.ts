/**
 * Registry ingestion and colour matching.
 *
 * The import is deliberately forgiving about shape and strict about colour: a
 * missing lot number is fine, a malformed hex is not, because the hex is the
 * only field the matching actually depends on.
 */

import type { ReagentColorState, ReagentMatch, ReagentProfile } from '../types';
import { deltaE2000, hexToRgb, rgbToLab } from './color';
import type { Lab } from './color';

export interface ImportIssue {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  reagents: ReagentProfile[];
  issues: ImportIssue[];
}

const HEX = /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i;

function normaliseHex(value: unknown): string | null {
  if (typeof value !== 'string' || !HEX.test(value.trim())) return null;
  let hex = value.trim().replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return `#${hex.toLowerCase()}`;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[;,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseColorStates(value: unknown, fallbackAnalyte: string, row: number, issues: ImportIssue[]): ReagentColorState[] {
  if (!Array.isArray(value)) return [];
  const states: ReagentColorState[] = [];
  value.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    const e = entry as Record<string, unknown>;
    const hex = normaliseHex(e.hex ?? e.hexColor ?? e.color);
    if (!hex) {
      issues.push({
        row,
        field: `colorStates[${i}].hex`,
        message: 'Skipped: colour is missing or not a hex value.',
      });
      return;
    }
    states.push({
      label: String(e.label ?? e.name ?? `State ${i + 1}`),
      hex,
      analyte: String(e.analyte ?? e.drug ?? fallbackAnalyte),
      atSeconds: Number.isFinite(Number(e.atSeconds)) ? Number(e.atSeconds) : undefined,
      notes: e.notes ? String(e.notes) : undefined,
    });
  });
  return states;
}

export function normaliseReagent(
  raw: unknown,
  index: number,
  issues: ImportIssue[]
): ReagentProfile | null {
  if (!raw || typeof raw !== 'object') {
    issues.push({ row: index + 1, field: '-', message: 'Entry is not an object.' });
    return null;
  }
  const r = raw as Record<string, unknown>;
  const name = String(r.name ?? r.reagent ?? '').trim();
  if (!name) {
    issues.push({ row: index + 1, field: 'name', message: 'Entry has no reagent name.' });
    return null;
  }

  const analytes = toStringArray(r.targetAnalytes ?? r.analytes ?? r.targets ?? r.drugs);
  const colorStates = parseColorStates(
    r.colorStates ?? r.colours ?? r.colors ?? r.reactions,
    analytes[0] ?? name,
    index + 1,
    issues
  );

  const primaryHex =
    normaliseHex(r.hexColor ?? r.hex ?? r.color) ?? colorStates[0]?.hex ?? null;

  if (!primaryHex) {
    issues.push({
      row: index + 1,
      field: 'hexColor',
      message: `"${name}" has no usable colour, so it cannot be matched against a photo.`,
    });
  }

  return {
    id: String(r.id ?? `rg-${Date.now().toString(36)}-${index}`),
    name,
    chemicalMatrix: String(r.chemicalMatrix ?? r.matrix ?? r.composition ?? '').trim(),
    targetAnalytes: analytes.length ? analytes : ['Unspecified'],
    reactionColor: String(r.reactionColor ?? r.colorShift ?? colorStates[0]?.label ?? '').trim(),
    hexColor: primaryHex ?? '#000000',
    colorStates,
    blankHex: normaliseHex(r.blankHex ?? r.negativeHex ?? r.blank),
    absorbancePeakNm: Number(r.absorbancePeakNm ?? r.peakNm ?? r.lambdaMax) || 0,
    slotNumber: String(r.slotNumber ?? ''),
    lotNumber: String(r.lotNumber ?? r.lot ?? '—'),
    expirationDate: String(r.expirationDate ?? r.expiry ?? '—'),
    tempLimitC: String(r.tempLimitC ?? r.storage ?? '—'),
    status: primaryHex ? 'active' : 'uncommitted',
    description: String(r.description ?? r.notes ?? '').trim(),
    colourStateCount: colorStates.length,
    source: 'import',
    addedAt: new Date().toISOString(),
  };
}

export function parseRegistryJson(text: string): ImportResult {
  const issues: ImportIssue[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Not valid JSON — ${(err as Error).message}`);
  }

  // Accepts a bare array, or an object with a `reagents` key, which is what
  // most people produce when they wrap a dataset with metadata.
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.reagents)
      ? ((parsed as Record<string, unknown>).reagents as unknown[])
      : null;

  if (!list) {
    throw new Error('Expected an array of reagents, or an object with a "reagents" array.');
  }

  const reagents = list
    .map((item, i) => normaliseReagent(item, i, issues))
    .filter((r): r is ReagentProfile => r !== null);

  return { reagents, issues };
}

export function parseRegistryCsv(text: string): ImportResult {
  const rows = splitCsv(text.trim());
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one data row.');

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
  const issues: ImportIssue[] = [];

  const reagents = rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim()))
    .map((cells, i) => {
      const obj: Record<string, unknown> = {};
      header.forEach((key, col) => {
        obj[key] = cells[col]?.trim() ?? '';
      });
      return normaliseReagent(
        {
          name: obj.name ?? obj.reagent,
          chemicalMatrix: obj.chemicalmatrix ?? obj.matrix,
          targetAnalytes: obj.targetanalytes ?? obj.analytes ?? obj.drugs,
          reactionColor: obj.reactioncolor ?? obj.colorshift,
          hexColor: obj.hexcolor ?? obj.hex ?? obj.color,
          blankHex: obj.blankhex ?? obj.blank,
          absorbancePeakNm: obj.absorbancepeaknm ?? obj.peaknm,
          lotNumber: obj.lotnumber ?? obj.lot,
          expirationDate: obj.expirationdate ?? obj.expiry,
          tempLimitC: obj.templimitc ?? obj.storage,
          description: obj.description ?? obj.notes,
        },
        i,
        issues
      );
    })
    .filter((r): r is ReagentProfile => r !== null);

  return { reagents, issues };
}

/** Handles quoted fields containing commas, which a naive split does not. */
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

export interface MatchOptions {
  /** Only consider states belonging to this reagent, when the officer named one. */
  reagentId?: string | null;
  limit?: number;
}

/**
 * Ranks every colour state in the registry against a measured Lab value.
 *
 * When the officer has told us which reagent they used, states from other
 * reagents are excluded rather than down-weighted. Marquis violet and
 * Mandelin violet are metres apart in the real world and millimetres apart in
 * Lab space; guessing between them helps nobody.
 */
export function matchColour(
  measured: Lab,
  reagents: ReagentProfile[],
  { reagentId = null, limit = 4 }: MatchOptions = {}
): ReagentMatch[] {
  const pool = reagentId ? reagents.filter((r) => r.id === reagentId) : reagents;
  const matches: ReagentMatch[] = [];

  for (const reagent of pool) {
    const states: ReagentColorState[] = reagent.colorStates.length
      ? reagent.colorStates
      : [
          {
            label: reagent.reactionColor || reagent.name,
            hex: reagent.hexColor,
            analyte: reagent.targetAnalytes[0] ?? 'Unspecified',
          },
        ];

    for (const state of states) {
      const rgb = hexToRgb(state.hex);
      if (!rgb) continue;
      matches.push({
        reagentId: reagent.id,
        reagentName: reagent.name,
        analyte: state.analyte || state.label,
        deltaE: deltaE2000(measured, rgbToLab(rgb)),
        referenceHex: state.hex,
      });
    }
  }

  return matches.sort((a, b) => a.deltaE - b.deltaE).slice(0, limit);
}

/**
 * Plain-language reading of a ΔE00 figure. Deliberately not a percentage —
 * a colour distance is not a probability, and presenting it as one is how a
 * defence lawyer takes the whole tool apart.
 */
export function describeMatch(deltaE: number | null): { label: string; detail: string } {
  if (deltaE === null) return { label: 'Not compared', detail: 'No reference colour available.' };
  if (deltaE < 2) return { label: 'Very close', detail: 'Indistinguishable from the reference by eye.' };
  if (deltaE < 5) return { label: 'Close', detail: 'Difference is noticeable side by side.' };
  if (deltaE < 10) return { label: 'Approximate', detail: 'Same colour family, clearly different shade.' };
  if (deltaE < 20) return { label: 'Weak', detail: 'Related hue, large difference.' };
  return { label: 'No match', detail: 'Measured colour is unrelated to the reference.' };
}

export const REGISTRY_TEMPLATE = `[
  {
    "name": "Marquis",
    "chemicalMatrix": "Formaldehyde in concentrated H2SO4",
    "targetAnalytes": ["Methamphetamine", "MDMA", "Heroin"],
    "blankHex": "#e8e2d4",
    "absorbancePeakNm": 562,
    "lotNumber": "LOT-0001",
    "expirationDate": "2027-06-30",
    "tempLimitC": "4-25",
    "description": "Read at 60 seconds under diffuse light.",
    "colorStates": [
      { "label": "Orange to brown", "analyte": "Methamphetamine", "hex": "#8a4a1f", "atSeconds": 60 },
      { "label": "Purple to black", "analyte": "MDMA", "hex": "#2b1533", "atSeconds": 60 },
      { "label": "Deep purple", "analyte": "Heroin", "hex": "#3a1b46", "atSeconds": 60 }
    ]
  }
]`;
