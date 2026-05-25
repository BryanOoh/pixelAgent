import { useCallback, useEffect, useState } from 'react';
import { PixelAgent } from 'pixelagent';
import './app.css';

const INSTALL_CMD = 'npx pixelagent setup';
const THEME_STORAGE_KEY = 'pixelagent-demo-theme';

type Theme = 'dark' | 'light';

const SKILLS = [
  'Click any element to capture selector, source context, and a structured note',
  'Live CSS edit panel — preview changes on the DOM before you apply',
  'One batch diff to your agent or MCP — no screenshots, no guesswork',
];

const NAV_LINKS = ['Work', 'Writing', 'Lab', 'About', 'Contact'];

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function App() {
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const copyInstall = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`$ ${INSTALL_CMD}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  return (
    <div className="site-app">
      <header className="site-nav">
        <div className="site-nav-inner">
          <a href="/" className="site-logo" aria-label="PixelAgent home">
            {/* Same geometry as packages/demo/public/pixelagent-logo.svg */}
            <svg
              className="site-logo-mark"
              viewBox="0 0 24 24"
              width={22}
              height={22}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="3" y="14" width="4" height="4" fill="currentColor" />
              <path fill="currentColor" d="M7 5h12v12L7 5z" />
            </svg>
            <span className="site-logo-text">PixelAgent</span>
          </a>

          <nav className="site-nav-links" aria-label="Primary">
            {NAV_LINKS.map((label) => (
              <a key={label} href="#" className="site-nav-link">
                {label}
              </a>
            ))}
          </nav>

          <div className="site-nav-actions">
            <button
              type="button"
              className="site-theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button type="button" className="site-btn site-btn-outline">
              Get in touch
            </button>
            <button type="button" className="site-btn site-btn-primary">
              Try PixelAgent
              <ChevronDownIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">
        <section className="site-hero">
          <div className="site-hero-badges">
            <span className="site-badge site-badge-outline">PixelAgent</span>
            <span className="site-badge site-badge-beta">Early access</span>
          </div>

          <h1 className="site-hero-title">
            <span className="site-hero-title-bright">See your app.</span>
            <br />
            <span className="site-hero-title-dim">Change your code.</span>
          </h1>

          <p className="site-hero-lead">
            PixelAgent is a live DOM layer for vibe coders — annotate elements, tweak styles in
            place, and ship one structured diff to your agent. No screenshots. No round-trips.
          </p>

          <div className="site-install-pill">
            <code className="site-install-cmd">
              <span className="site-install-prompt">$</span> {INSTALL_CMD}
            </code>
            <button
              type="button"
              className="site-install-copy"
              onClick={copyInstall}
              aria-label={copied ? 'Copied' : 'Copy install command'}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>

          <div className="site-hero-ctas">
            <button type="button" className="site-btn site-btn-primary">
              Read docs
              <span aria-hidden="true">&rsaquo;</span>
            </button>
            <button type="button" className="site-btn site-btn-outline">
              Open demo
            </button>
          </div>
        </section>

        <hr className="site-divider" aria-hidden="true" />

        <section className="site-skills">
          <div className="site-skills-copy">
            <h2 className="site-skills-heading">
              <SkillsIcon />
              Modes
            </h2>
            <p className="site-skills-body">
              Two complementary workflows on the same live page — zero AI cost for annotations,
              optional MCP auto-write when you are ready to patch source.
            </p>
            <ul className="site-skills-list">
              {SKILLS.map((item) => (
                <li key={item}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="site-terminal" aria-label="Terminal preview">
            <div className="site-terminal-chrome">
              <div className="site-terminal-dots">
                <span className="site-terminal-dot site-terminal-dot--red" />
                <span className="site-terminal-dot site-terminal-dot--yellow" />
                <span className="site-terminal-dot site-terminal-dot--green" />
              </div>
              <span className="site-terminal-path">pixelAgent/packages/demo</span>
              <span className="site-terminal-progress">12.04%</span>
            </div>

            <div className="site-terminal-body">
              <p className="site-terminal-prompt">&gt; /tune-glass-blur</p>

              <p className="site-terminal-log">
                <StatusDot color="blue" />
                Thought for 1.8s
              </p>

              <p className="site-terminal-log">
                <StatusDot color="amber" />
                Edit <span className="site-terminal-file">src/glass/GlassSurface.tsx</span>
              </p>

              <pre className="site-terminal-code">
                <code>
                  <span className="tok-keyword">const</span>{' '}
                  <span className="tok-plain">frost = </span>
                  <span className="tok-string">'blur(4px) saturate(130%)'</span>
                  <span className="tok-plain">;</span>
                  {'\n'}
                  <span className="tok-line-highlight">
                    <span className="tok-plain">backdropFilter: </span>
                    <span className="tok-string">{`\${frost} url(#\${filterId})`}</span>
                    <span className="tok-plain">,</span>
                  </span>
                  {'\n'}
                  <span className="tok-comment">// refraction + frosted backdrop</span>
                </code>
              </pre>
            </div>

            <div className="site-terminal-status">
              pixelagent <span aria-hidden="true">&bull;</span> edit-mode
            </div>
          </div>
        </section>
      </main>

      <PixelAgent
        hostTheme={theme}
        onHostThemeChange={setTheme}
        ui={{ chromeMode: 'auto' }}
      />
    </div>
  );
}

function StatusDot({ color }: { color: 'blue' | 'amber' }) {
  return <span className={`site-status-dot site-status-dot--${color}`} aria-hidden="true" />;
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M5 11H4.5A1.5 1.5 0 013 9.5v-7A1.5 1.5 0 014.5 1h7A1.5 1.5 0 0113 2.5V3"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 7L5.5 10L11.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 1.5v1.25M8 13.25V14.5M14.5 8H13.25M2.75 8H1.5M12.364 3.636l-.884.884M4.52 11.48l-.884.884M12.364 12.364l-.884-.884M4.52 4.52l-.884-.884"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.5 9.5a5.5 5.5 0 1 1-8-4.5 4.5 4.5 0 0 0 8 4.5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkillsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="13" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="5" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="13" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
