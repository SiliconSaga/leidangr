import { genPageTheme, shapes, type PageTheme } from '@backstage/theme';

// Custom page themes for the guildhall entity `spec.type` values, composed the
// same way Backstage composes its built-in `pageTheme` map. A regal-purple
// family: practice deeper, aspect lighter — they differ in lightness (not just
// hue) so they stay distinguishable at a glance and in grayscale, with white
// heading/tile text on both. `getPageTheme({ themeId })` keys on `spec.type`,
// so these colour the practice/aspect page headers and Ownership tiles.
export const guildhallPageThemes: Record<string, PageTheme> = {
  practice: genPageTheme({ colors: ['#4527A0', '#5E35B1'], shape: shapes.round }),
  aspect: genPageTheme({ colors: ['#7E57C2', '#9575CD'], shape: shapes.wave2 }),
};
