import { Navigate, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { AskPage } from './pages/AskPage'
import { FixGrammarPage } from './pages/FixGrammarPage'
import { HomePage } from './pages/HomePage'

const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL
const normalizedBasename = basename ? basename.replace(/\/$/, '') : undefined

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        {
          index: true,
          element: <HomePage />,
        },
        {
          path: 'tools/ask',
          element: <AskPage />,
        },
        {
          path: 'tools/fix-grammar',
          element: <FixGrammarPage />,
        },
        {
          path: '*',
          element: <Navigate to="/" replace />,
        },
      ],
    },
  ],
  { basename: normalizedBasename },
)
