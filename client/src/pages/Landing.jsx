import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Landing page — hero section with GitHub sign-in.
 * Dark theme with accent blue highlights and animated elements.
 */
export default function Landing() {
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // If user already has a token, redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem('codeatlas_token');
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // Check for error query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      console.error('Auth error:', params.get('error'));
    }
  }, []);

  const features = [
    {
      icon: '🗺️',
      title: 'Living Codebase Map',
      description:
        'Visualize your entire codebase as an interactive force-directed graph. See how files, modules, and functions connect in real time.',
    },
    {
      icon: '🔍',
      title: 'PR Impact Analysis',
      description:
        'Every pull request is automatically analyzed. Know exactly which modules are affected before you merge.',
    },
    {
      icon: '💬',
      title: 'Ask Your Codebase',
      description:
        'Query your codebase in plain English. "What does the auth flow look like?" — instant, context-aware answers.',
    },
  ];

  return (
    <div className="min-h-screen bg-atlas-bg flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        {/* Glow background effect */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-atlas-blue/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Logo & Title */}
        <div className="relative z-10 text-center max-w-3xl animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-atlas-blue/10 border border-atlas-blue/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-atlas-text tracking-tight">
              Code<span className="text-atlas-blue">Atlas</span>
            </h1>
          </div>

          <p className="text-lg md:text-xl text-atlas-muted leading-relaxed mb-10 max-w-2xl mx-auto">
            Your codebase has a story.{' '}
            <span className="text-atlas-text font-medium">
              CodeAtlas makes sure your team always knows it.
            </span>
          </p>

          {/* CTA Button */}
          <button
            onClick={() => {
              window.location.href = `${apiUrl}/auth/github`;
            }}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-atlas-blue/10 hover:bg-atlas-blue/20 border border-atlas-blue/30 hover:border-atlas-blue/50 rounded-xl text-atlas-blue font-semibold text-lg transition-all duration-300 glow-blue hover:scale-[1.02]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Sign in with GitHub
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-1 transition-transform">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Features */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-24 px-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-6 rounded-xl bg-atlas-card/50 border border-atlas-border hover:border-atlas-blue/30 transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-atlas-text mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-atlas-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-atlas-muted text-sm border-t border-atlas-border">
        Built for the{' '}
        <span className="text-atlas-blue font-medium">
          WeMakeDevs × Cognee Hackathon
        </span>{' '}
        — "The Hangover Part AI: Where's My Context?"
      </footer>
    </div>
  );
}
