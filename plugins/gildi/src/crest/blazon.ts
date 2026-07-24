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

export function blazonFor(seed: string): Blazon {
  const h = hashSeed(seed);
  // Draw independent choices from different byte-lanes of the hash.
  const fieldIsColour = (h & 1) === 0;
  const colour = COLOUR_KEYS[(h >>> 1) % COLOUR_KEYS.length];
  const colour2 = COLOUR_KEYS[(h >>> 4) % COLOUR_KEYS.length];
  const metal = METAL_KEYS[(h >>> 7) % METAL_KEYS.length];
  const division = DIVISIONS[(h >>> 9) % DIVISIONS.length];
  const charge = CHARGES[(h >>> 12) % CHARGES.length];
  return {
    division,
    fieldTincture: fieldIsColour ? colour : metal,
    fieldTincture2: fieldIsColour ? colour2 : metal,
    chargeTincture: fieldIsColour ? metal : colour,
    charge,
    fieldIsColour,
  };
}

export function tinctureHex(t: Tincture): string {
  return (COLOURS as Record<string, string>)[t] ?? (METALS as Record<string, string>)[t];
}
