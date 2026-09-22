import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Unable to render this view:', error, info.componentStack);
    this.props.onError?.();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className={`bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 ${this.props.className || 'm-4'}`}>
        <p>Something went wrong. Please try reloading the page.</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-sm text-red-400 hover:text-red-300 underline">Reload</button>
        {this.props.onDismiss && <button onClick={this.props.onDismiss} className="ml-4 text-sm text-red-400 hover:text-red-300 underline">Dismiss</button>}
      </div>
    );
  }
}
