/**
 * Intentionally empty.
 *
 * The registry starts with nothing in it. Reference colours are evidence, and
 * shipping invented ones would mean a reading could be "matched" against a
 * number nobody measured. Load the real data through Reagents → Import.
 */

import type { ReagentProfile, TestRecord } from '../types';

export const INITIAL_TEST_RECORDS: TestRecord[] = [];
export const SEED_REAGENTS: ReagentProfile[] = [];
