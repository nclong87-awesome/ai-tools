import { Link } from 'react-router-dom'
import './HomePage.css'

export function HomePage() {
  return (
    <section className="home-page">
      <header className="home-page__hero">
        <p className="home-page__eyebrow">AI Tools using Agent Framework</p>
      </header>

      <section className="home-page__tools" aria-label="Available tools">
        <article className="tool-card">
          <Link
            to="/tools/ask"
            className="tool-card__icon-button tool-card__icon-button--ask"
            aria-label="Open Ask tool"
          >
            <span aria-hidden="true">?</span>
          </Link>
          <h2>Ask Assistant</h2>
          <p>Ask any question and continue follow-ups in the same assistant session.</p>
        </article>

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
