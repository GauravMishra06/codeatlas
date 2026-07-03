/**
 * PRImpactCard — graph-grounded PR impact with relation paths and blast radius trigger.
 */
export default function PRImpactCard({ pr, onHighlightImpact }) {
  return (
    <div className="mt-2 p-4 rounded-xl bg-atlas-bg border border-atlas-border animate-fade-in">
      {(pr.impactedNodeIds?.length > 0 || pr.changedNodeIds?.length > 0) && onHighlightImpact && (
        <button
          type="button"
          onClick={() => onHighlightImpact(pr.impactedNodeIds, pr.changedNodeIds)}
          className="w-full mb-4 py-2.5 rounded-lg bg-atlas-yellow/10 border border-atlas-yellow/30 text-xs font-medium text-atlas-yellow hover:bg-atlas-yellow/20 transition-colors flex items-center justify-center gap-2"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-atlas-yellow opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-atlas-yellow" />
          </span>
          Show blast radius on graph ({pr.impactedNodeIds?.length || 0} nodes)
        </button>
      )}

      {pr.impactedModules?.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-2">
            Graph Impact ({pr.impactedModules.length})
          </h4>
          <div className="space-y-2">
            {pr.impactedModules.map((mod, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-atlas-purple/5 border border-atlas-purple/15"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-atlas-purple">{mod.name}</span>
                  {mod.type && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-atlas-card text-atlas-muted">{mod.type}</span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-atlas-muted mt-0.5 truncate">
                  {mod.filePath}{mod.startLine ? `:${mod.startLine}` : ''}
                </p>
                <p className="text-[11px] text-atlas-muted mt-1">{mod.reason}</p>
                {mod.relationPath?.length > 0 && (
                  <p className="text-[10px] text-atlas-blue/80 mt-1 font-mono truncate">
                    {(mod.relationPath || []).join(' → ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pr.changedFunctions?.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-2">
            Changed Functions
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {pr.changedFunctions.map((fn, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-atlas-purple/10 text-xs text-atlas-purple font-mono">
                {fn}()
              </span>
            ))}
          </div>
        </div>
      )}

      {pr.review && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-2">
            Grounded AI Review
          </h4>
          <div className="p-3 rounded-lg bg-atlas-card border border-atlas-border max-h-64 overflow-y-auto">
            <p className="text-xs text-atlas-text leading-relaxed whitespace-pre-wrap">
              {pr.review}
            </p>
          </div>
        </div>
      )}

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
    </div>
  );
}
