import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Connect from './pages/Connect';
import RepoView from './pages/RepoView';

/**
 * Protected route wrapper.
 * Redirects to the landing page if no JWT is found in localStorage.
 */
function ProtectedRoute({ children }) {
  const localToken = localStorage.getItem('codeatlas_token');
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');

  if (!localToken && !urlToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/**
 * Root application component.
 * Sets up client-side routing with protected and public routes.
 */
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/connect"
          element={
            <ProtectedRoute>
              <Connect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repo/:id"
          element={
            <ProtectedRoute>
              <RepoView />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
