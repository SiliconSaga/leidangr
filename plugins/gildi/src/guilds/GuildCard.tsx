import type { CSSProperties } from 'react';
import { Link } from '@backstage/core-components';
import { Crest } from '../crest';
import type { GuildView } from './useGuilds';

export function GuildCard({ guild }: { guild: GuildView }) {
  const aspects = Array.from(new Set([
    ...guild.stewardAspects,
    ...guild.practices.map(p => p.aspect).filter(Boolean) as string[],
  ]));
  return (
    <Link to={`/catalog/default/group/${guild.name}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', gap: 14, border: '1px solid rgba(128,128,128,.3)', borderRadius: 12, padding: 14, height: '100%' }}>
        <Crest seed={guild.name} size={48} title={`Arms of ${guild.title}`} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: 15 }}>{guild.title}</div>
          {guild.description && <div style={{ fontSize: 12.5, opacity: 0.78, margin: '4px 0 8px', lineHeight: 1.5 }}>{guild.description}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {guild.practices.map(p => (<span key={p.name} style={chip('#6366f1')}>{p.title}</span>))}
            {aspects.map(a => (<span key={a} style={chip('#10b981')}>{a} aspect</span>))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function chip(c: string): CSSProperties {
  return { fontSize: 10.5, padding: '2px 8px', borderRadius: 20, border: `1px solid ${c}80`, background: `${c}1a` };
}
