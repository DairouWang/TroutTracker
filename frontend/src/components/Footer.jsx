import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-nav">
          <Link to="/about" className="footer-link">Privacy</Link>
          <span className="footer-separator">·</span>
          <Link to="/feedback" className="footer-link">Contact</Link>
        </div>
        <p className="footer-note">
          TroutTracker uses anonymous analytics to improve the site. No personal information is collected.
        </p>
        <p className="footer-copy">© 2025 TroutTracker. Designed & Built by Dairou Wang.</p>
      </div>
    </footer>
  )
}

export default Footer

