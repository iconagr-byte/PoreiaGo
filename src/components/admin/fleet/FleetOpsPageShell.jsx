import FleetOpsHubNav from './FleetOpsHubNav.jsx';

/** Shared shell for fleet ops sub-pages (calendar, availability, …). */
export default function FleetOpsPageShell({ activeTab, onNavigate, children }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-stack-lg">
      <FleetOpsHubNav activeTab={activeTab} onNavigate={onNavigate} showOverviewLink compact />
      {children}
    </div>
  );
}
