import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../global.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './firebase'
import './devtoolsShim'
import App from './App.tsx'
import { AuthProvider } from './components/AuthContext'
import { LoreProvider } from './components/LoreContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LoreProvider>
          <App />
        </LoreProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
