import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useLayout } from './store/layoutStore'
import { useUi } from './store/uiStore'
import { installDiagnostics, reportDiag } from './lib/diagnostics'
import { ErrorBoundary } from './ui/ErrorBoundary'

installDiagnostics()

// 開發模式下把 store 掛在 window，方便在 DevTools / 自動化測試中檢查與操作
if (import.meta.env.DEV) Object.assign(window, { __layout: useLayout, __ui: useUi })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      onError={(e) => reportDiag('crash', e.message)}
      fallback={(e) => (
        <div style={{ padding: 24, color: '#fecaca', background: '#0f172a', minHeight: '100dvh', font: '14px system-ui' }}>
          <p>畫面載入失敗：{e.message}</p>
          <p style={{ opacity: 0.7 }}>請截圖這段文字回報，並說明手機型號與 iOS 版本。</p>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
