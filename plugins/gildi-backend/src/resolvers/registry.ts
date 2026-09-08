import { githubPagesResolver } from './githubPages';
import { repoFilesResolver } from './repoFiles';
import type { Resolver } from './types';

// Keyed by the standard's `factSource`. An unregistered kind resolves to
// undefined and the caller records unmeasured{no-resolver} — never a pass,
// which is the failure that would silently inflate every medal in the catalog
// while looking entirely correct.
//
// The three security fact sources are deliberately absent. They exist only in
// examples/mock-org, and writing resolvers against fictional artifacts would be
// inventing evidence.
//
// Looked up verbatim, with no trimming: the standard validator already rejects
// a padded factSource, so a padded name reaching here means something upstream
// stopped enforcing that, and quietly matching it would hide the regression.
const RESOLVERS: Record<string, Resolver> = {
  'repo-files': repoFilesResolver,
  'github-pages-api': githubPagesResolver,
};

export function resolverFor(factSource: string): Resolver | undefined {
  return Object.prototype.hasOwnProperty.call(RESOLVERS, factSource)
    ? RESOLVERS[factSource]
    : undefined;
}
