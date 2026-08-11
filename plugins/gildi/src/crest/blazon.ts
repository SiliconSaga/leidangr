import { hashSeed } from './hash';

export const COLOURS = { gules: '#a83a3a', azure: '#2f5fa0', vert: '#3a7a4a', sable: '#2b2b30', purpure: '#6b3a6b' } as const;
export const METALS = { or: '#d9b23a', argent: '#dcdce0' } as const;
export type Tincture = keyof typeof COLOURS | keyof typeof METALS;
export type Division = 'plain' | 'perPale' | 'perFess' | 'perBend';
export type Charge = 'key' | 'chevron' | 'mullet' | 'roundel' | 'cross';
export interface Blazon {
  division: Division;
  fieldTincture: Tincture;   // the field (may be two tinctures for divided fields; second derives)
  fieldTincture2: Tincture;
  chargeTincture: Tincture;
  charge: Charge;
  fieldIsColour: boolean;    // true → charge is a metal (rule of tincture)
}

const COLOUR_KEYS = Object.keys(COLOURS) as (keyof typeof COLOURS)[];
const METAL_KEYS = Object.keys(METALS) as (keyof typeof METALS)[];
const DIVISIONS: Division[] = ['plain', 'perPale', 'perFess', 'perBend'];
const CHARGES: Charge[] = ['key', 'chevron', 'mullet', 'roundel', 'cross'];

/**
 * A second tincture guaranteed to differ from the first, drawn from the same
 * class so the field keeps its colour-or-metal identity and the rule of
 * tincture still decides the charge.
 *
 * Offsetting into the remaining keys rather than drawing a second independent
 * index is what makes a repeat unrepresentable instead of merely unlikely. The
 * independent draw collided on 60% of divided crests — every metal field, since
 * both halves read the same single metal, plus one colour field in five — and a
 * division painted in one tincture just renders as a plain field.
 */
function pickOther<T>(keys: readonly T[], firstIdx: number, raw: number): T {
  if (keys.length < 2) return keys[firstIdx];
  return keys[(firstIdx + 1 + (raw % (keys.length - 1))) % keys.length];
}

export function blazonFor(seed: string): Blazon {
  const h = hashSeed(seed);
  // Draw independent choices from different byte-lanes of the hash.
  const fieldIsColour = (h & 1) === 0;
  const colourIdx = (h >>> 1) % COLOUR_KEYS.length;
  const metalIdx = (h >>> 7) % METAL_KEYS.length;
  const colour = COLOUR_KEYS[colourIdx];
  const metal = METAL_KEYS[metalIdx];
  const colour2 = pickOther(COLOUR_KEYS, colourIdx, h >>> 4);
  const metal2 = pickOther(METAL_KEYS, metalIdx, h >>> 16);
  const division = DIVISIONS[(h >>> 9) % DIVISIONS.length];
  const charge = CHARGES[(h >>> 12) % CHARGES.length];
  return {
    division,
    fieldTincture: fieldIsColour ? colour : metal,
    fieldTincture2: fieldIsColour ? colour2 : metal2,
    chargeTincture: fieldIsColour ? metal : colour,
    charge,
    fieldIsColour,
  };
}

export function tinctureHex(t: Tincture): string {
  return (COLOURS as Record<string, string>)[t] ?? (METALS as Record<string, string>)[t];
}
