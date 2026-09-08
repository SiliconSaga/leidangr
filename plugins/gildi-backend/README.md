# @siliconsaga/plugin-gildi-backend

The Guild Hall's fact source: it reads the outside world and answers each trial.

## The one rule

This package owns **acquisition**. It reads repositories and APIs, and it produces `Outcome` values. It must not restate any rule from `@siliconsaga/plugin-gildi-common` — the outcome union, the medal ladder, the standard's shape and `CHECK_TYPES` all live there, and a second copy here is the drift that package exists to prevent. It must not render anything either.

## What that means in practice

| Concern | Lives in |
|---|---|
| What a trial outcome *is* | `gildi-common` |
| What a medal *means* | `gildi-common` |
| How to *find out* | here |
| How to *show* it | `gildi` |

## Two distinctions worth knowing before changing a resolver

**A missing artifact is `fail`, not `unmeasured`.** No Gemfile means `gemfile-present` fails — absence is the answer, not an obstacle to finding one. `unmeasured` is reserved for the cases where we could not look at all: no resolver, no source location, or the lookup itself broke.

**A missing resolver is never a pass.** An unregistered `factSource` resolves to `unmeasured{no-resolver}`, which suppresses the medal. Returning a pass would silently inflate every medal in the catalog while looking entirely correct.

## Related

- Design: [`docs/plans/2026-08-29-aspect-fact-source-design.md`](../../docs/plans/2026-08-29-aspect-fact-source-design.md)
- Plan: [`docs/plans/2026-09-05-aspect-fact-source-backend-plan.md`](../../docs/plans/2026-09-05-aspect-fact-source-backend-plan.md)
