// The shape of a module's standard.yaml. Owned here rather than restated by
// each consumer: a validator whose idea of the vocabulary can drift from the
// code that reads it reports green while checking the wrong thing.
//
// These are the POST-VALIDATION contract — what a consumer may assume once
// `validateStandard` returns no issues. The validator keeps its own raw shape,
// where every field is optional and untrusted, because a validator's input is
// by definition unvalidated. The two are complementary, not duplicated.

// A CLOSED vocabulary, not an expression language. Two reasons, both in design
// §4: standard.yaml has to stay readable by the humans who trust it, and it is
// read OVER THE NETWORK from volundr — a general expression language evaluated
// on a remotely fetched file is a far larger security surface than three typed
// predicates.
export const CHECK_TYPES = [
  'file-contains',
  'workflow-job-uses',
  'pages-source-branch',
] as const;

export type CheckType = (typeof CHECK_TYPES)[number];

export interface Check {
  type: CheckType;
  value: string;
}

export interface Trial {
  id: string;
  rule: string;
  artifact: string;
  factSource: string;
  // Optional: the mock security standard declares no checks, and its trials
  // resolve to unmeasured{no-resolver} rather than being rejected outright.
  check?: Check;
  remediation: string;
}

export interface Block {
  id: string;
  appliesTo: string[];
  trials: Trial[];
}

export interface Standard {
  id: string;
  aspect: string;
  owner?: string;
  filter?: { kind?: string };
  // spec.type -> default facets, overridable per component by the
  // siliconsaga.org/facets annotation.
  facetDefaults?: Record<string, string[]>;
  blocks: Block[];
}

export interface StandardIssue {
  trial: string;
  problem: string;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// Padding is not cosmetic in a value later compared for equality. `' web-ui '`
// trims to something valid and matches nothing downstream, so a validator that
// only inspects the trimmed copy reports a clean file that then behaves as
// though the block were never declared. Rejected rather than normalised: this
// function says what is wrong with the file, and silently repairing the parsed
// copy would leave the real text unchanged and still wrong for its next reader.
const padded = (v: unknown) => typeof v === 'string' && v !== v.trim();

/**
 * Structural validation of a parsed standard — everything that does not touch
 * a filesystem.
 *
 * Split out so the two callers cannot disagree. `scripts/lib/standard-shape.ts`
 * validates a file on disk and adds the checks only it can make (a remediation
 * resolves, is a file, stays inside the module), while the backend validates a
 * standard fetched over the network and can make none of them. A second
 * structural check written for the backend would be free to drift from the one
 * that keeps volundr honest, which is exactly the fault this package exists to
 * prevent.
 *
 * Returns findings rather than throwing: the caller asked what is wrong with
 * the input, and a stack trace does not answer that.
 */
export function validateStandardShape(root: unknown): StandardIssue[] {
  const std = root as
    | {
        id?: unknown;
        aspect?: unknown;
        blocks?: unknown;
      }
    | null
    | undefined;

  const blocks = std?.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [{ trial: '(standard)', problem: 'no blocks' }];
  }

  const issues: StandardIssue[] = [];

  // Non-optional in the Standard type above, so a clean return is a promise
  // these are present.
  if (!text(std?.id)) issues.push({ trial: '(standard)', problem: 'missing id' });
  if (!text(std?.aspect)) {
    issues.push({ trial: '(standard)', problem: 'missing aspect' });
  }

  for (const [i, block] of blocks.entries()) {
    const trials: Array<Record<string, unknown>> = Array.isArray(block?.trials)
      ? block.trials
      : [];
    // Positional fallback so an idless block is still reportable, mirroring how
    // trials below name themselves when their own id is missing.
    const blockName = text(block?.id) || `block[${i}]`;

    // Non-optional in the Block type. Without this a block with no id but valid
    // trials returns clean, which is a promise the type does not keep — and
    // every issue raised about that block degrades to a bare positional name.
    if (!text(block?.id)) {
      issues.push({ trial: blockName, problem: 'missing id' });
    }

    // appliesTo drives facet filtering. A block without it applies to nothing,
    // so its trials silently never run — which looks exactly like a component
    // with nothing to answer for unless the shape is checked here.
    const appliesTo = block?.appliesTo;
    if (!Array.isArray(appliesTo) || appliesTo.length === 0) {
      issues.push({ trial: blockName, problem: 'missing appliesTo' });
    } else if (appliesTo.some((f: unknown) => typeof f !== 'string' || !f.trim())) {
      // Array-ness alone is not enough. Entries are compared against a
      // component's resolved facets, which are strings, so `[1]`, `[null]` and
      // `['']` match nothing and take the block quiet in precisely the way a
      // missing appliesTo would — the failure this check exists to prevent,
      // arrived at through a shape that looks populated.
      issues.push({ trial: blockName, problem: 'appliesTo has a non-string entry' });
    } else if (appliesTo.some(padded)) {
      issues.push({ trial: blockName, problem: 'appliesTo has a padded entry' });
    }

    // A block with no trials defines no checks, so a standard made entirely of
    // them would validate clean while asking nothing of anybody. Coercing the
    // missing array to [] is what would hide it.
    if (trials.length === 0) {
      issues.push({ trial: blockName, problem: 'no trials' });
      continue;
    }

    trials.forEach((trial, t) => {
      // Every field is checked for being a non-empty STRING, not merely
      // present. YAML happily produces a number for `id: 1.4`, and calling
      // .trim() on that throws — crashing the run that exists to diagnose the
      // file.
      const name = text(trial?.id) || `${blockName}[${t}]`;
      const required = (fieldName: string) => {
        if (!text(trial?.[fieldName])) {
          issues.push({ trial: name, problem: `missing ${fieldName}` });
          return false;
        }
        return true;
      };

      if (!text(trial?.id)) issues.push({ trial: name, problem: 'missing id' });
      required('rule');
      required('artifact');
      // factSource is looked up in the resolver registry by EXACT equality, so
      // padding here behaves like a typo: ' repo-files ' validates clean and
      // then resolves to unmeasured{no-resolver}, suppressing the medal for a
      // reason invisible in the file. Same hazard as a padded check type or
      // facet, and caught in the same place rather than at evaluation time.
      if (required('factSource') && padded(trial?.factSource)) {
        issues.push({ trial: name, problem: `padded factSource ${text(trial?.factSource)}` });
      }

      // A check is optional — the mock security standard declares none, and
      // those trials resolve to unmeasured rather than being a shape error.
      // But a check that IS present must name a type from the closed
      // vocabulary, or a typo becomes a silent unmeasured at evaluation time.
      //
      // ABSENT and NULL are different. `check:` with nothing after it parses as
      // null, and that is a half-written declaration rather than a decision to
      // omit one — treating it as absent lets an unfinished trial validate
      // clean and then go unmeasured at runtime, which is the exact failure
      // this catches. Only `undefined` means "no check".
      const check = trial?.check as { type?: unknown; value?: unknown } | null | undefined;
      if (check !== undefined) {
        if (check === null || typeof check !== 'object' || Array.isArray(check)) {
          issues.push({ trial: name, problem: 'check is not a mapping' });
        } else {
          const checkType = text(check.type);
          if (!checkType) {
            issues.push({ trial: name, problem: 'check missing type' });
          } else if (padded(check.type)) {
            // Reported BEFORE the vocabulary test, because a padded but
            // otherwise valid type is the dangerous case: it trims to a real
            // member and so passes an includes() on the trimmed copy, then
            // fails the same test downstream where nothing trims it. Checking
            // membership first would call this file clean.
            issues.push({ trial: name, problem: `padded check type ${checkType}` });
          } else if (!(CHECK_TYPES as readonly string[]).includes(checkType)) {
            issues.push({ trial: name, problem: `unknown check type ${checkType}` });
          }
          if (!text(check.value)) {
            issues.push({ trial: name, problem: 'check missing value' });
          }
        }
      }

      // Presence only. Whether it RESOLVES is a filesystem question, and the
      // caller that can answer it adds that finding itself.
      required('remediation');
    });
  }

  return issues;
}
