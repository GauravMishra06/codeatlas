/**
 * Loading spinner with optional label.
 * Uses a CSS-animated SVG ring.
 *
 * @param {{ size?: 'sm'|'md'|'lg', label?: string }} props
 */
export default function LoadingSpinner({ size = 'md', label }) {
  const sizes = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        className={`animate-spin ${sizes[size]} text-atlas-blue`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label && (
        <p className="text-sm text-atlas-muted animate-pulse">{label}</p>
      )}
    </div>
  );
}
