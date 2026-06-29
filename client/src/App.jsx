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
  const token = localStorage.getItem('codeatlas_token');
  if (!token) {
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
    <BrowserRouter>
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
