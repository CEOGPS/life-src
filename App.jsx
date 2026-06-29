import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/queryClient';
import { AuthProvider } from '@/lib/FirebaseAuthContext';
import { WorkerProvider } from '@/contexts/WorkerContext';
import { ModelProvider } from '@/contexts/ModelContext';
import Home from '@/LifeOSShell';
import './index.css';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <WorkerProvider>
          <ModelProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/Home" element={<Home />} />
              </Routes>
            </BrowserRouter>
          </ModelProvider>
        </WorkerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;