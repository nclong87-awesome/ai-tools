import { Link } from 'react-router-dom'
import './HomePage.css'

export function HomePage() {
  return (
    <section className="home-page">
      <header className="home-page__hero">
        <p className="home-page__eyebrow">Agent Framework</p>
      </header>

      <section className="home-page__tools" aria-label="Available tools">
        <article className="tool-card">
          <Link
            to="/tools/fix-grammar"
            className="tool-card__icon-button"
            aria-label="Open Fix Grammar tool"
          >
            <span aria-hidden="true">Aa</span>
          </Link>
          <h2>Fix Grammar</h2>
          <p>Correct grammar and continue revisions in the same session context.</p>
        </article>

        <article className="tool-card tool-card--soon" aria-label="More tools coming soon">
          <div className="tool-card__soon-icon" aria-hidden="true">
            +
          </div>
          <h2>More tools soon</h2>
          <p>Add your next language assistant and it will appear here.</p>
        </article>
      </section>
    </section>
  )
}
