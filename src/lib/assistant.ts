/**
 * Offline reagent assistant.
 *
 * There is no language model here and that is the design, not a shortcut. The
 * useful work in a retrieval-augmented system is the retrieval; a model only
 * rephrases what retrieval already found. Since every answer this thing can
 * give is a fact copied out of a registry entry, the phrasing can be a template
 * and the result is a system that runs on a five-year-old phone in aeroplane
 * mode, answers instantly, and cannot invent a colour that nobody measured.
 *
 * Everything it knows comes from the JSON loaded on the registry page. Load
 * nothing, it knows nothing, and it says so.
 */

import { deltaE2000, hexToRgb, rgbToLab } from './color';
import type { Lab } from './color';
import type { ReagentProfile } from '../types';

export type AnswerKind =
  | 'reagent'
  | 'analyte'
  | 'colour'
  | 'expiry'
  | 'overview'
  | 'search'
  | 'empty'
  | 'unknown';

export interface AnswerRow {
  reagent: string;
  analyte: string;
  colourLabel: string;
  hex: string | null;
  detail?: string;
}

export interface Answer {
  kind: AnswerKind;
  /** One or two sentences. Assembled from registry fields, never generated. */
  summary: string;
  rows: AnswerRow[];
  /** Which registry entries this came from, so the officer can check. */
  sources: string[];
  followups: string[];
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'be', 'can', 'do', 'does', 'for', 'from', 'get', 'give', 'gives',
  'how', 'i', 'if', 'in', 'is', 'it', 'like', 'look', 'looks', 'me', 'my', 'of', 'on', 'or',
  'reagent', 'result', 'show', 'tell', 'test', 'that', 'the', 'this', 'to', 'use', 'used',
  'using', 'what', 'when', 'which', 'will', 'with', 'you',
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Trigram overlap, for typo tolerance. Officers type "methamphetemine" and
 * "marquee" on a phone keyboard in the rain; exact matching would fail them
 * constantly and there is no model here to paper over it.
 */
function trigrams(s: string): Set<string> {
  const padded = `  ${s.toLowerCase()} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = trigrams(a);
  const B = trigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Trigram score alone is not safe for drug names. "ketamine" and
 * "methamphetamine" share six trigrams and score just over 0.45, so a naive
 * threshold answers a question about ketamine with a methamphetamine entry —
 * confidently wrong about a substance that is not even loaded, which is the
 * exact failure this whole design exists to avoid.
 *
 * So a fuzzy hit additionally has to look like the same word: either the query
 * token appears inside the candidate, or the two share a real prefix. Genuine
 * typos keep their prefix ("methamphetemine", "marquee"); unrelated drugs that
 * merely rhyme do not.
 */
function bestMatch(tokens: string[], candidates: string[], floor = 0.42): { value: string; score: number } | null {
  let best: { value: string; score: number } | null = null;

  const consider = (value: string, score: number) => {
    if (score >= floor && (!best || score > best.score)) best = { value, score };
  };

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    for (const token of tokens) {
      if (lower.includes(token) && token.length >= 4) {
        consider(candidate, 0.9);
        continue;
      }
      const prefix = commonPrefix(token, lower);
      if (prefix >= 3 || lower.split(/\s+/).some((word) => commonPrefix(token, word) >= 3)) {
        consider(candidate, similarity(token, lower));
      }
    }
    const joined = tokens.join(' ');
    if (commonPrefix(joined, lower) >= 3) consider(candidate, similarity(joined, lower));
  }
  return best;
}

const COLOUR_WORDS: Record<string, string> = {
  red: '#c62828', crimson: '#b71c1c', orange: '#ef6c00', amber: '#ff8f00',
  yellow: '#f9a825', olive: '#827717', green: '#2e7d32', teal: '#00796b',
  cyan: '#0097a7', blue: '#1565c0', navy: '#0d47a1', cobalt: '#1a3f9e',
  indigo: '#283593', purple: '#6a1b9a', violet: '#4a148c', magenta: '#ad1457',
  pink: '#d81b60', brown: '#5d4037', black: '#111111', grey: '#808080',
  gray: '#808080', white: '#f5f5f5', colourless: '#f0ede4', clear: '#f0ede4',
};

interface StateRef {
  reagent: ReagentProfile;
  label: string;
  analyte: string;
  hex: string;
  lab: Lab | null;
  atSeconds?: number;
}

/** Flattens the registry into one row per reference colour, which is the unit everything queries against. */
function flatten(reagents: ReagentProfile[]): StateRef[] {
  const out: StateRef[] = [];
  for (const reagent of reagents) {
    const states = reagent.colorStates.length
      ? reagent.colorStates
      : [{ label: reagent.reactionColor || 'Reference colour', hex: reagent.hexColor, analyte: reagent.targetAnalytes[0] ?? 'Unspecified' }];
    for (const state of states) {
      const rgb = hexToRgb(state.hex);
      out.push({
        reagent,
        label: state.label,
        analyte: state.analyte || state.label,
        hex: state.hex,
        lab: rgb ? rgbToLab(rgb) : null,
        atSeconds: 'atSeconds' in state ? state.atSeconds : undefined,
      });
    }
  }
  return out;
}

function daysUntil(dateish: string): number | null {
  const t = Date.parse(dateish);
  return Number.isNaN(t) ? null : Math.round((t - Date.now()) / 86400000);
}

function row(state: StateRef): AnswerRow {
  return {
    reagent: state.reagent.name,
    analyte: state.analyte,
    colourLabel: state.label,
    hex: state.hex,
    detail: state.atSeconds ? `read at ${state.atSeconds}s` : undefined,
  };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function ask(rawQuery: string, reagents: ReagentProfile[]): Answer {
  const query = rawQuery.trim();

  if (!reagents.length) {
    return {
      kind: 'empty',
      summary:
        'Nothing is loaded yet. This assistant only reports what is in the reagent registry, so import your data sheet on the Reagents page first.',
      rows: [],
      sources: [],
      followups: [],
    };
  }
  if (!query) {
    return overview(reagents);
  }

  const tokens = tokenise(query);
  const states = flatten(reagents);
  const lower = query.toLowerCase();

  if (/expir|expiry|out of date|shelf|old|valid/.test(lower)) return expiry(reagents);
  if (/how many|what.*(have|loaded)|overview|summar/.test(lower)) return overview(reagents);

  // Colour word queries: "what turns purple", "what else looks blue". Answered
  // by distance in Lab space against every reference colour, which reuses the
  // same maths the matching engine runs on real photos.
  const colourWord = tokens.find((t) => t in COLOUR_WORDS);
  if (colourWord) {
    const target = rgbToLab(hexToRgb(COLOUR_WORDS[colourWord])!);
    const near = states
      .filter((s) => s.lab)
      .map((s) => ({ s, d: deltaE2000(target, s.lab!) }))
      .filter((x) => x.d < 32)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);

    if (near.length) {
      return {
        kind: 'colour',
        summary: `${plural(near.length, 'entry', 'entries')} in the registry sit near ${colourWord}, closest first. Distances are ΔE2000, the same measure used to score a photograph.`,
        rows: near.map(({ s, d }) => ({ ...row(s), detail: `ΔE ${d.toFixed(1)}` })),
        sources: [...new Set(near.map((x) => x.s.reagent.name))],
        followups: near.slice(0, 2).map((x) => `Tell me about ${x.s.reagent.name}`),
      };
    }
  }

  // Named reagent, e.g. "what does Marquis do".
  const reagentHit = bestMatch(tokens, reagents.map((r) => r.name));
  // Named substance, e.g. "how do I test for heroin".
  const analyteHit = bestMatch(tokens, [...new Set(states.map((s) => s.analyte))]);

  // Prefer whichever matched more strongly; a tie goes to the analyte, since
  // "what detects X" is the more common field question than "describe X".
  if (analyteHit && (!reagentHit || analyteHit.score >= reagentHit.score)) {
    const matches = states.filter((s) => s.analyte === analyteHit.value);
    return {
      kind: 'analyte',
      summary:
        matches.length === 1
          ? `One reagent in the registry covers ${analyteHit.value}.`
          : `${plural(matches.length, 'reagent')} in the registry cover ${analyteHit.value}. Colours differ, so confirm which reagent was used before reading the result.`,
      rows: matches.map(row),
      sources: [...new Set(matches.map((m) => m.reagent.name))],
      followups: [
        `What else looks like ${matches[0].label.toLowerCase()}?`,
        `Tell me about ${matches[0].reagent.name}`,
      ],
    };
  }

  if (reagentHit) {
    const reagent = reagents.find((r) => r.name === reagentHit.value)!;
    const matches = states.filter((s) => s.reagent.id === reagent.id);
    const days = daysUntil(reagent.expirationDate);
    const bits = [
      reagent.chemicalMatrix ? `Composition: ${reagent.chemicalMatrix}.` : '',
      `Covers ${reagent.targetAnalytes.join(', ')}.`,
      days !== null && days < 0 ? `This lot expired ${Math.abs(days)} days ago.` : '',
      reagent.description,
    ].filter(Boolean);

    return {
      kind: 'reagent',
      summary: bits.join(' '),
      rows: matches.map(row),
      sources: [reagent.name],
      followups: matches.slice(0, 2).map((m) => `What else detects ${m.analyte}?`),
    };
  }

  // Fall back to scoring every entry on token overlap across all its text.
  const scored = states
    .map((s) => {
      const haystack = [
        s.reagent.name, s.analyte, s.label, s.reagent.chemicalMatrix,
        s.reagent.description, s.reagent.targetAnalytes.join(' '),
      ].join(' ').toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : similarity(t, haystack) * 0.2), 0);
      return { s, score };
    })
    .filter((x) => x.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length) {
    return {
      kind: 'search',
      summary: `No exact reagent or substance matched, so here are the closest ${plural(scored.length, 'entry', 'entries')} by keyword.`,
      rows: scored.map((x) => row(x.s)),
      sources: [...new Set(scored.map((x) => x.s.reagent.name))],
      followups: [],
    };
  }

  return {
    kind: 'unknown',
    summary: `Nothing in the registry matches that. This assistant only reports loaded data — it will not guess. Registry holds ${plural(reagents.length, 'reagent')} covering ${[...new Set(states.map((s) => s.analyte))].slice(0, 6).join(', ')}.`,
    rows: [],
    sources: [],
    followups: ['What do we have loaded?', 'Anything expired?'],
  };
}

function overview(reagents: ReagentProfile[]): Answer {
  const states = flatten(reagents);
  const analytes = [...new Set(states.map((s) => s.analyte))];
  const unmatched = reagents.filter((r) => r.status === 'uncommitted');

  return {
    kind: 'overview',
    summary: `${plural(reagents.length, 'reagent')} loaded with ${plural(states.length, 'reference colour')}, covering ${plural(analytes.length, 'substance')}.${
      unmatched.length ? ` ${plural(unmatched.length, 'entry', 'entries')} lack a usable colour and cannot be matched against a photo.` : ''
    }`,
    rows: reagents.slice(0, 8).map((r) => ({
      reagent: r.name,
      analyte: r.targetAnalytes.join(', '),
      colourLabel: r.colorStates.length ? plural(r.colorStates.length, 'colour') : r.reactionColor || '—',
      hex: r.hexColor,
    })),
    sources: reagents.map((r) => r.name),
    followups: analytes.slice(0, 2).map((a) => `How do I test for ${a}?`),
  };
}

function expiry(reagents: ReagentProfile[]): Answer {
  const dated = reagents
    .map((r) => ({ r, days: daysUntil(r.expirationDate) }))
    .filter((x): x is { r: ReagentProfile; days: number } => x.days !== null)
    .sort((a, b) => a.days - b.days);

  if (!dated.length) {
    return {
      kind: 'expiry',
      summary: 'No entry in the registry carries an expiry date, so nothing can be checked. Add expirationDate to the data sheet if you want this tracked.',
      rows: [],
      sources: [],
      followups: [],
    };
  }

  const bad = dated.filter((x) => x.days <= 60);
  return {
    kind: 'expiry',
    summary: bad.length
      ? `${plural(bad.filter((x) => x.days < 0).length, 'reagent')} expired and ${bad.filter((x) => x.days >= 0).length} due within 60 days. An expired reagent gives the wrong colour, not no colour, so a reading from one can look convincing and still be wrong.`
      : `All ${plural(dated.length, 'dated reagent')} are in date. Earliest expiry is in ${dated[0].days} days.`,
    rows: (bad.length ? bad : dated.slice(0, 5)).map(({ r, days }) => ({
      reagent: r.name,
      analyte: r.targetAnalytes.join(', '),
      colourLabel: days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d remaining`,
      hex: r.hexColor,
      detail: r.lotNumber !== '—' ? `lot ${r.lotNumber}` : undefined,
    })),
    sources: (bad.length ? bad : dated).map((x) => x.r.name),
    followups: [],
  };
}

/** Suggested prompts, built from whatever is actually loaded. */
export function starters(reagents: ReagentProfile[]): string[] {
  if (!reagents.length) return [];
  const states = flatten(reagents);
  const analyte = states[0]?.analyte;
  return [
    'What do we have loaded?',
    analyte ? `How do I test for ${analyte}?` : 'What turns purple?',
    reagents[0] ? `Tell me about ${reagents[0].name}` : 'What turns blue?',
    'Anything expired?',
  ].filter(Boolean);
}
