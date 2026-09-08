// Medals are DERIVED from how many applicable trials pass, never assigned to
// named rungs in the standard. Gold always means "everything applicable
// passes", so an aspect is complete at any size — a one-trial standard awards
// gold for that trial. Assigned tiers could not do this: they produced medals
// no component had a path to, and every new trial had to be slotted into a rung
// by hand. See ADR 0013.
export const MEDALS = ['gold', 'silver', 'bronze', 'none'] as const;

export type Medal = (typeof MEDALS)[number];

// A run arrives at the frontend over HTTP, where the type says nothing about
// what actually came back. Casting a `string` to `Medal` at that boundary would
// let a serialisation bug reach the UI as a medal that does not exist, and the
// compiler would have signed off on it.
export function isMedal(value: unknown): value is Medal {
  return typeof value === 'string' && (MEDALS as readonly string[]).includes(value);
}

export function medalFor(applicable: number, passing: number): Medal {
  // Nothing applicable is `none`, not a vacuous gold: an aspect that asked
  // nothing of this component has awarded it nothing.
  if (applicable <= 0 || passing <= 0) return 'none';
  // Clamp rather than fall through. A caller passing more than it declared
  // applicable is miscounting, and letting that land on `silver` would dress
  // the bug up as a real verdict.
  if (passing >= applicable) return 'gold';
  if (passing === applicable - 1) return 'silver';
  return 'bronze';
}
