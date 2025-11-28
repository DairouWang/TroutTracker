import { useState, useEffect } from 'react'
import Map from '../components/Map'
import Sidebar from '../components/Sidebar'
import StatsPanel from '../components/StatsPanel'
import { getTroutPlants, getStatistics } from '../services/api'
import { trackLakeClick } from '../services/analytics'

const Home = () => {
  const [plants, setPlants] = useState([])
  const [filteredPlants, setFilteredPlants] = useState([])
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [filters, setFilters] = useState({
    days: 7,
    species: 'all',
    searchTerm: ''
  })
  const [mobileView, setMobileView] = useState('map')

  useEffect(() => {
    loadData()
  }, [filters.days])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [plantsData, statsData] = await Promise.all([
        getTroutPlants({ days: filters.days }),
        getStatistics({ days: filters.days })
      ])

      setPlants(plantsData)
      setFilteredPlants(plantsData)
      setStats(statsData)
    } catch (err) {
      setError('Failed to load data: ' + err.message)
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let filtered = [...plants]

    if (filters.species !== 'all') {
      filtered = filtered.filter(p => p.species === filters.species)
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.lake_name.toLowerCase().includes(term) ||
        p.county.toLowerCase().includes(term)
      )
    }

    setFilteredPlants(filtered)
  }, [plants, filters.species, filters.searchTerm])

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const handlePlantSelect = (plant) => {
    setSelectedPlant(plant)
    trackLakeClick(plant)
  }

  const toggleMobileView = () => {
    setMobileView(prev => prev === 'map' ? 'list' : 'map')
  }

  const isFullscreenActive = isMapFullscreen && mobileView === 'map'

  const toggleMapFullscreen = () => {
    setIsMapFullscreen(prev => !prev)
  }

  useEffect(() => {
    if (!isFullscreenActive) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreenActive])

  return (
    <div className={`home-view ${isFullscreenActive ? 'home-view--map-fullscreen' : ''}`}>
      <button
        className="mobile-view-toggle"
        onClick={toggleMobileView}
        aria-label={mobileView === 'map' ? 'Switch to list view' : 'Switch to map view'}
      >
        {mobileView === 'map' ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span>List</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            <span>Map</span>
          </>
        )}
      </button>

      <div className="app-content">
        <Sidebar
          plants={filteredPlants}
          selectedPlant={selectedPlant}
          onPlantSelect={handlePlantSelect}
          filters={filters}
          onFilterChange={handleFilterChange}
          loading={loading}
          error={error}
          className={mobileView === 'list' ? 'mobile-visible' : 'mobile-hidden'}
        />

        <div className={`main-content ${mobileView === 'map' ? 'mobile-visible' : 'mobile-hidden'} ${isFullscreenActive ? 'main-content--fullscreen' : ''}`}>
          {stats && (
            <>
              {/* Mobile-only update info, desktop uses header banner */}
              <div className="data-update-info mobile-only">
                Data automatically updates daily at 9:00 AM PST
              </div>
              <StatsPanel stats={stats} />
            </>
          )}

          <div className="mobile-legend-species">
            <div className="mobile-legend">
              <h4 className="legend-title">Legend</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <img src="http://maps.google.com/mapfiles/ms/icons/blue-dot.png" alt="Rainbow" />
                  <span>Rainbow Trout</span>
                </div>
                <div className="legend-item">
                  <img src="http://maps.google.com/mapfiles/ms/icons/green-dot.png" alt="Brook" />
                  <span>Brook Trout</span>
                </div>
                <div className="legend-item">
                  <img src="http://maps.google.com/mapfiles/ms/icons/orange-dot.png" alt="Brown" />
                  <span>Brown Trout</span>
                </div>
              </div>
            </div>

            {stats?.species_breakdown && Object.keys(stats.species_breakdown).length > 0 && (
              <div className="mobile-species-distribution">
                <h4 className="legend-title">Species Distribution</h4>
                <div className="species-list">
                  {Object.entries(stats.species_breakdown).map(([species, count]) => (
                    <div key={species} className="species-item">
                      <span className="species-name">{species}</span>
                      <span className="species-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="map-wrapper">
            {mobileView === 'map' && (
              <button
                className={`map-fullscreen-toggle ${isFullscreenActive ? 'active' : ''}`}
                onClick={toggleMapFullscreen}
                aria-label={isFullscreenActive ? 'Exit fullscreen map' : 'Enter fullscreen map'}
              >
                {isFullscreenActive ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l-3-3m0 0h2.25M6.75 6.75v2.25m7.5 7.5l3 3m0 0H15m3.75 0V17.25M9.75 14.25l-3 3m0 0H9m-2.25 0V15m9-9l3-3m0 0H15m3.75 0V6.75" />
                    </svg>
                    <span>Exit Full Map</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v4.5m0 0L9.75 5.25M12 7.5l2.25-2.25M12 21v-4.5m0 0l2.25 2.25M12 16.5L9.75 18.75M21 12h-4.5m0 0L18.75 9.75M16.5 12l2.25 2.25M3 12h4.5m0 0L5.25 9.75M7.5 12l-2.25 2.25" />
                    </svg>
                    <span>Full Map</span>
                  </>
                )}
              </button>
            )}

            <Map
              plants={filteredPlants}
              selectedPlant={selectedPlant}
              onPlantSelect={handlePlantSelect}
              loading={loading}
              stats={stats}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
