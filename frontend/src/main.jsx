import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import mixpanel from 'mixpanel-browser'
import App from './App.jsx'
import './index.css'

// Initialize Mixpanel Autocapture
mixpanel.init('3cdea1dcd4fe1af85df5b75926c84954', {
  autocapture: true,
  record_sessions_percent: 100,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

