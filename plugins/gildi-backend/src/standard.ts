import {
  ANNOTATION_SOURCE_LOCATION,
  parseLocationRef,
  type Entity,
} from '@backstage/catalog-model';
import type { UrlReaderService } from '@backstage/backend-plugin-api';
import {
  validateStandardShape,
  type Standard,
} from '@siliconsaga/plugin-gildi-common';
import { parse } from 'yaml';
import { resolveWithin } from './urls';

const STANDARD_ANNOTATION = 'siliconsaga.org/standard';

/**
 * Where this practice's standard.yaml lives, or undefined if it declares none.
 *
 * Resolved against the entity's own source location so the standard travels
 * with the module. Undefined is a legitimate answer — the seeded security
 * practice has no standard annotation.
 */
export function standardUrlFor(practice: Entity): string | undefined {
  const rel = practice.metadata.annotations?.[STANDARD_ANNOTATION]?.trim();
  const source = practice.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION]?.trim();
  if (!rel || !source) {
    return undefined;
  }
  let target: string;
  try {
    ({ target } = parseLocationRef(source));
  } catch {
    return undefined;
  }
  // Constrained to the module's own directory, not merely resolved against it.
  // "The standard travels with the module" was a claim this function made in a
  // comment and did not enforce: `../other/standard.yaml` would have read a
  // sibling module's file, and an absolute URL would have read anything at all
  // — through a reader holding our GitHub credentials. The annotation comes
  // from an entity ingested over the network, so it is exactly the input that
  // should not get to choose.
  return resolveWithin(target, rel);
}

/**
 * Read, parse and validate a standard.
 *
 * THROWS rather than returning a partial standard. A hollow object would
 * produce an empty applicable set, and an empty applicable set derives medal
 * `none` — publishing a verdict about a component on the strength of our own
 * failure to read the file. The caller turns this rejection into
 * unevaluatedVerdict('no-standard').
 *
 * Validated with the SHARED shape check rather than a second opinion about it,
 * so a standard that passes CI cannot then be refused here, and one that is
 * malformed cannot slip through here after being caught there. Only the
 * filesystem half is missing, because a file fetched over the network has no
 * directory to resolve a remediation against.
 */
export async function loadStandard(
  reader: UrlReaderService,
  url: string,
): Promise<Standard> {
  const response = await reader.readUrl(url);
  const body = (await response.buffer()).toString('utf8');
  const root = parse(body)?.standard;

  const issues = validateStandardShape(root);
  if (issues.length > 0) {
    const summary = issues.map(i => `${i.trial}: ${i.problem}`).join(', ');
    throw new Error(`invalid standard at ${url} — ${summary}`);
  }
  return root as Standard;
}
