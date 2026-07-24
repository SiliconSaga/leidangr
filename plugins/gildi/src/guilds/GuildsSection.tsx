import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useGuilds } from './useGuilds';
import { GuildCard } from './GuildCard';

export function GuildsSection() {
  const { guilds, loading, error } = useGuilds();
  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (guilds.length === 0) return <p style={{ opacity: 0.7 }}>No guilds yet — define a Group with <code>spec.type: guild</code>.</p>;
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {guilds.map(g => (<GuildCard key={g.name} guild={g} />))}
    </div>
  );
}
