import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getGraph } from '../services/api';
import useSocket from '../hooks/useSocket';
import Navbar from '../components/Shared/Navbar';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import ErrorState from '../components/Shared/ErrorState';
import CodeGraph from '../components/Graph/CodeGraph';
import GraphControls from '../components/Graph/GraphControls';
import GraphDataPanel from '../components/Graph/GraphDataPanel';
import NodeDetailPanel from '../components/Graph/NodeDetailPanel';
import PRList from '../components/PRPanel/PRList';
import ChatInterface from '../components/Chat/ChatInterface';
import OnboardingPanel from '../components/Onboarding/OnboardingPanel';

export default function RepoView() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('prs');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);
  const [changedNodeIds, setChangedNodeIds] = useState([]);
  const [relationFilter, setRelationFilter] = useState('all');
  const chatAskRef = useRef(null);
  const [graphConfig, setGraphConfig] = useState({
    showLabels: true,
    chargeStrength: -120,
    linkDistance: 80,
  });

  const handlePRAnalyzed = useCallback((data) => {
    setHighlightedNodeIds(data.impactedNodeIds || []);
    setChangedNodeIds(data.changedNodeIds || []);
  }, []);

  const {
    data: graphData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['graph', id, relationFilter],
    queryFn: () => getGraph(id, relationFilter === 'all' ? null : relationFilter),
    enabled: !!id,
  });

  const { toast } = useSocket(id, graphData?.repoId, { onPRAnalyzed: handlePRAnalyzed });

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];
  const contextDebt = graphData?.contextDebt;

  const handleHighlightFromPR = useCallback((nodeIds, changed) => {
    setHighlightedNodeIds(nodeIds || []);
    setChangedNodeIds(changed || []);
  }, []);

  const handleHighlightFromTour = useCallback((nodeIds) => {
    setHighlightedNodeIds(nodeIds || []);
    setChangedNodeIds([]);
  }, []);

  const clearHighlights = () => {
    setHighlightedNodeIds([]);
    setChangedNodeIds([]);
  };

  const tabs = [
    { id: 'prs', label: 'Pull Requests' },
    { id: 'chat', label: 'Ask Codebase' },
    { id: 'onboard', label: 'Onboarding' },
  ];

  return (
    <div className="min-h-screen bg-atlas-bg flex flex-col">
      <Navbar />

      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-fade-in">
          <div className="px-4 py-3 rounded-xl bg-atlas-green/10 border border-atlas-green/20 text-atlas-green text-sm font-medium flex items-center gap-2 shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-atlas-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-atlas-green" />
            </span>
            {toast}
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-[60%] min-w-0 border-r border-atlas-border flex flex-col bg-atlas-bg/80 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner size="lg" label="Loading graph..." />
            </div>
          )}

          {isError && (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <ErrorState message={error?.message || 'Failed to load graph'} onRetry={refetch} />
            </div>
          )}

          {!isLoading && !isError && (
            <div className="flex flex-col h-full min-h-0 overflow-hidden">
              <div className="relative flex-1 min-h-0 border-b border-atlas-border overflow-hidden">
                <CodeGraph
                  nodes={nodes}
                  edges={edges}
                  onNodeClick={setSelectedNode}
                  config={graphConfig}
                  highlightedNodeIds={highlightedNodeIds}
                  changedNodeIds={changedNodeIds}
                />
                <GraphControls config={graphConfig} onChange={setGraphConfig} />

                {/* Stats + context debt + relation filter */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
                  <span className="px-2.5 py-1 rounded-lg bg-atlas-card/80 border border-atlas-border text-xs text-atlas-muted backdrop-blur-sm">
                    {nodes.length} nodes
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-atlas-card/80 border border-atlas-border text-xs text-atlas-muted backdrop-blur-sm">
                    {edges.length} edges
                  </span>
                  {contextDebt && (
                    <span className="px-2.5 py-1 rounded-lg bg-atlas-green/10 border border-atlas-green/20 text-xs text-atlas-green font-medium backdrop-blur-sm">
                      {contextDebt.overall}% context
                    </span>
                  )}
                  {(highlightedNodeIds.length > 0 || changedNodeIds.length > 0) && (
                    <button
                      type="button"
                      onClick={clearHighlights}
                      className="px-2.5 py-1 rounded-lg bg-atlas-yellow/10 border border-atlas-yellow/20 text-xs text-atlas-yellow backdrop-blur-sm hover:bg-atlas-yellow/20"
                    >
                      Clear blast radius
                    </button>
                  )}
                </div>

                <div className="absolute top-4 right-4 z-10">
                  <select
                    value={relationFilter}
                    onChange={(e) => setRelationFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-atlas-card/80 border border-atlas-border text-xs text-atlas-muted backdrop-blur-sm outline-none"
                  >
                    <option value="all">All relations</option>
                    <option value="contains">Structure only</option>
                    <option value="contains,imports">+ Imports</option>
                    <option value="contains,imports,tests">+ Tests</option>
                  </select>
                </div>

                <NodeDetailPanel
                  repoId={id}
                  node={selectedNode}
                  edges={edges}
                  allNodes={nodes}
                  onClose={() => setSelectedNode(null)}
                  onSelectNode={setSelectedNode}
                />
              </div>

              <div className="border-b border-atlas-border bg-atlas-bg/95">
                <button
                  type="button"
                  onClick={() => setIsExplorerOpen((open) => !open)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-atlas-card/40 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-atlas-text">Data Explorer</div>
                    <div className="text-xs text-atlas-muted">
                      {nodes.length} nodes · {edges.length} edges
                    </div>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-atlas-muted"
                    style={{ transform: isExplorerOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isExplorerOpen && (
                  <div className="h-[28vh] min-h-[220px] max-h-[320px] overflow-hidden border-t border-atlas-border">
                    <GraphDataPanel
                      nodes={nodes}
                      edges={edges}
                      selectedNode={selectedNode}
                      onSelectNode={setSelectedNode}
                      highlightedNodeIds={highlightedNodeIds}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-[40%] flex flex-col min-h-0 overflow-hidden">
          <div className="flex border-b border-atlas-border shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id ? 'text-atlas-blue' : 'text-atlas-muted hover:text-atlas-text'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-atlas-blue rounded-t" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            {activeTab === 'prs' && (
              <PRList repoId={id} onHighlightImpact={handleHighlightFromPR} />
            )}
            {activeTab === 'chat' && (
              <ChatInterface
                repoId={id}
                onRegisterAsk={(fn) => { chatAskRef.current = fn; }}
              />
            )}
            {activeTab === 'onboard' && (
              <OnboardingPanel
                repoId={id}
                onHighlightNodes={handleHighlightFromTour}
                onAskQuestion={(q) => {
                  setActiveTab('chat');
                  setTimeout(() => chatAskRef.current?.(q), 100);
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
