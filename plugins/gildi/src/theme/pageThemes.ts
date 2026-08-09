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
  community: genPageTheme({ colors: ['#7A6E94', '#A79BC2'], shape: shapes.wave2 }),
  instance: genPageTheme({ colors: ['#37304A', '#574B70'], shape: shapes.wave }),
  plugin: genPageTheme({ colors: ['#4E4361', '#7C6E96'], shape: shapes.round }),
};
