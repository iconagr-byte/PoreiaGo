/** Διακριτό, minimal φόντο για σελίδες κράτησης / checkout */
export default function MinimalPageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="absolute top-[38%] -left-28 h-80 w-80 rounded-full bg-primary-fixed/[0.12] blur-[90px]" />
      <div className="absolute -bottom-16 right-[12%] h-56 w-56 rounded-full bg-[#b8c3ff]/25 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0, 64, 223, 0.045) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-surface/80" />
    </div>
  );
}
