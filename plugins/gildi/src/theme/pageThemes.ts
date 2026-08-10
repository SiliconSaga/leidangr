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
  // --- Practice layer: the Guildhall's own vocabulary. Saturated purples,
  // separated by lightness so they stay distinct at a glance and in greyscale.
  //
  // guild: the central fellowship — a royal, magenta-leaning purple, also used
  // for the Guild Hall hub page.
  guild: genPageTheme({ colors: ['#6A1B9A', '#8E24AA'], shape: shapes.wave }),
  practice: genPageTheme({ colors: ['#4527A0', '#5E35B1'], shape: shapes.round }),
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
