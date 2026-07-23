import { useNavigate } from 'react-router-dom';
import OfficeBrandMark from './storefront/OfficeBrandMark.jsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/admin', state: { activeTab: 'dashboard' } },
  { id: 'routes', label: 'Εκδρομές', icon: 'route', path: '/admin', state: { activeTab: 'routes' } },
  { id: 'customers', label: 'Πελάτες', icon: 'group', path: '/admin', state: { activeTab: 'customers' } },
  { id: 'fleet', label: 'Στόλος', icon: 'directions_bus', path: '/admin', state: { activeTab: 'fleet' } },
  { id: 'lost_found', label: 'Απωλεσθέντα', icon: 'support_agent', path: '/admin', state: { activeTab: 'lost_found' } },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'book_online', path: '/admin', state: { activeTab: 'bookings' }, fill: false },
];

export default function AdminLayout({ activeTab, title, children, footer }) {
  const navigate = useNavigate();

  return (
    <div className="bg-surface text-on-surface h-dvh max-h-dvh flex overflow-hidden">
      <aside className="w-64 bg-surface-container-lowest border-r border-black/[0.05] hidden md:flex flex-col flex-shrink-0">
        <div className="p-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-left"
            aria-label="Αρχική"
          >
            <OfficeBrandMark className="h-9" variant="light" asLink={false} fallbackLabel="Admin" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path, { state: item.state })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-md text-label-md transition-colors ${
                activeTab === item.id
                  ? item.id === 'lost_found'
                    ? 'bg-rose-50 text-rose-600 font-bold'
                    : 'bg-surface-container-low text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={item.fill === false ? undefined : { fontVariationSettings: "'FILL' 1" }}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {title && (
          <header className="min-h-16 sm:h-20 glass-overlay border-b border-black/[0.05] flex items-center px-4 sm:px-margin-desktop shrink-0 py-3">
            {title}
          </header>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-margin-desktop">
          {children}
        </div>
        {footer ? (
          <div
            className="shrink-0 border-t border-black/[0.06] bg-white/95 backdrop-blur-md px-4 sm:px-margin-desktop py-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="max-w-3xl mx-auto">{footer}</div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
