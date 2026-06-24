import { createBrowserRouter } from 'react-router-dom'
import App from './App'

const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL
const normalizedBasename = basename ? basename.replace(/\/$/, '') : undefined

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [],
    },
  ],
  { basename: normalizedBasename },
)
