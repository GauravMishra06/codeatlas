import { useState } from 'react';
import ForceGraph from './ForceGraph';
import FlowchartGraph from './FlowchartGraph';

/**
 * CodeGraph Wrapper
 * Provides a UI toggle to switch between the Clustered Force layout and the Flowchart layout.
 */
export default function CodeGraph(props) {
  const [layout, setLayout] = useState('flowchart');

  return (
    <div className="w-full h-full relative">
      {/* Layout Toggle Bar */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex max-w-[calc(100%-2rem)] flex-wrap justify-center bg-atlas-card border border-atlas-border rounded-full p-1 shadow-lg md:top-4">
        <button
          onClick={() => setLayout('flowchart')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
            layout === 'flowchart'
              ? 'bg-atlas-blue text-white'
              : 'text-atlas-muted hover:text-white'
          }`}
        >
          Flowchart Layout
        </button>
        <button
          onClick={() => setLayout('force')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
            layout === 'force'
              ? 'bg-atlas-blue text-white'
              : 'text-atlas-muted hover:text-white'
          }`}
        >
          Force Cluster Layout
        </button>
      </div>

      {/* Render the selected graph layout */}
      {layout === 'flowchart' ? (
        <FlowchartGraph {...props} />
      ) : (
        <ForceGraph {...props} />
      )}
    </div>
  );
}
