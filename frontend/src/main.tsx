import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center" toastOptions={{
        style: { background: '#1a1d27', color: '#e4e4e7', border: '1px solid #2a2d37' },
      }} />
    </BrowserRouter>
  </React.StrictMode>,
)
