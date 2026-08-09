# @siliconsaga/plugin-gildi

The **Guild Hall** — a curated overview of the practice layer for this Backstage instance: the guilds, their practices and aspects, active drives, and recent sagas. Built on Backstage's new frontend system.

## Status

A page at `/guild-hall` with a sidebar entry. Guilds, Drives, Chronicle, and Actions all render. See `docs/plans/2026-07-20-gildi-guildhall-hub-design.md` in the leidangr repo for the full design.

## Install

Registered in the app's `features` (see `packages/app/src/App.tsx`):

    import gildiPlugin from '@siliconsaga/plugin-gildi';
    // ...
    features: [/* … */, gildiPlugin]

## Configuration

Components that have adopted no aspect show an "Adopt an aspect" call to action pointing at the Create page. Switch it off in `app-config.yaml` — the card then never mounts:

    app:
      extensions:
        - entity-card:gildi/component-adopt: false

The Aspects card on components that *have* adopted one is not gated; it only renders where there is something to show.

## Development

    ws exec leidangr corepack yarn workspace @siliconsaga/plugin-gildi test

This package is developed inside the leidangr instance for now; its package name (`@siliconsaga/*`) is scoped for later extraction to a standalone plugin repo.
