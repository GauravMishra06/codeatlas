/**
 * PRImpactCard — expanded view of a single PR's impact analysis.
 * Shows impacted modules, AI review, changed files, and GitHub link.
 *
 * @param {{ pr: object }} props
 */
export default function PRImpactCard({ pr }) {
  return (
    <div className="mt-2 p-4 rounded-xl bg-atlas-bg border border-atlas-border animate-fade-in">
      {/* Impacted Modules */}
      {pr.impactedModules?.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-2">
            Impacted Modules
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {pr.impactedModules.map((mod, i) => (
              <span
                key={i}
                className="group relative inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-atlas-purple/10 border border-atlas-purple/20 text-xs text-atlas-purple font-medium cursor-default"
                title={mod.reason}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                {mod.name}
                {/* Tooltip on hover */}
                <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-atlas-card border border-atlas-border text-xs text-atlas-muted whitespace-nowrap shadow-lg z-10">
                  {mod.reason}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Review */}
      {pr.review && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-2">
            AI Review
          </h4>
          <div className="p-3 rounded-lg bg-atlas-card border border-atlas-border">
            <p className="text-xs text-atlas-text leading-relaxed whitespace-pre-wrap">
              {pr.review}
            </p>
          </div>
        </div>
      )}

      {/* Changed Files */}
      {pr.changedFiles?.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-2">
            Changed Files ({pr.changedFiles.length})
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {pr.changedFiles.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-atlas-card/50 text-xs font-mono text-atlas-muted"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="1.5">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                <span className="truncate">{file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View on GitHub link */}
      <div className="pt-2 border-t border-atlas-border">
        <a
          href={`https://github.com/search?q=${pr.prNumber}&type=pullrequests`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-atlas-blue hover:text-atlas-blue/80 font-medium transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
          View on GitHub
        </a>
      </div>
    </div>
  );
}
