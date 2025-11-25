import React from 'react'
import './Header.css'

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">
            🐟 TroutTracker
          </h1>
          <p className="header-subtitle">
            Washington State Trout Stocking Tracker
          </p>
        </div>
        
        <div className="header-right">
          <div className="header-right-content">
            <a
              href="https://wdfw.wa.gov/fishing/reports/stocking/trout-plants"
              target="_blank"
              rel="noopener noreferrer"
              className="header-link"
            >
              Data Source: WDFW
            </a>
            <p className="header-update-info">
              Data automatically updates daily at 9:00 AM PST
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

