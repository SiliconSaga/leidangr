# Local development notes

A running how-to for local-dev setup and gotchas beyond the README quickstart
(`make deps` / `make dev`). Add to this as new friction is discovered.

## Managing the dev server (stopping it cleanly)

`make dev` runs Backstage's dev server — the frontend and backend together, both
in watch mode. On Windows Git Bash (MinTTY) this is awkward to stop: Ctrl-C often
lands on the file-watcher as a *reload* (a soft restart) rather than terminating,
and MinTTY doesn't cleanly propagate the kill across the frontend+backend process
tree. An unclean exit can also leave the terminal in raw mode, so it starts
"eating" keystrokes.

- **Best — run it in a terminal with a real kill control.** VS Code's integrated
  terminal (the trash/kill button) or Windows Terminal (PowerShell) terminate the
  whole process tree cleanly, no Ctrl-C dance. Keep it in its own terminal you
  don't type into.
- **Force-kill from a shell** when Ctrl-C won't. Target the dev ports (frontend
  `:3000`, backend `:7007`): find the PID with `netstat -ano` and
  `taskkill //F //PID <pid>`, or bluntly `taskkill //F //IM node.exe` (kills
  every node process on the machine).
- **Recover a "funny" terminal** (eaten keystrokes / no echo) after an unclean
  kill: run `reset` (or `stty sane`) in Git Bash.
- `winpty make dev` under Git Bash also improves Ctrl-C/TTY behaviour for native
  console apps like node.

## TechDocs — local rendering

Entities with a `backstage.io/techdocs-ref` (e.g. the `security-practice`
Component) render their docs in a **Docs** tab. Getting that to build locally:

By default `app-config.yaml` sets `techdocs.generator.runIn: docker`. On Rancher
Desktop the Backstage backend's Docker client (dockerode) can't reach the daemon
over the Hyper-V socket (`Docker.ping() failed … HTTP code 502`), even though the
Docker CLI works fine — they use different sockets. Switch to local generation:

1. **Install the generator toolchain** (mkdocs + the techdocs-core plugin bundle):

   ```sh
   pip install mkdocs-techdocs-core
   ```

2. **Override the generator** in `app-config.local.yaml` (gitignored — copy from
   `app-config.local.yaml.example`):

   ```yaml
   techdocs:
     generator:
       runIn: local
   ```

3. **Windows + pyenv gotcha — `spawn mkdocs ENOENT`.** The backend spawns
   `mkdocs` through Node *without a shell*, so on Windows it needs a real
   `mkdocs.exe` on `PATH` — **not** the pyenv shim (`mkdocs.bat`, which Node
   cannot exec, and which is the only `mkdocs` your Git Bash shell sees). The
   real executable lives in the active pyenv version's Scripts dir:

   ```text
   C:\Users\<you>\.pyenv\pyenv-win\versions\<version>\Scripts\mkdocs.exe
   ```

   Add that Scripts directory to your `PATH` (user/system env for a durable fix,
   or `export PATH="/c/Users/<you>/.pyenv/pyenv-win/versions/<version>/Scripts:$PATH"`
   in the shell before `make dev` for a one-off). Verify it's the `.exe`, not the
   shim: `where.exe mkdocs` should list a path ending in `.exe`.

Restart `make dev` after changing config or `PATH` (both are read at startup, not
hot-reloaded).

## Page themes — the guildhall purple

Guildhall entity types carry their own page colours (the entity **page header**
and the Ownership card **tiles**), keyed off `spec.type` via Backstage's
`theme.getPageTheme({ themeId })`.

- **Definitions live in the plugin.** `plugins/gildi/src/theme/pageThemes.ts`
  exports `guildhallPageThemes` — `guild` (royal purple), `practice` (deep
  indigo-purple), `aspect` (lighter violet) — built with `genPageTheme`. Shades
  differ in *lightness* (not just hue) so they stay distinct in grayscale, with
  white text. The plugin owns the palette so it travels when the package is
  extracted.
- **Composition is app-owned.** `packages/app/src/modules/theme/index.tsx` builds
  a custom light+dark theme that spreads `guildhallPageThemes` over the default
  `pageTheme` map, and registers them under the names `light`/`dark` — which
  *replaces* the built-in themes (Backstage's `ThemeBlueprint` is limited to the
  app plugin, so theme composition is app-owned by design). It's wired into
  `App.tsx`'s `features`. Both `packages/app` and `plugins/gildi` declare
  `@backstage/theme` explicitly.
- **How an entity picks up its theme.** `EntityLayout` sets the page
  `themeId = entity.spec.type`, so a `spec.type: practice` entity gets the
  `practice` theme automatically. Custom (non-entity) pages set it themselves —
  the Guild Hall page uses `<Page themeId="guild">`.

### Adding a new type colour

1. Add an entry to `guildhallPageThemes` keyed by the `spec.type`:

   ```ts
   myType: genPageTheme({ colors: ['#hexDark', '#hexLight'], shape: shapes.wave }),
   ```

   (`shapes` = `wave` | `wave2` | `round` | `square`.) Vary lightness from the
   neighbours and keep the default white `fontColor`.

2. That's all for entity pages — the app composition picks it up. For a custom
   page, also set `<Page themeId="myType">`.

An unregistered `themeId` silently falls back to the `home` gradient (Backstage's
`getPageTheme` default), so a typo shows green rather than crashing — worth an
eyeball when adding one.
