import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { parse } from 'yaml';
import {
  validateStandardShape,
  type StandardIssue,
} from '@siliconsaga/plugin-gildi-common';

export type { StandardIssue };

/**
 * Structural check on a standard.yaml, run over any module's file by path so
 * one validator serves every aspect repo.
 *
 * The SHAPE half lives in `@siliconsaga/plugin-gildi-common` and is shared with
 * the fact source, which validates standards fetched over the network. Only the
 * filesystem half is here, because only a caller holding a path can answer it:
 * a remediation that resolves, is a file, and does not escape the module. Two
 * structural validators would be free to drift, and this one is what keeps
 * volundr's file honest.
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

  const issues = validateStandardShape(root);

  // `no blocks` is the shape validator's own early return and means there is
  // nothing to resolve remediations against. Returning here keeps this
  // function's answer for an empty file identical to what it was.
  if (issues.length === 1 && issues[0].problem === 'no blocks') {
    return issues;
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
  const within = (rootDir: string, p: string) =>
    p === rootDir || p.startsWith(rootDir + sep);
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  for (const [i, block] of (root?.blocks ?? []).entries()) {
    const trials: Array<Record<string, unknown>> = Array.isArray(block?.trials)
      ? block.trials
      : [];
    const blockName = text(block?.id) || `block[${i}]`;

    trials.forEach((trial, t) => {
      const name = text(trial?.id) || `${blockName}[${t}]`;
      const rel = text(trial?.remediation);
      // Absence is the shape validator's finding, already recorded. Adding a
      // second complaint about the same missing field would double-report it.
      if (!rel) {
        return;
      }
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
        return;
      }
      const real = canonical(target);
      // isFile rather than existsSync: a directory satisfies "exists" and
      // renders as a broken link, which is the failure this check exists
      // to prevent.
      if (!real || !statSync(real, { throwIfNoEntry: false })?.isFile()) {
        issues.push({ trial: name, problem: `remediation ${rel} does not resolve` });
      } else if (!within(realBase, real)) {
        issues.push({ trial: name, problem: `remediation ${rel} escapes the module` });
      }
    });
  }

  return issues;
}
