/**
 * Resolve a relative path against a base URL, refusing anything that escapes it.
 *
 * Both callers feed this values that arrive OVER THE NETWORK — the practice's
 * `siliconsaga.org/standard` annotation, and each trial's `artifact` from a
 * standard.yaml fetched from another repository. A `../` or an absolute URL in
 * either would make this backend read a location the module does not own: a
 * sibling module's standard, or any URL at all through the credentialed reader.
 *
 * This is the same reason the check vocabulary is a closed enum rather than an
 * expression language. A remote file gets to say WHICH of a few known things to
 * look at, never where to look.
 *
 * Returns undefined rather than throwing, because every caller already has a
 * meaningful answer for "we could not look" and none of them wants an
 * exception mid-sweep.
 */
export function resolveWithin(base: string, relative: string): string | undefined {
  // Trailing slash forced: without it `new URL('./x', '…/aspect')` resolves
  // against the PARENT, which is its own quiet way of leaving the module.
  const root = base.endsWith('/') ? base : `${base}/`;

  let rootUrl: URL;
  let resolved: URL;
  try {
    rootUrl = new URL(root);
    resolved = new URL(relative, root);
  } catch {
    return undefined;
  }

  // WEB SCHEMES ONLY, and the exclusion is not theoretical. Both callers take
  // their base from `backstage.io/source-location`, which the catalog derives
  // from whatever location registered the entity — and this instance registers
  // a dozen `type: file` locations, so a locally-seeded practice carries
  // `file:…`. Resolving against that and handing the result to the UrlReader
  // would read the operator's disk in answer to a trial.
  //
  // http is allowed alongside https because `app-config.gitea.yaml` serves the
  // whole dev stack from `http://gitea.localhost`. An https-only rule reads as
  // the safer choice and is really a silent outage: every source location in
  // that mode fails to resolve, every trial goes unmeasured, and every medal
  // suppresses — with nothing in the file to explain why. Confidentiality on a
  // localhost dev stack is not what is being protected here; the origin and
  // path checks below are.
  const WEB = ['http:', 'https:'];
  if (!WEB.includes(rootUrl.protocol) || !WEB.includes(resolved.protocol)) {
    return undefined;
  }

  // Origin first: an absolute URL in the relative position replaces the base
  // entirely, so a same-path check alone would happily accept another host.
  if (resolved.origin !== rootUrl.origin) {
    return undefined;
  }
  if (!resolved.pathname.startsWith(rootUrl.pathname)) {
    return undefined;
  }
  return resolved.toString();
}
