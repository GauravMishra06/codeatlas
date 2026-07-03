import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '../../services/api';

/**
 * Global navigation bar.
 * Shows CodeAtlas logo, user avatar/username, and disconnect button.
 */
export default function Navbar() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
  });

  const user = data?.user;

  /**
   * Clear JWT and redirect to landing page.
   */
  function handleDisconnect() {
    localStorage.removeItem('codeatlas_token');
    navigate('/', { replace: true });
  }

  return (
    <nav className="h-14 border-b border-atlas-border bg-atlas-bg/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-atlas-blue/10 border border-atlas-blue/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <span className="text-base font-bold text-atlas-text tracking-tight">
            Code<span className="text-atlas-blue">Atlas</span>
          </span>
        </button>

        {/* User controls */}
        {user && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-7 h-7 rounded-full border border-atlas-border"
              />
              <span className="text-sm text-atlas-text font-medium hidden sm:inline">
                {user.username}
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-atlas-muted hover:text-atlas-red transition-colors font-medium"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
