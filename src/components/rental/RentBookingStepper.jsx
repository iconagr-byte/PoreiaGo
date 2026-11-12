import { RENT_BOOKING_STEPS } from '../../lib/rental/rentBookingExtras.js';

const SHORT_LABELS = {
  trip: 'Παραλαβή',
  vehicle: 'Όχημα',
  services: 'Υπηρεσίες',
  details: 'Στοιχεία',
  payment: 'Πληρωμή',
};

export default function RentBookingStepper({ activeId = 'services' } = {}) {
  const activeIdx = RENT_BOOKING_STEPS.findIndex((s) => s.id === activeId);
  return (
    <ol className="rent-wiz-steps rent-wiz-steps--compact" aria-label="Βήματα κράτησης">
      {RENT_BOOKING_STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        const short = SHORT_LABELS[step.id] || step.short || step.label;
        return (
          <li
            key={step.id}
            className={`rent-wiz-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
            aria-current={active ? 'step' : undefined}
            title={`Βήμα ${idx + 1}: ${step.label}`}
          >
            <span className="rent-wiz-step-dot" aria-hidden>
              {done ? (
                <span className="material-symbols-outlined">check</span>
              ) : active ? (
                <span className="rent-wiz-step-pulse" />
              ) : (
                <span className="rent-wiz-step-num">{idx + 1}</span>
              )}
            </span>
            <span className="rent-wiz-step-label">{short}</span>
          </li>
        );
      })}
    </ol>
  );
}
