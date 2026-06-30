import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/admin', state: { activeTab: 'dashboard' } },
  { id: 'routes', label: 'Εκδρομές', icon: 'route', path: '/admin', state: { activeTab: 'routes' } },
  { id: 'customers', label: 'Πελάτες', icon: 'group', path: '/admin', state: { activeTab: 'customers' } },
  { id: 'fleet', label: 'Στόλος', icon: 'directions_bus', path: '/admin', state: { activeTab: 'fleet' } },
  { id: 'lost_found', label: 'Απωλεσθέντα', icon: 'support_agent', path: '/admin', state: { activeTab: 'lost_found' } },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'book_online', path: '/admin', state: { activeTab: 'bookings' }, fill: false },
];

export default function AdminLayout({ activeTab, title, children }) {
  const navigate = useNavigate();

  return (
    <div className="bg-surface text-on-surface h-screen flex overflow-hidden">
      <aside className="w-64 bg-surface-container-lowest border-r border-black/[0.05] hidden md:flex flex-col flex-shrink-0">
        <div className="p-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight text-left"
          >
            PoreiaGo
          </button>
        </div>
        <nav className="flex-1 px-4 py-2 space-y-2">
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
          <button
            type="button"
            onClick={() => navigate('/driver')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Driver Scan
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {title && (
          <header className="h-20 glass-overlay border-b border-black/[0.05] flex items-center px-margin-desktop shrink-0">
            {title}
          </header>
        )}
        <div className="flex-1 overflow-auto p-margin-mobile md:p-margin-desktop">{children}</div>
      </main>
    </div>
  );
}
