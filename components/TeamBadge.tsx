import Image from 'next/image';

// Renders a manager's FPL badge at the size asked for; the optimiser shrinks FPL's
// large PNGs. Renders nothing when the manager has no badge.
export default function TeamBadge({ src, size = 20, className = '' }: { src?: string | null; size?: number; className?: string }) {
  if (!src) return null;
  return <Image src={src} alt="" width={size} height={size} className={`shrink-0 rounded-sm object-contain ${className}`} />;
}
