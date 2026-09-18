import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { exportTurboWebM } from './utils/turboExporter'

if (typeof window !== 'undefined') {
  ;(window as any).exportTurboWebM = exportTurboWebM
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
