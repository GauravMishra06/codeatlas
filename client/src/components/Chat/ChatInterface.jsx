import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryCodebase } from '../../services/api';
import ChatMessage from './ChatMessage';
import LoadingSpinner from '../Shared/LoadingSpinner';

/**
 * ChatInterface — natural-language chat for querying the codebase.
 * Maintains a local message history and sends queries via the API.
 *
 * @param {{ repoId: string }} props
 */
export default function ChatInterface({ repoId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const storageKey = `codeatlas_chat:${repoId || 'unknown'}`;

  const starterPrompts = [
    'Explain the auth flow',
    'What changed last week?',
    'Which modules are most connected?',
    'What does the main entry point do?',
  ];

  /**
   * Auto-scroll to the bottom when new messages are added.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!repoId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // Ignore malformed cache entries.
    }
  }, [repoId, storageKey]);

  useEffect(() => {
    if (!repoId) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // Ignore storage quota or serialization issues.
    }
  }, [messages, repoId, storageKey]);

  const mutation = useMutation({
    mutationFn: (question) => queryCodebase(repoId, question),
    onSuccess: (data, question) => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'ai',
          text: data.answer,
          relatedNodes: data.relatedNodes || [],
        },
      ]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'ai',
          text: 'Sorry, I couldn\'t process that query. Please try again.',
          relatedNodes: [],
        },
      ]);
    },
  });

  /**
   * Send a message to the codebase query API.
   * @param {string} text - The question to ask.
   */
  function sendMessage(text) {
    const question = text.trim();
    if (!question) return;

    // Add user message
    setMessages((prev) => [...prev, { type: 'user', text: question }]);
    setInput('');

    // Send query
    mutation.mutate(question);
  }

  /**
   * Handle form submission.
   * @param {React.FormEvent} e
   */
  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-atlas-blue/10 border border-atlas-blue/20 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-atlas-text mb-1">
              Ask your codebase anything
            </h3>
            <p className="text-xs text-atlas-muted mb-6 max-w-xs">
              Get instant answers about architecture, dependencies, and recent changes.
            </p>

            {/* Starter Prompts */}
            <div className="space-y-2 w-full max-w-xs">
              {starterPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-atlas-card/50 border border-atlas-border hover:border-atlas-blue/30 text-xs text-atlas-muted hover:text-atlas-text transition-all duration-200"
                >
                  <span className="text-atlas-blue mr-2">→</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {/* Loading indicator */}
        {mutation.isPending && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-atlas-card/50 border border-atlas-border animate-fade-in">
            <LoadingSpinner size="sm" />
            <span className="text-xs text-atlas-muted">
              Searching the codebase...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-atlas-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your codebase..."
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 bg-atlas-card border border-atlas-border rounded-xl text-sm text-atlas-text placeholder-atlas-muted/50 focus:outline-none focus:border-atlas-blue/50 focus:ring-1 focus:ring-atlas-blue/20 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={mutation.isPending || !input.trim()}
            className="px-4 py-2.5 bg-atlas-blue hover:bg-atlas-blue/90 disabled:bg-atlas-blue/30 disabled:cursor-not-allowed rounded-xl text-white transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
