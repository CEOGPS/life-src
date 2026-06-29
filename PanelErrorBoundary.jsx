// src/components/PanelErrorBoundary.jsx
import React from 'react';
export class PanelErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div className="panel-error">
        <p>⚠️ Panel failed to load</p>
        <code>{this.state.error?.message}</code>
        <button onClick={() => this.setState({hasError: false})}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}
// Wrap every panel: <PanelErrorBoundary><EmailPanel /></PanelErrorBoundary>