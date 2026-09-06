import { RENT_BOOKING_STEPS } from '../../lib/rental/rentBookingExtras.js';

export default function RentBookingStepper({ activeId = 'services' } = {}) {
  const activeIdx = RENT_BOOKING_STEPS.findIndex((s) => s.id === activeId);
  return (
    <ol className="rent-wiz-steps" aria-label="Βήματα κράτησης">
      {RENT_BOOKING_STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        return (
          <li
            key={step.id}
            className={`rent-wiz-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
          >
            <span className="rent-wiz-step-dot" aria-hidden>
              {done ? (
                <span className="material-symbols-outlined">check</span>
              ) : active ? (
                <span className="rent-wiz-step-pulse" />
              ) : null}
            </span>
            <span className="rent-wiz-step-label">
              Βήμα {idx + 1}: {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
