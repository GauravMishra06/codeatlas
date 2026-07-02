import { useQuery } from '@tanstack/react-query';
import { getNodeCode } from '../../services/api';
import LoadingSpinner from '../Shared/LoadingSpinner';

/**
 * NodeDetailPanel — shows exact code snippet and relations for a selected graph node.
 */
export default function NodeDetailPanel({ repoId, node, edges, allNodes, onClose, onSelectNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['nodeCode', repoId, node?.id],
    queryFn: () => getNodeCode(repoId, node.id),
    enabled: !!repoId && !!node?.id,
  });

  if (!node) return null;

  const nodeEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  const resolveName = (id) => allNodes.find((n) => n.id === id)?.name || id;

  const githubUrl = node.filePath && node.filePath !== '/'
    ? `https://github.com/search?q=repo:${encodeURIComponent(node.filePath)}+${node.name}&type=code`
    : null;

  return (
    <div className="absolute bottom-4 left-4 right-4 max-w-md animate-fade-in z-30">
      <div className="p-4 rounded-xl bg-atlas-card border border-atlas-border shadow-xl max-h-[50vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                node.type === 'File'
                  ? 'bg-atlas-blue/10 text-atlas-blue'
                  : node.type === 'Module'
                  ? 'bg-atlas-green/10 text-atlas-green'
                  : node.type === 'Function'
                  ? 'bg-atlas-purple/10 text-atlas-purple'
                  : 'bg-atlas-yellow/10 text-atlas-yellow'
              }`}
            >
              {node.type}
            </span>
            <h3 className="text-sm font-semibold text-atlas-text">{node.name}</h3>
            {node.filePath && (
              <p className="text-xs text-atlas-muted mt-1 font-mono truncate">
                {node.filePath}
                {node.startLine ? `:${node.startLine}${node.endLine ? `-${node.endLine}` : ''}` : ''}
              </p>
            )}
            {node.signature && (
              <p className="text-[11px] text-atlas-muted mt-1 font-mono truncate">{node.signature}</p>
            )}
            {node.source && (
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-atlas-bg border border-atlas-border text-atlas-muted">
                source: {node.source}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-atlas-muted hover:text-atlas-text transition-colors flex-shrink-0 ml-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading && (
          <div className="py-4">
            <LoadingSpinner size="sm" label="Loading code..." />
          </div>
        )}

        {data?.code && (
          <div className="mb-3">
            <h4 className="text-[10px] font-semibold text-atlas-muted uppercase tracking-wider mb-1.5">
              Code
            </h4>
            <pre className="p-3 rounded-lg bg-atlas-bg border border-atlas-border text-[11px] font-mono text-atlas-text overflow-x-auto max-h-40 leading-relaxed">
              {data.code}
            </pre>
          </div>
        )}

        {nodeEdges.length > 0 && (
          <div className="mb-2">
            <h4 className="text-[10px] font-semibold text-atlas-muted uppercase tracking-wider mb-1.5">
              Relations ({nodeEdges.length})
            </h4>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {nodeEdges.slice(0, 8).map((edge, i) => {
                const isOutgoing = edge.source === node.id;
                const otherId = isOutgoing ? edge.target : edge.source;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const other = allNodes.find((n) => n.id === otherId);
                      if (other) onSelectNode?.(other);
                    }}
                    className="w-full text-left px-2 py-1 rounded bg-atlas-bg/50 text-[11px] text-atlas-muted hover:text-atlas-text hover:bg-atlas-bg transition-colors"
                  >
                    <span className="text-atlas-blue">{edge.label || edge.type}</span>
                    {' '}{isOutgoing ? '→' : '←'} {resolveName(otherId)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-atlas-blue hover:text-atlas-blue/80"
          >
            View on GitHub ↗
          </a>
        )}
      </div>
    </div>
  );
}
