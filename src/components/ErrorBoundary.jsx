import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8 text-center gap-3">
          <p className="text-red-700 font-bold">Κάτι πήγε στραβά στη σελίδα.</p>
          <p className="text-sm text-gray-600 max-w-md">{String(this.state.error?.message || this.state.error)}</p>
          <a href="/" className="text-[#0040df] font-bold text-sm">
            Αρχική
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
