// Preflight for Gitea mode: the Backstage backend (Node) must be able to resolve
// the Gitea host. Node — unlike curl/git — does NOT special-case *.localhost per
// RFC 6761, so `gitea.localhost` needs a hosts entry. Fail fast with the fix
// rather than letting the catalog silently come up empty.
import dns from 'node:dns';

const host = 'gitea.localhost';

dns.lookup(host, err => {
  if (!err) process.exit(0);
  console.error(`\npreflight: "${host}" does not resolve (${err.code}).`);
  console.error(
    `The Backstage backend (Node) can't reach Gitea — Node does not special-case`,
  );
  console.error(`*.localhost the way curl/git do, so it needs a hosts entry.\n`);
  console.error(`Fix (Windows, elevated PowerShell):`);
  console.error(
    `  Add-Content -Path "$env:windir\\System32\\drivers\\etc\\hosts" -Value "127.0.0.1 ${host}"`,
  );
  console.error(`Fix (Linux/macOS): add to /etc/hosts:  127.0.0.1 ${host}\n`);
  process.exit(1);
});
