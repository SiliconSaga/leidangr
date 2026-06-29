import { resolveTarget, validateKeys, renderEnvLocal } from './dev-secrets';

describe('resolveTarget', () => {
  it('uses the BAO_ADDR direct URL when set', () => {
    expect(resolveTarget({ BAO_ADDR: 'https://openbao.cmdbee.org' })).toEqual({
      mode: 'direct',
      addr: 'https://openbao.cmdbee.org',
    });
  });

  it('falls back to a port-forward when BAO_ADDR is unset', () => {
    expect(resolveTarget({})).toEqual({ mode: 'port-forward' });
  });

  it('treats an empty BAO_ADDR as unset', () => {
    expect(resolveTarget({ BAO_ADDR: '' })).toEqual({ mode: 'port-forward' });
  });
});

describe('validateKeys', () => {
  it('passes when all required keys are present', () => {
    expect(validateKeys({ gitea_token: 'x' }, ['gitea_token'])).toEqual({
      ok: true,
      missing: [],
    });
  });

  it('reports the missing keys', () => {
    expect(validateKeys({}, ['gitea_token'])).toEqual({
      ok: false,
      missing: ['gitea_token'],
    });
  });

  it('reports blank required values as missing', () => {
    expect(validateKeys({ gitea_token: '' }, ['gitea_token'])).toEqual({
      ok: false,
      missing: ['gitea_token'],
    });
    expect(validateKeys({ gitea_token: '   ' }, ['gitea_token'])).toEqual({
      ok: false,
      missing: ['gitea_token'],
    });
  });
});

describe('renderEnvLocal', () => {
  it('maps kv keys to shell-quoted env vars and lists present keys without values', () => {
    const r = renderEnvLocal({ gitea_token: 'super-secret' }, { gitea_token: 'GITEA_TOKEN' });
    expect(r.content).toBe("GITEA_TOKEN='super-secret'\n");
    expect(r.presentKeys).toEqual(['gitea_token']);
  });

  it('skips mapping entries whose kv key is absent from the data', () => {
    const r = renderEnvLocal({ gitea_token: 'x' }, { gitea_token: 'GITEA_TOKEN', other: 'OTHER' });
    expect(r.content).toBe("GITEA_TOKEN='x'\n");
    expect(r.presentKeys).toEqual(['gitea_token']);
  });

  it('shell-quotes values so metacharacters cannot execute when the file is sourced', () => {
    const r = renderEnvLocal({ gitea_token: "a'b$(x)" }, { gitea_token: 'GITEA_TOKEN' });
    expect(r.content).toBe("GITEA_TOKEN='a'\\''b$(x)'\n");
  });
});
