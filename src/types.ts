import type { CalibrationProfile } from './lib/calibration';
import type { Lab, RGB } from './lib/color';

export type { CalibrationProfile, Lab, RGB };

export type ScreenView = 'intake' | 'registry' | 'ops';

export type CaptureStage = 'before' | 'after';

export interface SamplePoint {
  /** Normalised 0..1 so the point survives resizing and re-encoding. */
  x: number;
  y: number;
}

export interface Measurement {
  raw: RGB;
  corrected: RGB;
  hex: string;
  lab: Lab;
  point: SamplePoint;
  /** Interquartile luma spread across the sample window. High means unreliable. */
  spread: number;
  correctedBy: 'in-frame reference' | 'stored profile' | 'none';
}

export interface Shot {
  id: string;
  stage: CaptureStage;
  blob: Blob;
  width: number;
  height: number;
  source: 'camera' | 'upload';
  capturedAt: string;
  /** Reference patch located inside this specific frame, if the officer set one. */
  neutralPoint: SamplePoint | null;
  calibration: CalibrationProfile | null;
  measurement: Measurement | null;
}

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracyM: number;
  altitudeM: number | null;
  capturedAt: string;
}

export interface ReagentMatch {
  reagentId: string;
  reagentName: string;
  analyte: string;
  deltaE: number;
  referenceHex: string;
}

export interface TestRecord {
  id: string;
  /** Local case reference, e.g. DT-2026-0001. Generated on save. */
  caseRef: string;
  timestampUtc: string;
  createdAt: string;

  officerName: string;
  officerBadge: string;
  designation: string;
  stationUnit: string;
  reason: string;

  reagentName: string;
  reagentId: string | null;
  suspectedDrug: string;
  identifiedSubstance: string;
  status: 'positive' | 'negative' | 'inconclusive';
  /** Human-readable match quality. No fabricated percentages. */
  certainty: string;
  colorShift: string;
  hexColor: string;
  cieLab: Lab;
  wavelengthPeakNm: number;
  deltaE: number | null;
  matches: ReagentMatch[];

  notes: string;
  gpsCoords: string;
  geo: GeoFix | null;

  shots: Shot[];
  calibrationSummary: string;

  /** SHA-256 over the canonical record plus every image byte. */
  sha256Hash: string;
  /** Hash of the record filed immediately before this one. */
  previousHash: string;
  sequence: number;

  locked: boolean;
  synced: boolean;
}

export interface ReagentColorState {
  label: string;
  hex: string;
  analyte: string;
  /** Seconds after application at which this colour is read. */
  atSeconds?: number;
  notes?: string;
}

export interface ReagentProfile {
  id: string;
  name: string;
  chemicalMatrix: string;
  targetAnalytes: string[];
  reactionColor: string;
  hexColor: string;
  /** Optional multi-state colour scale. This is what matching really runs on. */
  colorStates: ReagentColorState[];
  blankHex: string | null;
  /** Substances documented to give no colour change. A negative here proves nothing. */
  nonReactive: string[];
  absorbancePeakNm: number;
  /** Free-text kit position, if the department numbers its slots. Usually blank. */
  slotNumber: string;
  lotNumber: string;
  expirationDate: string;
  tempLimitC: string;
  status: 'active' | 'expiring' | 'uncommitted';
  description: string;
  /** How many reference colours this entry carries. */
  colourStateCount: number;
  source: 'manual' | 'import';
  addedAt: string;
}

export interface CalibrationData {
  calibrated: boolean;
  scorePercent: number;
  colorTempK: number;
  luxIlluminance: number;
  deltaETolerance: number;
  lastCalibratedUtc: string;
  macroLockAligned: boolean;
  profile: CalibrationProfile | null;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  icon?: string;
}
