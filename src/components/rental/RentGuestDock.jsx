/**
 * Guest /rent bottom dock — book-first home (not a Hertz clone).
 * Book · My rentals · Account · Help
 */
export default function RentGuestDock({
  active = 'book',
  onBook,
  onRentals,
  onAccount,
  onHelp,
  helpHref = '',
} = {}) {
  const items = [
    {
      id: 'book',
      label: 'Κράτηση',
      icon: 'directions_car',
      onClick: onBook,
    },
    {
      id: 'rentals',
      label: 'Οι ενοικιάσεις μου',
      icon: 'event_note',
      onClick: onRentals,
    },
    {
      id: 'account',
      label: 'Λογαριασμός',
      icon: 'person',
      onClick: onAccount,
    },
    {
      id: 'help',
      label: 'Βοήθεια',
      icon: 'help',
      onClick: onHelp,
      href: helpHref || undefined,
    },
  ];

  return (
    <nav className="rent-guest-dock" aria-label="Μενού ενοικίασης">
      {items.map((item) => {
        const isActive = active === item.id;
        const className = `rent-guest-dock-item${isActive ? ' is-active' : ''}`;
        if (item.href) {
          return (
            <a key={item.id} className={className} href={item.href} aria-current={isActive ? 'page' : undefined}>
              <span className="material-symbols-outlined" aria-hidden>
                {item.icon}
              </span>
              <span className="rent-guest-dock-label">{item.label}</span>
            </a>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={className}
            aria-current={isActive ? 'page' : undefined}
            onClick={item.onClick}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {item.icon}
            </span>
            <span className="rent-guest-dock-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
