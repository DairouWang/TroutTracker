import React from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Info, MessageSquare } from 'lucide-react'
import './Header.css'

const Header = () => {
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <Link to="/" className="header-title">
            <img src="/TroutTracker%20Logo.png" alt="TroutTracker" className="header-logo" />
          </Link>
          <p className="header-subtitle">
            Washington State Trout Stocking Tracker
          </p>
        </div>
        
        <div className="header-right">
          <nav className="header-nav">
            <NavLink
              to="/about"
              className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
            >
              <Info size={18} strokeWidth={2.5} />
              <span>About</span>
            </NavLink>
            <NavLink
              to="/feedback"
              className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
            >
              <MessageSquare size={18} strokeWidth={2.5} />
              <span>Feedback</span>
            </NavLink>
          </nav>
          <div className="header-right-content">
          </div>
        </div>
      </div>
      {isHomePage && (
        <div className="header-update-banner">
          Data automatically updates daily at 9:00 AM PST
        </div>
      )}
    </header>
  )
}

export default Header

