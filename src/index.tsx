import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  componentDidCatch(error: Error) { console.error('App crash:', error); }
  render() {
    if (this.state.error) {
      return <div style={{padding: 20, color: 'red'}}><h2>Error</h2><pre>{this.state.error.message}{'\n'}{this.state.error.stack}</pre></div>;
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
