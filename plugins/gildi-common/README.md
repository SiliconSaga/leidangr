# @siliconsaga/plugin-gildi-common

The Guild Hall's shared domain vocabulary: pure functions and types with no I/O.

It exists because the backend that *computes* trial outcomes and the frontend that *renders* them both need the same rules, and neither should import the other. Anything here must stay free of React, of Backstage backend services, and of anything that touches the network or a database — if a change would pull one of those in, it belongs in `gildi` or `gildi-backend` instead.

## What lives here

| Module | Rule it owns |
|---|---|
| `medals.ts` | `medalFor(applicable, passing)` — medals are derived from how many applicable trials pass, never assigned to named rungs. See [ADR 0013](../../docs/adrs/0013-derived-medals.md). |

## Related

- Design: [`docs/plans/2026-08-29-aspect-fact-source-design.md`](../../docs/plans/2026-08-29-aspect-fact-source-design.md)
- Consumers: `@siliconsaga/plugin-gildi` (the entity cards), and the fact source backend once it exists.
