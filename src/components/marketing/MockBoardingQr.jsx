/** Decorative boarding-pass QR that reads like a real code (finders + modules). */

const SIZE = 21;

function inFinderZone(x, y) {
  const inTL = x < 8 && y < 8;
  const inTR = x >= SIZE - 8 && y < 8;
  const inBL = x < 8 && y >= SIZE - 8;
  return inTL || inTR || inBL;
}

function paintFinder(modules, ox, oy) {
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const onRing = x === 0 || y === 0 || x === 6 || y === 6;
      const inEye = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      if (onRing || inEye) modules.add(`${ox + x},${oy + y}`);
    }
  }
}

function buildModules() {
  const modules = new Set();
  paintFinder(modules, 0, 0);
  paintFinder(modules, SIZE - 7, 0);
  paintFinder(modules, 0, SIZE - 7);

  // Timing patterns between finders
  for (let i = 8; i <= 12; i += 1) {
    if (i % 2 === 0) {
      modules.add(`${i},6`);
      modules.add(`6,${i}`);
    }
  }

  // Alignment-ish block (lower-right area of v1-style codes)
  for (let y = 16; y <= 18; y += 1) {
    for (let x = 16; x <= 18; x += 1) {
      const ring = x === 16 || y === 16 || x === 18 || y === 18;
      const center = x === 17 && y === 17;
      if (ring || center) modules.add(`${x},${y}`);
    }
  }

  // Deterministic data modules — irregular like a scanned pass QR
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (inFinderZone(x, y)) continue;
      if (y === 6 || x === 6) continue; // keep timing channel clear of noise
      const n = (x * 17 + y * 29 + x * y * 3) % 11;
      if (n === 0 || n === 3 || n === 7) modules.add(`${x},${y}`);
    }
  }

  return modules;
}

const MODULES = buildModules();

export default function MockBoardingQr({ className = 'pg-wallet-pass-qr', title = 'QR εισιτηρίου' } = {}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width={SIZE} height={SIZE} fill="#ffffff" />
      {[...MODULES].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return <rect key={key} x={x} y={y} width="1" height="1" fill="#0f172a" />;
      })}
    </svg>
  );
}
