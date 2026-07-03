import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { connectRepo } from '../services/api';
import Navbar from '../components/Shared/Navbar';

/**
 * Connect page — input form to connect a GitHub repository.
 */
export default function Connect() {
  const navigate = useNavigate();
  const [repoFullName, setRepoFullName] = useState('');

  const mutation = useMutation({
    mutationFn: () => connectRepo(repoFullName),
    onSuccess: (data) => {
      navigate(`/repo/${data.repo.id}`);
    },
  });

  /**
   * Handle form submission.
   * @param {React.FormEvent} e
   */
  function handleSubmit(e) {
    e.preventDefault();
    if (!repoFullName.trim()) return;
    mutation.mutate();
  }

  return (
    <div className="min-h-screen bg-atlas-bg">
      <Navbar />

      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="animate-fade-in">
          {/* Header */}
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-atlas-muted hover:text-atlas-text text-sm mb-8 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>

          <h1 className="text-2xl font-bold text-atlas-text mb-2">Connect a Repository</h1>
          <p className="text-atlas-muted mb-8">
            Enter the full name of a GitHub repository to start mapping its architecture.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="repo-name"
                className="block text-sm font-medium text-atlas-text mb-2"
              >
                Repository
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="1.5">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
                  </svg>
                </div>
                <input
                  id="repo-name"
                  type="text"
                  value={repoFullName}
                  onChange={(e) => setRepoFullName(e.target.value)}
                  placeholder="owner/repository"
                  className="w-full pl-12 pr-4 py-3 bg-atlas-card border border-atlas-border rounded-xl text-atlas-text placeholder-atlas-muted/50 focus:outline-none focus:border-atlas-blue/50 focus:ring-1 focus:ring-atlas-blue/20 transition-all"
                  disabled={mutation.isPending}
                />
              </div>
              <p className="text-xs text-atlas-muted mt-2">
                Example: <span className="text-atlas-blue/80 font-mono">facebook/react</span>,{' '}
                <span className="text-atlas-blue/80 font-mono">vercel/next.js</span>
              </p>
            </div>

            {/* Error */}
            {mutation.isError && (
              <div className="p-4 rounded-lg bg-atlas-red/10 border border-atlas-red/20 text-atlas-red text-sm animate-fade-in">
                {mutation.error?.response?.data?.error || 'Failed to connect repository. Please check the name and try again.'}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={mutation.isPending || !repoFullName.trim()}
              className="w-full py-3 bg-atlas-blue hover:bg-atlas-blue/90 disabled:bg-atlas-blue/30 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  Connect & Analyze
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Info card */}
          <div className="mt-8 p-4 rounded-xl bg-atlas-card/50 border border-atlas-border">
            <h3 className="text-sm font-medium text-atlas-text mb-2">What happens next?</h3>
            <ul className="space-y-2 text-xs text-atlas-muted">
              <li className="flex items-start gap-2">
                <span className="text-atlas-blue mt-0.5">1.</span>
                We fetch all code files from the repository
              </li>
              <li className="flex items-start gap-2">
                <span className="text-atlas-blue mt-0.5">2.</span>
                Files are analyzed to extract imports, exports, and functions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-atlas-blue mt-0.5">3.</span>
                A knowledge graph is built from the code structure
              </li>
              <li className="flex items-start gap-2">
                <span className="text-atlas-blue mt-0.5">4.</span>
                You can explore, query, and track PR impacts instantly
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
