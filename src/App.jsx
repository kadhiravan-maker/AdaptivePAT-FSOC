import React, { useState, Component, useEffect } from 'react';
import { Scene3D } from './components/Scene3D';
import { Dashboard } from './components/Dashboard';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', backgroundColor: 'black', height: '100vh', fontFamily: 'monospace' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

import Home from './components/Home';
import ScenarioLab from './scenarios/ScenarioLab';

export default function App() {
  const [quality, setQuality] = useState('MEDIUM');
  const [cameraMode, setCameraMode] = useState({ mode: 'RESET', ts: Date.now() });
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  if (currentPath === '/scenarios') {
    return (
      <ErrorBoundary>
        <ScenarioLab onExit={() => navigate('/')} />
      </ErrorBoundary>
    );
  }

  if (currentPath === '/simulation') {
    return (
      <ErrorBoundary>
        <div className="relative w-screen h-screen overflow-hidden bg-[#020305] font-sans text-white">
          <Scene3D quality={quality} cameraMode={cameraMode} />
          <Dashboard 
            quality={quality} 
            setQuality={setQuality} 
            cameraMode={cameraMode} 
            setCameraMode={setCameraMode} 
            onNavigate={navigate}
          />
        </div>
      </ErrorBoundary>
    );
  }

  // Default to Home
  return (
    <ErrorBoundary>
      <Home onNavigate={navigate} />
    </ErrorBoundary>
  );
}
