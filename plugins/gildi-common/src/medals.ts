// Medals are DERIVED from how many applicable trials pass, never assigned to
// named rungs in the standard. Gold always means "everything applicable
// passes", so an aspect is complete at any size — a one-trial standard awards
// gold for that trial. Assigned tiers could not do this: they produced medals
// no component had a path to, and every new trial had to be slotted into a rung
// by hand. See ADR 0013.
export type Medal = 'gold' | 'silver' | 'bronze' | 'none';

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
