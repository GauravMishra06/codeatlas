import { useQuery } from '@tanstack/react-query';
import { getOnboarding } from '../../services/api';
import LoadingSpinner from '../Shared/LoadingSpinner';

/**
 * OnboardingPanel — guided tour through the repo graph structure.
 */
export default function OnboardingPanel({ repoId, onHighlightNodes, onAskQuestion }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['onboarding', repoId],
    queryFn: () => getOnboarding(repoId),
    enabled: !!repoId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner label="Building onboarding tour..." />
      </div>
    );
  }

  if (isError || !data?.tour?.steps?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-atlas-blue/10 border border-atlas-blue/20 flex items-center justify-center mb-4">
          <span className="text-xl">🧭</span>
        </div>
        <h3 className="text-sm font-semibold text-atlas-text mb-1">Tour not ready yet</h3>
        <p className="text-xs text-atlas-muted max-w-xs">
          Connect and ingest a repository first. The guided tour builds from your code graph.
        </p>
      </div>
    );
  }

  const { tour, contextDebt } = data;

  return (
    <div className="overflow-y-auto h-full p-4 space-y-4">
      <div className="p-4 rounded-xl bg-gradient-to-br from-atlas-blue/10 to-atlas-purple/10 border border-atlas-blue/20">
        <h3 className="text-sm font-semibold text-atlas-text mb-1">Welcome to {tour.title}</h3>
        <p className="text-xs text-atlas-muted mb-3">
          {tour.steps.length - 1} areas mapped · guided onboarding in {tour.steps.length} steps
        </p>
        {contextDebt && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-atlas-bg overflow-hidden">
              <div
                className="h-full rounded-full bg-atlas-green transition-all duration-500"
                style={{ width: `${contextDebt.overall}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-atlas-green">{contextDebt.overall}%</span>
          </div>
        )}
        {contextDebt?.breakdown && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(contextDebt.breakdown).map(([key, val]) => (
              <span key={key} className="text-[10px] px-2 py-0.5 rounded-full bg-atlas-bg border border-atlas-border text-atlas-muted capitalize">
                {key}: {val}%
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {tour.steps.map((step) => (
          <button
            key={step.order}
            type="button"
            onClick={() => onHighlightNodes?.(step.nodeIds || [])}
            className="w-full text-left p-4 rounded-xl bg-atlas-card/50 border border-atlas-border hover:border-atlas-blue/30 transition-all group"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-atlas-blue/10 border border-atlas-blue/20 flex items-center justify-center text-xs font-bold text-atlas-blue">
                {step.order}
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-atlas-text group-hover:text-atlas-blue transition-colors">
                  {step.title}
                </h4>
                <p className="text-xs text-atlas-muted mt-1 leading-relaxed">{step.description}</p>
                {step.filePath && (
                  <p className="text-[10px] font-mono text-atlas-muted/70 mt-1 truncate">{step.filePath}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {onAskQuestion && (
        <button
          type="button"
          onClick={() => onAskQuestion('Give me a 5-minute onboarding summary of this codebase')}
          className="w-full py-3 rounded-xl bg-atlas-blue/10 border border-atlas-blue/20 text-sm text-atlas-blue font-medium hover:bg-atlas-blue/20 transition-colors"
        >
          Ask AI for full onboarding summary →
        </button>
      )}
    </div>
  );
}
