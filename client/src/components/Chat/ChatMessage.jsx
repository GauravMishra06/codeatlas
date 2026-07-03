/**
 * ChatMessage — renders a single chat message bubble.
 * User messages are right-aligned (blue); AI messages are left-aligned (dark card).
 * AI messages can include related node pills below the text.
 *
 * @param {{ message: { type: 'user'|'ai', text: string, relatedNodes?: Array } }} props
 */
export default function ChatMessage({ message }) {
  const isUser = message.type === 'user';

  return (
    <div
      className={`flex animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-atlas-blue/15 border border-atlas-blue/20 text-atlas-text'
            : 'bg-atlas-card border border-atlas-border text-atlas-text'
        }`}
      >
        {/* Message text */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>

        {/* Related nodes (AI messages only) */}
        {!isUser && message.relatedNodes?.length > 0 && (
          <div className="mt-3 pt-2 border-t border-atlas-border/50">
            <p className="text-xs text-atlas-muted mb-1.5">Related files:</p>
            <div className="flex flex-wrap gap-1">
              {message.relatedNodes.map((node, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono ${
                    node.type === 'File'
                      ? 'bg-atlas-blue/10 text-atlas-blue'
                      : node.type === 'Function'
                      ? 'bg-atlas-purple/10 text-atlas-purple'
                      : 'bg-atlas-green/10 text-atlas-green'
                  }`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                  {node.filePath || node.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
