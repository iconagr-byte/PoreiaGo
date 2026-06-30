/** Transparent PoreiaGo wordmark for dark headers */
export default function AchillioLogo({ className = 'h-14 w-auto' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 340 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PoreiaGo"
    >
      <defs>
        <linearGradient id="poreiagoGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5E6B8" />
          <stop offset="45%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#9A7B2F" />
        </linearGradient>
        <linearGradient id="poreiagoGoldLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF3D4" />
          <stop offset="100%" stopColor="#C9A227" />
        </linearGradient>
      </defs>
      <path
        d="M8 50 L26 8 L44 50 H36 L26 30 L16 50 H8 Z"
        fill="url(#poreiagoGold)"
      />
      <text
        x="54"
        y="40"
        fill="url(#poreiagoGold)"
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fontSize="30"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        PoreiaGo
      </text>
      <text
        x="210"
        y="40"
        fill="url(#poreiagoGoldLight)"
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fontSize="22"
        fontWeight="400"
        fontStyle="italic"
        opacity="0.92"
      >
        travel
      </text>
    </svg>
  );
}

/** Preferred export name */
export function PoreiaGoLogo(props) {
  return AchillioLogo(props);
}

/** @deprecated use PoreiaGoLogo */
export function PoreiaLevLogo(props) {
  return AchillioLogo(props);
}

/** @deprecated use PoreiaGoLogo */
export function PoreiaLogo(props) {
  return AchillioLogo(props);
}
