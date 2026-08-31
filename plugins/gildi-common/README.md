# @siliconsaga/plugin-gildi-common

The Guild Hall's shared domain vocabulary: pure functions and types with no I/O.

It exists because the backend that *computes* trial outcomes and the frontend that *renders* them both need the same rules, and neither should import the other. Anything here must stay free of React, of Backstage backend services, and of anything that touches the network or a database — if a change would pull one of those in, it belongs in `gildi` or `gildi-backend` instead.

## What lives here

| Module | Rule it owns |
|---|---|
| `medals.ts` | `medalFor(applicable, passing)` — medals are derived from how many applicable trials pass, never assigned to named rungs. See [ADR 0013](../../docs/adrs/0013-derived-medals.md). |
| `outcome.ts` | What a single trial answered: `pass`, `fail`, or `unmeasured` with a reason. A **missing artifact is `fail`** — absence is the answer, not an obstacle to finding one. `unmeasured` is reserved for the cases where we could not look at all. |
| `verdict.ts` | Turning outcomes into a verdict. Any unmeasured applicable trial **suppresses** the medal rather than lowering it, because gold means "everything applicable passes" and an unmeasured trial makes that unprovable. `unevaluatedVerdict` covers a run that never learned what the trials were. |
| `standard.ts` | The post-validation shape of a module's `standard.yaml`, plus `CHECK_TYPES` — the closed predicate vocabulary a trial may declare. |

## Two rules worth knowing before changing anything here

**Suppression is not a medal value.** `none` means measured and nothing passed — a verdict about a component. Suppression means we cannot say — a statement about us. Rendering them alike is the failure ADR 0013 set out to end.

**Aggregation consumes outcomes, never resolvers.** That is what lets a future outcome producer — a human attestation, say — arrive without touching the medal rule.

## Related

- Design: [`docs/plans/2026-08-29-aspect-fact-source-design.md`](../../docs/plans/2026-08-29-aspect-fact-source-design.md)
- Consumers: `@siliconsaga/plugin-gildi` (the entity cards), `scripts/lib/standard-shape.ts` (the validator, which shares `CHECK_TYPES`), and the fact source backend once it exists.
