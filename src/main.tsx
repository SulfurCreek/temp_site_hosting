import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useLayout } from './store/layoutStore'
import { useUi } from './store/uiStore'

// 開發模式下把 store 掛在 window，方便在 DevTools / 自動化測試中檢查與操作
if (import.meta.env.DEV) Object.assign(window, { __layout: useLayout, __ui: useUi })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
