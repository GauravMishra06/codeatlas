import { useState } from 'react';
import usePRs from '../../hooks/usePRs';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorState from '../Shared/ErrorState';
import PRImpactCard from './PRImpactCard';

/**
 * PRList — displays a list of analyzed pull requests.
 * Clicking a PR expands the PRImpactCard below it.
 *
 * @param {{ repoId: string }} props
 */
export default function PRList({ repoId }) {
  const { prs, isLoading, isError, error, refetch } = usePRs(repoId);
  const [expandedPR, setExpandedPR] = useState(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner label="Loading PRs..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={error?.message || 'Failed to load PRs'}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-atlas-card border border-atlas-border flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="1.5">
            <path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M18 9a9 9 0 01-9 9" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-atlas-text mb-1">
          No PRs analyzed yet
        </h3>
        <p className="text-xs text-atlas-muted max-w-xs">
          Open a pull request on GitHub to see automatic impact analysis here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4 space-y-2">
        {prs.map((pr) => (
          <div key={pr.id} className="animate-fade-in">
            {/* PR Card */}
            <button
              onClick={() =>
                setExpandedPR(expandedPR === pr.id ? null : pr.id)
              }
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                expandedPR === pr.id
                  ? 'bg-atlas-card border-atlas-blue/30'
                  : 'bg-atlas-card/50 border-atlas-border hover:border-atlas-blue/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-atlas-blue">
                      #{pr.prNumber}
                    </span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        pr.status === 'analyzed'
                          ? 'bg-atlas-green'
                          : pr.status === 'pending'
                          ? 'bg-atlas-yellow'
                          : 'bg-atlas-red'
                      }`}
                    />
                  </div>
                  <h3 className="text-sm font-medium text-atlas-text truncate">
                    {pr.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-atlas-muted">
                    <span>{pr.author}</span>
                    <span>
                      {new Date(pr.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Impact badge */}
                {pr.impactedModules?.length > 0 && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-atlas-purple/10 text-atlas-purple">
                    {pr.impactedModules.length} impacted
                  </span>
                )}
              </div>
            </button>

            {/* Expanded impact card */}
            {expandedPR === pr.id && <PRImpactCard pr={pr} />}
          </div>
        ))}
      </div>
    </div>
  );
}
