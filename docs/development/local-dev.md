# Local development notes

A running how-to for local-dev setup and gotchas beyond the README quickstart (`make deps` / `make dev`). Add to this as new friction is discovered.

## Managing the dev server (stopping it cleanly)

`make dev` runs Backstage's dev server — the frontend and backend together, both in watch mode. On Windows Git Bash (MinTTY) this is awkward to stop: Ctrl-C often lands on the file-watcher as a *reload* (a soft restart) rather than terminating, and MinTTY doesn't cleanly propagate the kill across the frontend+backend process tree. An unclean exit can also leave the terminal in raw mode, so it starts "eating" keystrokes.

- **Best — run it in a terminal with a real kill control.** VS Code's integrated terminal (the trash/kill button) or Windows Terminal (PowerShell) terminate the whole process tree cleanly, no Ctrl-C dance. Keep it in its own terminal you don't type into.
- **Force-kill from a shell** when Ctrl-C won't. Target the dev ports (frontend `:3000`, backend `:7007`): find the PID with `netstat -ano`, then kill it and its children with `/T`. In **PowerShell / cmd** use single-slash switches — `taskkill /F /T /PID <pid>` (or `taskkill /F /IM node.exe` to bluntly kill every node process). In **Git Bash** double the slashes — `taskkill //F //T //PID <pid>` — so MSYS doesn't mangle the flags into paths.
- **Recover a "funny" terminal** (eaten keystrokes / no echo) after an unclean kill: run `reset` (or `stty sane`) in Git Bash.
- `winpty make dev` under Git Bash also improves Ctrl-C/TTY behaviour for native console apps like node.

## TechDocs — local rendering

Entities with a `backstage.io/techdocs-ref` (e.g. the `security-practice` Component) render their docs in a **Docs** tab. Getting that to build locally:

By default `app-config.yaml` sets `techdocs.generator.runIn: docker`. On Rancher Desktop the Backstage backend's Docker client (dockerode) can't reach the daemon over the Hyper-V socket (`Docker.ping() failed … HTTP code 502`), even though the Docker CLI works fine — they use different sockets. Switch to local generation:

1. **Install the generator toolchain** (mkdocs + the techdocs-core plugin bundle):

   ```sh
   pip install mkdocs-techdocs-core
   ```

2. **Override the generator** in `app-config.local.yaml` (gitignored — copy from `app-config.local.yaml.example`):

   ```yaml
   techdocs:
     generator:
       runIn: local
   ```

3. **Windows + pyenv gotcha — `spawn mkdocs ENOENT`. Handled for you.** The backend spawns `mkdocs` through Node *without a shell*, so it needs a real `mkdocs.exe` on `PATH` — **not** the pyenv shim (`mkdocs.bat`, or the extensionless launcher beside it, which is what `where.exe mkdocs` finds first and which Node cannot exec). Backstage has no config for the binary path: the generator hardcodes `command: "mkdocs"`, so `PATH` is the only lever.

   `make dev` and `make dev-gitea` both run through `scripts/with-mkdocs.sh`, which resolves one in order:

   1. **`$MKDOCS_BIN`** if set — the escape hatch for system Python, conda, or a venv. `ws run` exports the workspace `.env`, so setting it there is enough.
   2. **`pyenv which mkdocs`**, which reports the real executable rather than the shim. Zero config on a pyenv machine.
   3. **Nothing** — a silent no-op if mkdocs is already a real executable or isn't installed. TechDocs is optional for most local work.

   `make doctor` also checks this now, and treats a shim as a *failure* rather than a hit: a shim on `PATH` is worse than nothing there, because it reports as installed and only breaks later, at render time.

   If you launch the dev server some other way, put the Scripts directory on `PATH` yourself:

   ```text
   C:\Users\<you>\.pyenv\pyenv-win\versions\<version>\Scripts\mkdocs.exe
   ```

Restart `make dev` after changing config or `PATH` (both are read at startup, not hot-reloaded).

### Rendering rewrites `mkdocs.yml` — do not put comments in one

Generating docs **modifies the `mkdocs.yml` it just rendered**, in place, in your working tree. `@backstage/plugin-techdocs-node` patches the file (injecting `techdocs-core`, `edit_uri`, and friends) and writes it back with `js-yaml`'s `dump()` — see `stages/generate/mkdocsPatchers.cjs.js`. `js-yaml` cannot preserve comments and defaults to an 80-column line width, so every render:

- **deletes all comments** in the file, and
- **refolds any line past 80 columns** into a `>-` block scalar.

This is why a rendered `mkdocs.yml` can turn up dirty for no apparent reason, sometimes long after the render — it depends on whether anyone opened that Docs tab, not on any command you ran. It is *not* `ws test`, `ws lint`, or `yarn install`, each of which was verified clean in isolation while tracking this down. Two consequences worth keeping:

1. **Never write a comment into an `mkdocs.yml` that gets rendered.** It will not survive. Document the thing here instead.
2. **Write long values pre-folded**, in the form `dump()` would emit, so the rewrite is a no-op and the file stops churning.

## Page themes — the guildhall purple

Guildhall entity types carry their own page colours (the entity **page header** and the Ownership card **tiles**), keyed off `spec.type` via Backstage's `theme.getPageTheme({ themeId })`.

- **Definitions live in the plugin.** `plugins/gildi/src/theme/pageThemes.ts` exports `guildhallPageThemes`, in two tiers. The **practice layer** — `guild` (royal purple), `practice` (deep aubergine), `aspect` (lighter violet) — is saturated and steps in lightness, so the three stay distinct in greyscale. The **instance structure** — `community` (the Domain), `instance` (the System), `plugin` (each cornerstone) — is the same hue family with the saturation pulled out, so it reads as kin while staying quieter than the practice layer it carries. All use white text. The plugin owns the palette so it travels when the package is extracted.
- **Why saturation and not hue.** The violet band (hue 255–285) is full: guild, practice and aspect sit in it, Backstage's unused `tool` theme is a vivid purple, and the stock `website` gradient already *ends* on a deep violet (`#270094`). Desaturation was the axis with clearance. The greens to stay away from are `home`/`apis` teal `#005B4B` and `card` `#4BB8A5 → #187656`.
- **Composition is app-owned.** `packages/app/src/modules/theme/index.tsx` builds a custom light+dark theme that spreads `guildhallPageThemes` over the default `pageTheme` map, and registers them under the names `light`/`dark` — which *replaces* the built-in themes (Backstage's `ThemeBlueprint` is limited to the app plugin, so theme composition is app-owned by design). It's wired into `App.tsx`'s `features`. Both `packages/app` and `plugins/gildi` declare `@backstage/theme` explicitly.
- **How an entity picks up its theme.** `EntityLayout` sets the page `themeId = entity?.spec?.type?.toString() ?? 'home'`, so a `spec.type: practice` entity gets the `practice` theme automatically. Custom (non-entity) pages set it themselves — the Guild Hall page uses `<Page themeId="guild">`.

  > **A theme key is a `spec.type`, never a kind.** That expression reads `spec.type` and nothing else, so registering a theme called `system` or `domain` does *nothing* — it can never be matched. An entity with no `spec.type` falls through to the literal `home` theme (teal `#005B4B`), which is why untyped Systems and Domains all render the same green. To theme one, give it a `spec.type`: `Domain` and `System` both accept an optional one, which is why `siliconsaga` is `type: community` and `leidangr` is `type: instance`.

### Seeing what's already taken

Don't pick a colour blind — the palette is bigger than it looks, and most of it is already spoken for:

```bash
make theme-swatches
```

That writes `.tmp/theme-swatches.html`: every stock Backstage theme, every one of ours, the `spec.type` values actually present in the catalog, and — usually the most useful part — which types are currently falling through to the teal fallback. Open it in a browser. To weigh proposals side by side with what exists:

```bash
make theme-swatches ARGS='--candidate plum:#4A1942,#7A2E63:past guild, darker than pink'
```

It reads the stock map straight out of `@backstage/theme`, so the defaults cannot drift from what the app renders, and parses our own themes from source so it works on a cold checkout with nothing built.

The report also screens the palette for colour-vision confusions and for header text that fails the contrast bar. Read the per-stop numbers rather than the pass/fail: a pair is only reported when it collapses at *every* stop that normal vision can tell apart, so a colour can clear the summary while still colliding down one edge of its gradient.

### Adding a new type colour

1. Run `make theme-swatches` first (above) to see the hue bands still free.

2. Add an entry to `guildhallPageThemes` keyed by the `spec.type`:

   ```ts
   myType: genPageTheme({ colors: ['#hexDark', '#hexLight'], shape: shapes.wave }),
   ```

   (`shapes` = `wave` | `wave2` | `round` | `square`.) Vary lightness from the neighbours and keep the default white `fontColor`.

3. That's all for entity pages — the app composition picks it up. For a custom page, also set `<Page themeId="myType">`.

An unregistered `themeId` silently falls back to the `home` gradient (Backstage's `getPageTheme` default), so a typo shows green rather than crashing — worth an eyeball when adding one.
