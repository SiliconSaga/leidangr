import { guildhallPageThemes } from '@siliconsaga/plugin-gildi';
import { pageTheme as defaultPageTheme } from '@backstage/theme';
import { mergedPageTheme } from './index';

// The gildi plugin owns the page-theme definitions; this module's job is to
// merge them over the default map for the custom light/dark themes. Assert the
// merge actually happened without dropping the built-ins.
describe('app theme page-theme composition', () => {
  it.each(['guild', 'practice', 'aspect', 'community', 'instance', 'plugin'] as const)(
    'includes the %s guildhall page theme',
    key => {
      expect(mergedPageTheme[key]).toEqual(guildhallPageThemes[key]);
    },
  );

  it('preserves the default page themes', () => {
    expect(mergedPageTheme.home).toEqual(defaultPageTheme.home);
    expect(mergedPageTheme.service).toEqual(defaultPageTheme.service);
  });
});
