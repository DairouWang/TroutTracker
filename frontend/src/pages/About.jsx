import { Link } from 'react-router-dom'
import './About.css'

const challenges = [
  'The reports are long and not mobile-friendly',
  'Lake names are inconsistent and hard to search',
  'Copying names into Google Maps often leads to the wrong location',
  "There's no easy way to visually see where trout were planted"
]

const howToUseFeatures = [
  {
    icon: '📅',
    title: 'Browse Recent Stockings',
    desc: 'View all trout plants from the last few days or weeks'
  },
  {
    icon: '👆',
    title: 'Tap to See Details',
    desc: 'Species, quantity, date, and notes'
  },
  {
    icon: '🗺️',
    title: 'Map View',
    desc: 'Each lake shows its exact location'
  },
  {
    icon: '🚙',
    title: 'One-Tap Navigation',
    desc: 'Jump directly to Google Maps for driving directions'
  }
]

const disclaimers = [
  'TroutTracker is provided "as is"',
  'I am not responsible for any fishing outcomes, travel decisions, or data errors',
  'Always verify rules, seasons, and regulations with WDFW directly'
]

const About = () => {
  return (
    <div className="about-page">
      <div className="about-container">
        
        {/* Hero Section */}
        <header className="about-hero">
          <div className="about-badge">What is TroutTracker?</div>
          <h1 className="about-title">TroutTracker helps Washington anglers quickly find recently stocked trout.</h1>
          <p className="about-subtitle">
            Instead of digging through long stocking reports, you can view fresh data, clean lake names, and map locations - all in one simple interface.
          </p>
          <div className="solution-highlight" style={{ marginTop: '1rem', alignSelf: 'center' }}>
            Fast, clear, and made for people who love fishing.
          </div>
          <Link to="/" className="about-cta" style={{ marginTop: '2rem' }}>
            Start Tracking <span>→</span>
          </Link>
        </header>

        {/* Why & Problem Grid */}
        <section className="about-grid-section">
          {/* Left Side: The Story & Challenges (Roadblocks) */}
          <div className="about-card story-card problem-card-left">
            <h3>The roadblocks I kept hitting</h3>
            <div className="story-content">
              <p>
                I fish almost every day, and checking the WDFW trout stocking reports became part of my routine. But the process was friction-heavy.
              </p>
              <ul className="challenge-list">
                {challenges.map((item, i) => (
                  <li key={i} className="challenge-item">
                    <span className="check-icon">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Side: The Solution (Emphasized) */}
          <div className="about-card solution-card-right">
            <h3>So I built TroutTracker</h3>
            <div className="story-content">
              <p className="solution-lead">
                This app automatically pulls the newest trout stocking data, cleans up lake names, and places them clearly on a map.
              </p>
              
              <div className="solution-features">
                <div className="solution-feature-item">
                  <span className="solution-icon">⚡</span>
                  <span>Instantly see the most recent trout plants</span>
                </div>
                <div className="solution-feature-item">
                  <span className="solution-icon">👆</span>
                  <span>Tap a lake to view details</span>
                </div>
                <div className="solution-feature-item">
                  <span className="solution-icon">🗺️</span>
                  <span>Navigate there with one click</span>
                </div>
              </div>

              <p>
                I made this tool because I needed it myself - and hopefully other anglers will find it useful too.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <h2 className="section-title">How to Use</h2>
          <p className="section-subtitle">Simple and built for quick weekend planning.</p>
          <div className="features-grid">
            {howToUseFeatures.map((feature, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h4>{feature.title}</h4>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback & Disclaimer Grid */}
        <section className="about-grid-section">
          <div className="about-card analytics-card">
            <h3>Analytics & Privacy</h3>
            <div className="story-content">
              <p>
                To keep TroutTracker fast and reliable, we use anonymous analytics to understand overall usage patterns — such as which lakes users view most often.
              </p>
              <p>
                No personal information is stored, and we do not sell or share any data.
              </p>
            </div>
          </div>

          <div className="about-card">
            <h3>Feedback Welcome</h3>
            <div className="story-content">
              <p>
                TroutTracker is still in early access, and real angler feedback means everything. If something looks wrong, confusing, or could be improved, please let me know.
              </p>
              <p>
                Feature suggestions are also welcome - they shape what comes next. Your input directly makes the app better for everyone.
              </p>
            </div>
          </div>

          <div className="about-card disclaimer-card-inner">
            <h3>Legal Disclaimer</h3>
            <div className="story-content">
              <p>
                TroutTracker is a non-commercial, community-driven project. All stocking information comes from publicly available WDFW reports. While I do my best to keep data accurate and updated, I cannot guarantee completeness, accuracy, or real-time correctness.
              </p>
              <ul className="about-disclaimer-list">
                {disclaimers.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="about-small">
                This project is built for fun and convenience - use it at your own discretion.
              </p>
            </div>
            <div className="footer-links" style={{ marginTop: '1.5rem', justifyContent: 'flex-start' }}>
              <a 
                href="https://wdfw.wa.gov/fishing/reports/stocking/trout-plants" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Data Source: WDFW
              </a>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

export default About
