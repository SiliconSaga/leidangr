import { useId } from 'react';
import { blazonFor, tinctureHex, Charge } from './blazon';

const SHIELD = 'M9 7 L51 7 L51 33 Q51 52 30 63 Q9 52 9 33 Z';

function ChargeShape({ charge, fill }: { charge: Charge; fill: string }) {
  switch (charge) {
    case 'key': return (<g><circle cx="30" cy="24" r="6" fill="none" stroke={fill} strokeWidth="3.2" /><rect x="28.6" y="29" width="2.8" height="23" fill={fill} /><rect x="31.4" y="45" width="5" height="2.6" fill={fill} /></g>);
    case 'chevron': return <polygon points="17,47 30,33 43,47 43,41 30,27 17,41" fill={fill} />;
    case 'mullet': return <polygon points="30,21 33.4,30 42.6,30 35.2,36 38.4,45.5 30,39.5 21.6,45.5 24.8,36 17.4,30 26.6,30" fill={fill} />;
    case 'roundel': return <circle cx="30" cy="33" r="7" fill={fill} />;
    case 'cross': return <g><rect x="27" y="18" width="6" height="30" fill={fill} /><rect x="18" y="27" width="24" height="6" fill={fill} /></g>;
    default: return null;
  }
}

export function Crest({ seed, size = 44, title }: { seed: string; size?: number; title?: string }) {
  const id = useId();
  if (!seed) return null;
  const b = blazonFor(seed);
  const f1 = tinctureHex(b.fieldTincture);
  const f2 = tinctureHex(b.fieldTincture2);
  const charge = tinctureHex(b.chargeTincture);
  return (
    <svg width={size} height={(size * 70) / 60} viewBox="0 0 60 70" role="img" aria-label={title ?? `Arms of ${seed}`}>
      <defs><clipPath id={id}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        {b.division === 'plain' && <rect width="60" height="70" fill={f1} />}
        {b.division === 'perPale' && (<><rect x="0" width="30" height="70" fill={f1} /><rect x="30" width="30" height="70" fill={f2} /></>)}
        {b.division === 'perFess' && (<><rect y="0" width="60" height="35" fill={f1} /><rect y="35" width="60" height="35" fill={f2} /></>)}
        {b.division === 'perBend' && (<><rect width="60" height="70" fill={f1} /><polygon points="0,70 60,70 60,0" fill={f2} /></>)}
        <ChargeShape charge={b.charge} fill={charge} />
      </g>
      <path d={SHIELD} fill="none" stroke="#e8e8ee" strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}
