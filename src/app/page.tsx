export default function Home() {
  const year = new Date().getFullYear();

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#home">
            bqsgwys
          </a>
          <nav aria-label="Primary" className="nav">
            <a href="#home">Home</a>
            <a href="#projects">Projects</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">Next.js + GitHub Pages</span>
              <h1>Frontend homepage with automatic CI/CD deployment.</h1>
              <p>
                This project is configured for static export so every push to
                <code> main </code>
                can build and publish to GitHub Pages automatically.
              </p>
              <div className="actions">
                <a className="btn primary" href="#projects">
                  View Projects
                </a>
                <a
                  className="btn ghost"
                  href="https://github.com/"
                  rel="noreferrer"
                  target="_blank"
                >
                  GitHub Profile
                </a>
              </div>
            </div>
            <div aria-hidden="true" className="orbit">
              <div className="orb one">Code</div>
              <div className="orb two">Ship</div>
              <div className="orb three">Scale</div>
              <div className="orb center">bqsgwys</div>
            </div>
          </div>
        </section>

        <section id="projects">
          <div className="container">
            <div className="section-title">
              <h2>Featured Projects</h2>
              <p>Replace these cards with your own repositories and demos.</p>
            </div>
            <div className="cards">
              <article className="card">
                <h3>Project One</h3>
                <p>
                  A polished marketing frontend with animations and responsive
                  layout.
                </p>
                <div className="meta">Next.js</div>
              </article>
              <article className="card">
                <h3>Project Two</h3>
                <p>
                  Dashboard UI powered by API data and reusable design tokens.
                </p>
                <div className="meta">React + TypeScript</div>
              </article>
              <article className="card">
                <h3>Project Three</h3>
                <p>
                  Component system optimized for accessibility and mobile
                  performance.
                </p>
                <div className="meta">Design System</div>
              </article>
            </div>
          </div>
        </section>

        <section id="about">
          <div className="container">
            <div className="section-title">
              <h2>About This Setup</h2>
              <p>
                Static output mode keeps deployment simple while preserving the
                Next.js development workflow.
              </p>
            </div>
            <div className="about-grid">
              <article className="panel">
                <h3>Build Target</h3>
                <p>
                  <code>next build</code> generates a static <code>out/</code>{" "}
                  folder for GitHub Pages.
                </p>
              </article>
              <article className="panel">
                <h3>Auto Deployment</h3>
                <p>
                  GitHub Actions uploads <code>out/</code> and deploys it on
                  every push to <code>main</code>.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="contact">
          <div className="container">
            <article className="contact">
              <h2>Contact</h2>
              <p>
                Add your real links here. Example:{" "}
                <a href="mailto:hello@example.com">hello@example.com</a>
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">&copy; {year} bqsgwys</div>
      </footer>
    </>
  );
}
