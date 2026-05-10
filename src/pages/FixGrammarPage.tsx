import { Link } from 'react-router-dom'
import { FixGrammarPanel } from '../components/FixGrammarPanel'
import './FixGrammarPage.css'

export function FixGrammarPage() {
  return (
    <section className="fix-grammar-page">
      <div className="fix-grammar-page__toolbar">
        <Link to="/" className="fix-grammar-page__home-link">
          <span aria-hidden="true">←</span>
          <span>Home</span>
        </Link>
      </div>

      <FixGrammarPanel />
    </section>
  )
}
