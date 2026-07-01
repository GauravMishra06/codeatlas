/**
 * Error state component with retry button.
 * Displayed when an API call or data fetch fails.
 *
 * @param {{ message?: string, onRetry?: Function }} props
 */
export default function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 px-6 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-atlas-red/10 border border-atlas-red/20 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F78166" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>

      <div>
        <h3 className="text-base font-semibold text-atlas-text mb-1">
          Something went wrong
        </h3>
        <p className="text-sm text-atlas-muted max-w-sm">{message}</p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-atlas-card border border-atlas-border hover:border-atlas-blue/30 rounded-lg text-sm text-atlas-text font-medium transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Try Again
        </button>
      )}
    </div>
  );
}
