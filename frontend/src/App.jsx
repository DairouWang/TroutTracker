import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Feedback from './pages/Feedback'
import './App.css'

function App() {
  const location = useLocation()
  const isScrollablePage = location.pathname === '/about' || location.pathname === '/feedback'

  return (
    <div className={`app ${isScrollablePage ? 'app--scrollable' : ''}`}>
      <Header />
      <main className="app-page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {isScrollablePage && <Footer />}
    </div>
  )
}

export default App
