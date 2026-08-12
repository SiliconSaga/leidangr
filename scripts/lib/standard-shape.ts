import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { parse } from 'yaml';

export interface StandardIssue {
  trial: string;
  problem: string;
}

interface RawTrial {
  id?: string;
  rule?: string;
  artifact?: string;
  factSource?: string;
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

  for (const block of blocks) {
    const trials: RawTrial[] = Array.isArray(block?.trials) ? block.trials : [];
    // A block with no trials defines no checks, so a standard made entirely of
    // them would validate clean while asking nothing of anybody. Coercing the
    // missing array to [] is what would hide it.
    if (trials.length === 0) {
      issues.push({ trial: `${block?.id ?? '?'}`, problem: 'no trials' });
      continue;
    }

    trials.forEach((trial, i) => {
      // Every field is checked for being a non-empty STRING, not merely
      // present. YAML happily produces a number for `id: 1.4`, and calling
      // .trim() on it throws — crashing the run that exists to diagnose the
      // file. Fall back to a positional name so a malformed trial is still
      // reportable.
      const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      const name = text(trial?.id) || `${block?.id ?? '?'}[${i}]`;
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
