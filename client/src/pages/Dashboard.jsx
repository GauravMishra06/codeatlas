import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRepos } from '../services/api';
import Navbar from '../components/Shared/Navbar';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import ErrorState from '../components/Shared/ErrorState';

/**
 * Dashboard page — displays all connected repositories.
 * Handles JWT extraction from URL params on OAuth redirect.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract token from URL (OAuth redirect) and store in localStorage
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('codeatlas_token', token);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch repos
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['repos'],
    queryFn: getRepos,
    enabled: !!localStorage.getItem('codeatlas_token'),
  });

  const repos = data?.repos || [];

  return (
    <div className="min-h-screen bg-atlas-bg">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-atlas-text">Your Repositories</h1>
            <p className="text-atlas-muted mt-1">
              Connect a repo to start mapping its architecture
            </p>
          </div>
          <button
            onClick={() => navigate('/connect')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-atlas-blue/10 hover:bg-atlas-blue/20 border border-atlas-blue/30 hover:border-atlas-blue/50 rounded-lg text-atlas-blue font-medium transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect a Repo
          </button>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-6 rounded-xl bg-atlas-card border border-atlas-border">
                <div className="skeleton h-5 w-3/4 mb-3" />
                <div className="skeleton h-4 w-1/2 mb-4" />
                <div className="flex gap-3">
                  <div className="skeleton h-6 w-20 rounded-full" />
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <ErrorState
            message={error?.message || 'Failed to load repositories'}
            onRetry={refetch}
          />
        )}

        {!isLoading && !isError && repos.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-atlas-card border border-atlas-border flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="1.5">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-atlas-text mb-2">No repositories yet</h2>
            <p className="text-atlas-muted mb-6 max-w-md mx-auto">
              Connect your first GitHub repository to start building your living codebase map.
            </p>
            <button
              onClick={() => navigate('/connect')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-atlas-blue hover:bg-atlas-blue/90 rounded-lg text-white font-medium transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Connect Your First Repo
            </button>
          </div>
        )}

        {!isLoading && !isError && repos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {repos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => navigate(`/repo/${repo.id}`)}
                className="group text-left p-6 rounded-xl bg-atlas-card border border-atlas-border hover:border-atlas-blue/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-atlas-text group-hover:text-atlas-blue transition-colors truncate pr-2">
                    {repo.fullName}
                  </h3>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="2" className="flex-shrink-0 mt-0.5 group-hover:stroke-atlas-blue transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {/* Ingestion status */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      repo.isIngested
                        ? 'bg-atlas-green/10 text-atlas-green'
                        : 'bg-atlas-yellow/10 text-atlas-yellow'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${repo.isIngested ? 'bg-atlas-green' : 'bg-atlas-yellow'}`} />
                    {repo.isIngested ? 'Ingested' : 'Processing...'}
                  </span>

                  {/* Node count */}
                  {repo.nodeCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-atlas-purple/10 text-atlas-purple">
                      {repo.nodeCount} nodes
                    </span>
                  )}
                </div>

                {/* Last analyzed */}
                {repo.lastAnalyzed && (
                  <p className="text-xs text-atlas-muted mt-3">
                    Last analyzed {new Date(repo.lastAnalyzed).toLocaleDateString()}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
