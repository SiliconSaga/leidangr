import { readFileSync, statSync } from 'node:fs';
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
  const root = parse(readFileSync(path, 'utf8'))?.standard;
  const blocks = root?.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [{ trial: '(standard)', problem: 'no blocks' }];
  }

  const base = dirname(path);
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
        const contained = target === base || target.startsWith(base + sep);
        if (!contained) {
          issues.push({ trial: name, problem: `remediation ${rel} escapes the module` });
        } else if (!statSync(target, { throwIfNoEntry: false })?.isFile()) {
          // isFile rather than existsSync: a directory satisfies "exists" and
          // renders as a broken link, which is the failure this check exists
          // to prevent.
          issues.push({ trial: name, problem: `remediation ${rel} does not resolve` });
        }
      }
    });
  }
  return issues;
}
