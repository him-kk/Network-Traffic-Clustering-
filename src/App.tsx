import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import Dashboard from './dashboard/Dashboard';
import './App.css';

function App() {
  useEffect(() => {
    document.title = 'Network Traffic Clustering Platform';
    
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'Advanced Network Traffic Clustering and Anomaly Detection Platform');
    }
    
    document.documentElement.lang = 'en';
  }, []);

  return (
    <>
      <Dashboard />
      <Toaster position="top-right" />
    </>
  );
}

export default App;
