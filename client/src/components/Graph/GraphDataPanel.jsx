import { useMemo, useState } from 'react';

const NODE_ORDER = ['File', 'Module', 'Function', 'Feature'];

const NODE_COLORS = {
  File: '#58A6FF',
  Module: '#3FB950',
  Function: '#BC8CFF',
  Feature: '#E3B341',
};

function groupNodes(nodes, query) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = nodes.filter((node) => {
    if (!normalizedQuery) return true;
    const searchable = [node.name, node.filePath, node.type, node.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });

  return NODE_ORDER.flatMap((type) => {
    const items = filtered.filter((node) => node.type === type);
    return items.length > 0 ? [{ type, items }] : [];
  }).concat(
    filtered
      .filter((node) => !NODE_ORDER.includes(node.type))
      .length > 0
      ? [{ type: 'Other', items: filtered.filter((node) => !NODE_ORDER.includes(node.type)) }]
      : []
  );
}

export default function GraphDataPanel({ nodes, edges, selectedNode, onSelectNode }) {
  const [activeTab, setActiveTab] = useState('nodes');
  const [query, setQuery] = useState('');

  const groupedNodes = useMemo(() => groupNodes(nodes, query), [nodes, query]);
  const filteredEdges = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return edges;
    return edges.filter((edge) => {
      const sourceName = typeof edge.source === 'object' ? edge.source?.name : edge.source;
      const targetName = typeof edge.target === 'object' ? edge.target?.name : edge.target;
      const searchable = [edge.label, sourceName, targetName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [edges, query]);

  const typeCounts = useMemo(() => {
    return nodes.reduce((acc, node) => {
      const key = node.type || 'Other';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [nodes]);

  return (
    <div className="h-full flex flex-col bg-atlas-card/40">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-atlas-border/80 bg-atlas-card/80 backdrop-blur-sm">
        <div>
          <h3 className="text-sm font-semibold text-atlas-text">Data Explorer</h3>
          <p className="text-xs text-atlas-muted mt-0.5">
            {nodes.length} nodes · {edges.length} edges
          </p>
        </div>
        <div className="flex gap-2 text-[11px] text-atlas-muted">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span key={type} className="px-2 py-1 rounded-full bg-atlas-bg border border-atlas-border">
              {type}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex flex-1 rounded-lg border border-atlas-border bg-atlas-bg px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-atlas-muted mt-0.5 flex-shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes or edges"
            className="ml-2 w-full bg-transparent text-sm text-atlas-text outline-none placeholder:text-atlas-muted"
          />
        </div>

        <div className="inline-flex rounded-lg border border-atlas-border bg-atlas-bg p-1">
          {['nodes', 'edges'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-atlas-blue text-white'
                  : 'text-atlas-muted hover:text-atlas-text'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-4">
        {activeTab === 'nodes' ? (
          <div className="h-full overflow-y-auto pr-1 space-y-4">
            {groupedNodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-atlas-muted">
                No nodes match your search.
              </div>
            ) : (
              groupedNodes.map(({ type, items }) => (
                <section key={type}>
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-atlas-muted">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: NODE_COLORS[type] || '#8B949E' }}
                    />
                    {type}
                    <span className="normal-case font-medium tracking-normal text-atlas-muted">({items.length})</span>
                  </div>

                  <div className="space-y-2">
                    {items.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode(node)}
                        className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                          selectedNode?.id === node.id
                            ? 'bg-atlas-blue/10 border-atlas-blue/30'
                            : 'bg-atlas-bg border-atlas-border hover:border-atlas-blue/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-atlas-text truncate">
                              {node.name}
                            </div>
                            <div className="mt-1 text-xs text-atlas-muted font-mono truncate">
                              {node.filePath || node.description || node.id}
                            </div>
                          </div>
                          <span className="flex-shrink-0 text-[11px] px-2 py-1 rounded-full bg-atlas-card border border-atlas-border text-atlas-muted uppercase">
                            {node.type}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto pr-1 space-y-2">
            {filteredEdges.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-atlas-muted">
                No edges match your search.
              </div>
            ) : (
              filteredEdges.map((edge, index) => {
                const sourceName = typeof edge.source === 'object' ? edge.source?.name : edge.source;
                const targetName = typeof edge.target === 'object' ? edge.target?.name : edge.target;

                return (
                  <div key={`${edge.source}-${edge.target}-${index}`} className="rounded-xl border border-atlas-border bg-atlas-bg px-3 py-3">
                    <div className="text-xs font-semibold text-atlas-blue uppercase tracking-wider mb-1">
                      {edge.label || 'Relationship'}
                    </div>
                    <div className="text-sm text-atlas-text truncate">
                      {sourceName} → {targetName}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
