import { genPageTheme, shapes, type PageTheme } from '@backstage/theme';

// Custom page themes for the guildhall entity `spec.type` values, composed the
// same way Backstage composes its built-in `pageTheme` map. A regal-purple
// family: practice deeper, aspect lighter — they differ in lightness (not just
// hue) so they stay distinguishable at a glance and in grayscale, with white
// heading/tile text on both. `getPageTheme({ themeId })` keys on `spec.type`,
// so these colour the practice/aspect page headers and Ownership tiles.
// NOTE ON KEYS: `EntityLayout` resolves a page theme with
// `themeId: entity?.spec?.type ?? 'home'` — it reads **spec.type only** and
// never the kind. So every key below must match a literal `spec.type` value in
// the catalog, and an entity with no `spec.type` gets `home` (teal #005B4B) no
// matter what is registered here. That is why the Domain and System carry an
// explicit `spec.type`: without one they are unthemeable.
export const guildhallPageThemes: Record<string, PageTheme> = {
  // --- Practice layer: the Guildhall's own vocabulary. Saturated purples.
  //
  // guild: the central fellowship — a royal, magenta-leaning purple, also used
  // for the Guild Hall hub page.
  //
  // The three step monotonically in lightness — practice L* 13/23, guild 30/38,
  // aspect 46/56 — which also reads as depth: the practice underneath, the
  // fellowship, then the aspect as the lightest leaf.
  //
  // That ramp is load-bearing, not decorative. `practice` first shipped as
  // #4527A0 → #5E35B1, one step off guild in lightness and differing from it in
  // the red channel alone (69 against 106, with green and blue within six
  // counts). Red is exactly what protanopia deletes, so the two headers measured
  // ΔE 3.8 and 4.4 at their stops — the same bar twice for ~1% of men.
  //
  // Two escapes were measured and rejected. Conventional indigos score *worse*
  // (Material 800/600: ΔE 5.2) because they keep the mid red that causes the
  // collapse. A vivid one that empties the red channel does clear guild, but
  // lands on Backstage's own `tool` (#3E00EA, ΔE 3.4) and near `website`, which
  // this catalog renders today — the blue-violet corner is already spoken for.
  //
  // Going darker is what was actually available. This aubergine clears ΔE 24.9
  // against guild under protanopia and 17.6 against everything else defined,
  // ours and Backstage's alike, at 16:1 contrast with white.
  guild: genPageTheme({ colors: ['#6A1B9A', '#8E24AA'], shape: shapes.wave }),
  practice: genPageTheme({ colors: ['#380454', '#541A6C'], shape: shapes.round }),
  aspect: genPageTheme({ colors: ['#7E57C2', '#9575CD'], shape: shapes.wave2 }),

  // --- Instance structure: what the instance is *made of*, rather than what it
  // teaches. Deliberately the same hue family with the saturation pulled out —
  // these are the substrate the practice layer runs on, so they read as kin but
  // stay quieter than the three above. Graded light (broad) to deep (concrete).
  //
  // Chosen against the full palette rather than in isolation: the violet band
  // 255-285 already holds guild/practice/aspect plus Backstage's unused `tool`,
  // and `website` ends on a deep violet, so hue alone had no room left.
  // Desaturation is the axis with clearance.
  // community leaves the purple family on purpose — it is the only member of
  // this tier that had to, and the swatch report is what proved it.
  //
  // As a purple it collided with `service` at ΔE 3 under protanopia, and
  // `service` is the most-used type in the catalog. The cause is structural:
  // red-green deficiency preserves the blue-yellow axis, and purple reads as
  // blue once red is removed — exactly where `service` already sits. A
  // replacement purple could not fix it, and measuring one confirmed that: a
  // plum candidate landed ΔE 2 from `plugin` under protanopia.
  //
  // A yellow-leaning colour separates on the axis that survives. This muted
  // clay clears every simulation against every shipped colour, and an earthy
  // ground suits the Domain the rest of the catalog sits inside. Its earlier
  // form (#7A6E94 → #A79BC2) also failed white header text at ~2.5:1.
  community: genPageTheme({ colors: ['#7A5450', '#9C726C'], shape: shapes.wave2 }),
  instance: genPageTheme({ colors: ['#37304A', '#574B70'], shape: shapes.wave }),

  // plugin keeps a known, accepted collision: it reads within ΔE 10 of
  // Backstage's `documentation` magenta under protanopia. Nothing renders that
  // type today, so the swatch report files it as dormant — and files it as live
  // by itself the day an entity claims `spec.type: documentation`, which is the
  // signal to revisit rather than a reason to pre-empt.
  //
  // It is accepted because the alternative costs more than it buys, and that was
  // measured across ~43k candidates rather than assumed. The binding constraint
  // is lightness, not hue: clearing every collision in this palette requires
  // L* ≈ 50/62, and a second stop that light gives white text only ~3.0:1 — the
  // bare WCAG large-text floor, on a colour that also tints Ownership tiles
  // whose text is smaller than that bar was written for. Hold contrast at 4:1
  // and NOTHING clears ΔE 14, at any hue or saturation. Steel blue and olive
  // both hit the same wall; olive at a usable contrast scores 12.2 against this
  // violet's 13.7, so leaving the family buys nothing either.
  //
  // Trading a third of the contrast — which every reader pays — for a
  // distinction ~1% of men would draw between two docs-adjacent page types is
  // the wrong side of that bargain.
  plugin: genPageTheme({ colors: ['#4E4361', '#7C6E96'], shape: shapes.round }),

  // --- Bounded efforts: the Cycle types. Warm, against the cool practice and
  // instance tiers, because a Cycle is the thing with a clock on it — it reads
  // as activity rather than structure.
  //
  // Amber through gold rather than orange proper: Backstage's `app` already
  // holds vermilion (#BE2200) and `library` holds ruby (#98002B), so hues below
  // ~20 are spoken for.
  //
  // Separated by LIGHTNESS, not hue. The first cut of these three sat at one
  // lightness and differed only along red-green, and `make theme-swatches`
  // measured drive against season at ΔE 1.0 under protanopia — indistinguishable
  // for ~1% of men, with deuteranopia barely better. Hue is the wrong axis for a
  // warm family precisely because warm hues are what red-green deficiency
  // flattens. Lightness survives every simulation, so these step roughly
  // 21 / 40 / 56 in L* while staying dark enough for white header text.
  release: genPageTheme({ colors: ['#5A2A0C', '#7A390F'], shape: shapes.wave }),
  drive: genPageTheme({ colors: ['#8A520B', '#A9660F'], shape: shapes.round }),
  season: genPageTheme({ colors: ['#A5832A', '#B08C30'], shape: shapes.wave2 }),
};
