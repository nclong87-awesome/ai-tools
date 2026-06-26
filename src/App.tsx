import './App.css'
import { Toaster } from 'sonner'
import { AskPanel } from './components/AskPanel'

function App() {
  return (
    <main className="app-shell">
      <Toaster position="bottom-right" richColors />
      <AskPanel />
    </main>
  )
}

export default App
