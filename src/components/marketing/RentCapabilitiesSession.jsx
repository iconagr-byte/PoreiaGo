/**
 * /rent — Apple-aesthetic session explaining what the whole Rent product can do.
 */
import { RENT_CAPABILITIES_SESSION } from '../../lib/marketing/platformCopy.js';
import '../../styles/rent-marketing-showcase.css';
import '../../styles/platform-service-sessions.css';

function renderHook(hook, accent) {
  if (!accent || !hook.includes(accent)) return hook;
  const [before, after] = hook.split(accent);
  return (
    <>
      {before}
      <em className="rent-cap-hook-accent">{accent}</em>
      {after}
    </>
  );
}

export default function RentCapabilitiesSession() {
  const v = RENT_CAPABILITIES_SESSION.visual;

  const scrollToSearch = (e) => {
    const el = document.getElementById('rent-guest-search');
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section
      id={RENT_CAPABILITIES_SESSION.id}
      className="pg-session rent-cap-session"
      aria-labelledby="rent-cap-hook"
    >
      <div className="rent-cap-intro">
        <p className="rent-cap-kicker rent-cap-rise" style={{ '--pg-rise-delay': '0ms' }}>
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
            auto_awesome
          </span>
          {RENT_CAPABILITIES_SESSION.kicker}
        </p>
        <h2
          id="rent-cap-hook"
          className="rent-cap-hook rent-cap-rise"
          style={{ '--pg-rise-delay': '70ms' }}
        >
          {renderHook(RENT_CAPABILITIES_SESSION.hook, RENT_CAPABILITIES_SESSION.hookAccent)}
        </h2>
        <p className="rent-cap-support rent-cap-rise" style={{ '--pg-rise-delay': '130ms' }}>
          {RENT_CAPABILITIES_SESSION.support}
        </p>
      </div>

      <div className="rent-cap-layout">
        <div className="rent-cap-journey" role="list">
          {RENT_CAPABILITIES_SESSION.groups.map((group, gi) => (
            <div
              key={group.id}
              className="rent-cap-col rent-cap-rise"
              style={{ '--pg-rise-delay': `${180 + gi * 70}ms` }}
              role="listitem"
            >
              <p className="rent-cap-col-label">
                <span>{String(gi + 1).padStart(2, '0')}</span>
                {group.label}
              </p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    <span className="rent-cap-icon material-symbols-outlined" aria-hidden>
                      {item.icon}
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="rent-cap-visual rent-cap-rise"
          style={{ '--pg-rise-delay': '220ms' }}
          aria-hidden
        >
          <div className="rent-cap-pass">
            <div className="rent-cap-pass-top">
              <span className="rent-cap-pass-badge">{v.status}</span>
              <span className="material-symbols-outlined">directions_car</span>
            </div>
            <p className="rent-cap-pass-kicker">{v.title}</p>
            <p className="rent-cap-pass-model">{v.model}</p>
            <p className="rent-cap-pass-meta">{v.meta}</p>
            <div className="rent-cap-pass-qr">
              {Array.from({ length: 25 }).map((_, i) => (
                <i key={i} className={i % 2 === 0 || i % 7 === 0 ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rent-cap-cta-wrap rent-cap-rise" style={{ '--pg-rise-delay': '320ms' }}>
        <a
          href={RENT_CAPABILITIES_SESSION.ctaHref}
          className="rent-cap-cta"
          onClick={scrollToSearch}
        >
          {RENT_CAPABILITIES_SESSION.ctaLabel}
          <span className="material-symbols-outlined" aria-hidden>
            arrow_upward
          </span>
        </a>
      </div>
    </section>
  );
}
