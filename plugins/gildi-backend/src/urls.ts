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
