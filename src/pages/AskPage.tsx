import { Link } from 'react-router-dom'
import { AskPanel } from '../components/AskPanel'
import './AskPage.css'

export function AskPage() {
  return (
    <section className="ask-page">
      <div className="ask-page__toolbar">
        <Link to="/" className="ask-page__home-link">
          <span aria-hidden="true">&lt;-</span>
          <span>Home</span>
        </Link>
      </div>

      <AskPanel />
    </section>
  )
}
