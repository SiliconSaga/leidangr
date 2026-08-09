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
  // community was originally lighter (#7A6E94 → #A79BC2), but that second stop
  // gave white header text only ~2.5:1 — below the 3:1 WCAG bar for large text,
  // and a failure for every reader rather than a minority. Darkened until both
  // stops clear it.
  community: genPageTheme({ colors: ['#6A5E86', '#8E82A6'], shape: shapes.wave2 }),
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
