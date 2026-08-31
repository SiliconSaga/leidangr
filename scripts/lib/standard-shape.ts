import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { parse } from 'yaml';
import { CHECK_TYPES } from '@siliconsaga/plugin-gildi-common';

export interface StandardIssue {
  trial: string;
  problem: string;
}

// The RAW shape: every field optional and untrusted, because a validator's
// input is by definition unvalidated. The shared package's `Trial`/`Standard`
// types are the post-validation contract — what a consumer may assume once
// this returns clean. What is NOT duplicated is the vocabulary: CHECK_TYPES is
// imported, so a second copy of the rules cannot drift from the first.
interface RawTrial {
  id?: string;
  rule?: string;
  artifact?: string;
  factSource?: string;
  check?: { type?: unknown; value?: unknown };
  remediation?: string;
}

/**
 * Structural check on a standard.yaml, run over any module's file by path so
 * one validator serves every aspect repo.
 *
 * The artifact and remediation checks are the load-bearing ones. A trial with
 * no named artifact is prose the fact source cannot compute, which is the trap
 * the security standard fell into — rules like "no critical finding older than
 * 30 days" read fine and check nothing. A remediation that does not resolve
 * breaks the promise that a failing trial is one click from its fix.
 */
export function validateStandard(path: string): StandardIssue[] {
  // Malformed YAML is a finding, not a crash. A validator that throws on the
  // worst input is useless exactly when it is needed most — the caller wanted
  // to know what is wrong with the file, and a stack trace does not say.
  let root;
  try {
    root = parse(readFileSync(path, 'utf8'))?.standard;
  } catch {
    return [{ trial: '(standard)', problem: 'invalid YAML' }];
  }

  const blocks = root?.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [{ trial: '(standard)', problem: 'no blocks' }];
  }

  // Resolved to absolute before anything compares against it. dirname() of a
  // relative path stays relative, while resolve() below always returns
  // absolute — so leaving it relative made the containment check reject every
  // remediation in the file. Found by the first real cross-repo call rather
  // than by the tests, which all used mkdtempSync and were therefore absolute;
  // a relative-path case now covers it.
  const base = resolve(dirname(path));
  // Canonical form too, so a symlink cannot smuggle a vísir out of the module
  // past a purely textual containment check.
  const canonical = (p: string) => {
    try {
      return realpathSync(p);
    } catch {
      return null;
    }
  };
  const realBase = canonical(base) ?? base;
  const within = (root: string, p: string) => p === root || p.startsWith(root + sep);
  const issues: StandardIssue[] = [];

  // Non-optional in the shared Standard type, so a clean return is a promise
  // these are present. The `no blocks` early return above fires first and keeps
  // its own single-issue array, which is the right answer for a file with
  // nothing in it at all.
  const field = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  if (!field(root?.id)) issues.push({ trial: '(standard)', problem: 'missing id' });
  if (!field(root?.aspect)) {
    issues.push({ trial: '(standard)', problem: 'missing aspect' });
  }

  // Padding is not cosmetic in a value that is later compared for equality.
  // `' web-ui '` trims to something valid and matches nothing downstream, so a
  // validator that only inspects the trimmed copy reports a clean file that
  // then behaves as though the block were never declared. Reject rather than
  // normalise: this function's job is to say what is wrong with the file, and
  // silently repairing it would leave the real text unchanged and still wrong
  // for anyone reading it. Same reason `scalar()` exists in gildi's aspects.ts.
  const padded = (v: unknown) => typeof v === 'string' && v !== v.trim();

  for (const [i, block] of blocks.entries()) {
    const trials: RawTrial[] = Array.isArray(block?.trials) ? block.trials : [];
    // Positional fallback so an idless block is still reportable, mirroring how
    // trials below name themselves when their own id is missing.
    const blockName = field(block?.id) || `block[${i}]`;

    // Non-optional in the shared Block type. Without this a block with no id
    // but valid trials returns clean, which is a promise the type does not keep
    // — and every issue raised about that block degrades to a bare '?'.
    if (!field(block?.id)) {
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

    trials.forEach((trial, i) => {
      // Every field is checked for being a non-empty STRING, not merely
      // present. YAML happily produces a number for `id: 1.4`, and calling
      // .trim() on it throws — crashing the run that exists to diagnose the
      // file. Fall back to a positional name so a malformed trial is still
      // reportable.
      const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      const name = text(trial?.id) || `${blockName}[${i}]`;
      const required = (field: keyof RawTrial) => {
        if (!text(trial?.[field])) {
          issues.push({ trial: name, problem: `missing ${field}` });
          return false;
        }
        return true;
      };

      if (!text(trial?.id)) issues.push({ trial: name, problem: 'missing id' });
      required('rule');
      required('artifact');
      required('factSource');

      // A check is optional — the mock security standard declares none, and
      // those trials resolve to unmeasured rather than being a shape error.
      // But a check that IS present must name a type from the closed
      // vocabulary, or a typo becomes a silent unmeasured at evaluation time.
      //
      // ABSENT and NULL are different. `check:` with nothing after it parses as
      // null, and that is a half-written declaration, not a decision to omit
      // one — treating it as absent lets an unfinished trial validate clean and
      // then go unmeasured at runtime, which is the exact failure this
      // validator exists to catch. Only `undefined` means "no check".
      const check = trial?.check;
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
      if (required('remediation')) {
        const rel = text(trial.remediation);
        const target = resolve(base, rel);
        // Must stay inside the module: a vísir is part of the aspect, and a
        // remediation escaping its directory points at something that will not
        // travel with the module when it is extracted or read over a URL.
        //
        // Checked twice, for two different escapes. The textual check catches
        // a `../` that does not exist, which canonicalising cannot — realpath
        // on a missing file just fails. The canonical check then catches the
        // one textual comparison misses: a symlink inside the module pointing
        // out of it, which reads as contained and resolves elsewhere.
        if (!within(base, target)) {
          issues.push({ trial: name, problem: `remediation ${rel} escapes the module` });
        } else {
          const real = canonical(target);
          // isFile rather than existsSync: a directory satisfies "exists" and
          // renders as a broken link, which is the failure this check exists
          // to prevent.
          if (!real || !statSync(real, { throwIfNoEntry: false })?.isFile()) {
            issues.push({ trial: name, problem: `remediation ${rel} does not resolve` });
          } else if (!within(realBase, real)) {
            issues.push({ trial: name, problem: `remediation ${rel} escapes the module` });
          }
        }
      }
    });
  }
  return issues;
}
