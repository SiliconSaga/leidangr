import { resolveWithin } from './urls';

const BASE = 'https://github.com/SiliconSaga/volundr/tree/main/aspect';

describe('resolveWithin', () => {
  it('resolves a plain relative path', () => {
    expect(resolveWithin(BASE, './standard.yaml')).toBe(`${BASE}/standard.yaml`);
  });

  it('resolves a nested path', () => {
    expect(resolveWithin(BASE, 'docs/adopting.md')).toBe(`${BASE}/docs/adopting.md`);
  });

  it('accepts a base that already ends in a slash', () => {
    expect(resolveWithin(`${BASE}/`, './standard.yaml')).toBe(`${BASE}/standard.yaml`);
  });

  // THE ONES THAT MATTER. These values arrive over the network from another
  // repository, so each is a way for a remote file to point this backend at
  // something the module does not own.
  it.each([
    ['a parent escape', '../other/standard.yaml'],
    ['a deep parent escape', '../../../../etc/passwd'],
    ['an absolute path on the same host', '/SiliconSaga/private/standard.yaml'],
    ['an absolute URL on another host', 'https://evil.example.com/standard.yaml'],
    ['an absolute URL on the same host', 'https://github.com/Other/repo/standard.yaml'],
  ])('refuses %s', (_label, relative) => {
    expect(resolveWithin(BASE, relative)).toBeUndefined();
  });

  it('refuses a base that is not a URL at all', () => {
    expect(resolveWithin('not-a-url', './standard.yaml')).toBeUndefined();
  });

  // Both callers take their base from backstage.io/source-location, and this
  // instance registers a dozen `type: file` locations — so a locally-seeded
  // entity really does carry `file:`. Resolving against it would read the
  // operator's disk in answer to a trial.
  it.each([
    ['a file base', 'file:///C:/repos/volundr/aspect'],
    ['a data base', 'data:text/plain,hello'],
  ])('refuses %s', (_label, base) => {
    expect(resolveWithin(base, './standard.yaml')).toBeUndefined();
  });

  it('refuses a relative value that switches scheme', () => {
    expect(resolveWithin(BASE, 'file:///etc/passwd')).toBeUndefined();
  });

  // http is ALLOWED, and this test is the reason. `app-config.gitea.yaml`
  // serves the dev stack from http://gitea.localhost, so an https-only rule
  // would resolve nothing in that mode: every trial unmeasured, every medal
  // suppressed, and no hint in the config as to why.
  it('allows an http base, because the Gitea dev stack is served over it', () => {
    expect(
      resolveWithin('http://gitea.localhost/leidangr/site/raw/branch/main', 'Gemfile'),
    ).toBe('http://gitea.localhost/leidangr/site/raw/branch/main/Gemfile');
  });

  it('still refuses an escape from an http base', () => {
    // Allowing the scheme does not relax containment.
    expect(
      resolveWithin('http://gitea.localhost/leidangr/site/', '../other/Gemfile'),
    ).toBeUndefined();
  });

  it('refuses a sibling directory sharing a name prefix', () => {
    // `…/aspect-private/` starts with `…/aspect` as a STRING but is a
    // different directory. The forced trailing slash on the base is what makes
    // the prefix comparison mean what it looks like it means.
    expect(resolveWithin(BASE, '../aspect-private/standard.yaml')).toBeUndefined();
  });
});
