import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getGraph } from '../services/api';
import useSocket from '../hooks/useSocket';
import Navbar from '../components/Shared/Navbar';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import ErrorState from '../components/Shared/ErrorState';
import CodeGraph from '../components/Graph/CodeGraph';
import GraphControls from '../components/Graph/GraphControls';
import PRList from '../components/PRPanel/PRList';
import ChatInterface from '../components/Chat/ChatInterface';

/**
 * RepoView page — split layout with graph visualization (left)
 * and a tabbed panel for PRs/Chat (right).
 */
export default function RepoView() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('prs');
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphConfig, setGraphConfig] = useState({
    showLabels: true,
    chargeStrength: -120,
    linkDistance: 80,
  });

  // Socket.io connection for real-time updates
  const { toast } = useSocket(id);

  // Fetch graph data
  const {
    data: graphData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['graph', id],
    queryFn: () => getGraph(id),
    enabled: !!id,
  });

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  return (
    <div className="min-h-screen bg-atlas-bg flex flex-col">
      <Navbar />

      {/* Toast notification */}
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

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel — Graph */}
        <div className="w-[60%] relative border-r border-atlas-border">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner size="lg" label="Loading graph..." />
            </div>
          )}

          {isError && (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <ErrorState
                message={error?.message || 'Failed to load graph'}
                onRetry={refetch}
              />
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <CodeGraph
                nodes={nodes}
                edges={edges}
                onNodeClick={setSelectedNode}
                config={graphConfig}
              />
              <GraphControls config={graphConfig} onChange={setGraphConfig} />

              {/* Node info tooltip */}
              {selectedNode && (
                <div className="absolute bottom-4 left-4 right-4 max-w-sm animate-fade-in">
                  <div className="p-4 rounded-xl bg-atlas-card border border-atlas-border shadow-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                            selectedNode.type === 'File'
                              ? 'bg-atlas-blue/10 text-atlas-blue'
                              : selectedNode.type === 'Module'
                              ? 'bg-atlas-green/10 text-atlas-green'
                              : selectedNode.type === 'Function'
                              ? 'bg-atlas-purple/10 text-atlas-purple'
                              : 'bg-atlas-yellow/10 text-atlas-yellow'
                          }`}
                        >
                          {selectedNode.type}
                        </span>
                        <h3 className="text-sm font-semibold text-atlas-text">
                          {selectedNode.name}
                        </h3>
                        <p className="text-xs text-atlas-muted mt-1 font-mono">
                          {selectedNode.filePath}
                        </p>
                        {selectedNode.description && (
                          <p className="text-xs text-atlas-muted mt-1">
                            {selectedNode.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedNode(null)}
                        className="text-atlas-muted hover:text-atlas-text transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Graph stats */}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-atlas-card/80 border border-atlas-border text-xs text-atlas-muted backdrop-blur-sm">
                  {nodes.length} nodes
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-atlas-card/80 border border-atlas-border text-xs text-atlas-muted backdrop-blur-sm">
                  {edges.length} edges
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right Panel — PRs / Chat */}
        <div className="w-[40%] flex flex-col">
          {/* Tab Switcher */}
          <div className="flex border-b border-atlas-border">
            <button
              onClick={() => setActiveTab('prs')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'prs'
                  ? 'text-atlas-blue'
                  : 'text-atlas-muted hover:text-atlas-text'
              }`}
            >
              Pull Requests
              {activeTab === 'prs' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-atlas-blue rounded-t" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'chat'
                  ? 'text-atlas-blue'
                  : 'text-atlas-muted hover:text-atlas-text'
              }`}
            >
              Ask Codebase
              {activeTab === 'chat' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-atlas-blue rounded-t" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'prs' && <PRList repoId={id} />}
            {activeTab === 'chat' && <ChatInterface repoId={id} />}
          </div>
        </div>
      </main>
    </div>
  );
}
