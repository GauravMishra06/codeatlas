/**
 * GraphControls — floating control panel for the graph visualization.
 * Allows users to toggle labels and adjust simulation parameters.
 *
 * @param {{ config: object, onChange: Function }} props
 */
export default function GraphControls({ config, onChange }) {
  return (
    <div className="absolute top-4 right-4 z-10">
      <div className="p-3 rounded-xl bg-atlas-card/90 border border-atlas-border backdrop-blur-sm shadow-lg">
        <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-3">
          Controls
        </h4>

        {/* Show labels toggle */}
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <button
            onClick={() => onChange({ ...config, showLabels: !config.showLabels })}
            className={`relative w-8 h-4.5 rounded-full transition-colors duration-200 ${
              config.showLabels ? 'bg-atlas-blue' : 'bg-atlas-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${
                config.showLabels ? 'translate-x-3.5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-xs text-atlas-text">Labels</span>
        </label>


        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-atlas-border">
          <h4 className="text-xs font-semibold text-atlas-muted uppercase tracking-wider mb-2">
            Legend
          </h4>
          <div className="space-y-1.5">
            {[
              { color: '#58A6FF', label: 'File' },
              { color: '#3FB950', label: 'Module' },
              { color: '#BC8CFF', label: 'Function' },
              { color: '#E3B341', label: 'Feature' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-atlas-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
