import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import {
  createUnifiedTheme,
  UnifiedThemeProvider,
  palettes,
  pageTheme as defaultPageTheme,
} from '@backstage/theme';
import LightIcon from '@material-ui/icons/WbSunny';
import DarkIcon from '@material-ui/icons/Brightness2';
import { guildhallPageThemes } from '@siliconsaga/plugin-gildi';

// The default Backstage light/dark themes, extended with the guildhall
// practice/aspect page themes. `getPageTheme({ themeId: spec.type })` resolves
// these for practice/aspect entities (headers + Ownership tiles); everything
// else falls back to the default map. Theme composition is app-owned — the
// gildi plugin only exports the page-theme definitions.
// Exported for the composition test — the guildhall page themes spread over the
// default map is the meaningful step this module owns.
export const mergedPageTheme = { ...defaultPageTheme, ...guildhallPageThemes };

const guildhallLightTheme = createUnifiedTheme({
  palette: palettes.light,
  pageTheme: mergedPageTheme,
});

const guildhallDarkTheme = createUnifiedTheme({
  palette: palettes.dark,
  pageTheme: mergedPageTheme,
});

// `name: 'light'` / `name: 'dark'` under pluginId 'app' reproduce the built-in
// theme extension ids (theme:app/light, theme:app/dark), so these REPLACE the
// defaults rather than adding extra options in the theme picker.
const guildhallLight = ThemeBlueprint.make({
  name: 'light',
  params: {
    theme: {
      id: 'light',
      title: 'Light Theme',
      variant: 'light',
      icon: <LightIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={guildhallLightTheme}>{children}</UnifiedThemeProvider>
      ),
    },
  },
});

const guildhallDark = ThemeBlueprint.make({
  name: 'dark',
  params: {
    theme: {
      id: 'dark',
      title: 'Dark Theme',
      variant: 'dark',
      icon: <DarkIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={guildhallDarkTheme}>{children}</UnifiedThemeProvider>
      ),
    },
  },
});

export const themeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [guildhallLight, guildhallDark],
});
