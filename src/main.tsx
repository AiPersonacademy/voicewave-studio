import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { exportTurboWebM } from './utils/turboExporter'

import { useAppStore } from './store/useAppStore'
import { audioController } from './audio/AudioController'

if (typeof window !== 'undefined') {
  ;(window as any).exportTurboWebM = exportTurboWebM
  ;(window as any).useAppStore = useAppStore
  ;(window as any).audioController = audioController
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
