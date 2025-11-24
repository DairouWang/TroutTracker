import { useState, useEffect } from 'react'
import Map from './components/Map'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import StatsPanel from './components/StatsPanel'
import { getTroutPlants, getStatistics } from './services/api'
import './App.css'

function App() {
  const [plants, setPlants] = useState([])
  const [filteredPlants, setFilteredPlants] = useState([])
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({
    days: 30,
    species: 'all',
    searchTerm: ''
  })

  // Load data
  useEffect(() => {
    loadData()
  }, [filters.days])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [plantsData, statsData] = await Promise.all([
        getTroutPlants({ days: filters.days }),
        getStatistics()
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

  // Apply filters
  useEffect(() => {
    let filtered = [...plants]

    // Filter by species
    if (filters.species !== 'all') {
      filtered = filtered.filter(p => p.species === filters.species)
    }

    // Filter by search term
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
  }

  return (
    <div className="app">
      <Header />
      
      <div className="app-content">
        <Sidebar
          plants={filteredPlants}
          selectedPlant={selectedPlant}
          onPlantSelect={handlePlantSelect}
          filters={filters}
          onFilterChange={handleFilterChange}
          loading={loading}
          error={error}
        />
        
        <div className="main-content">
          {stats && <StatsPanel stats={stats} />}
          
          <Map
            plants={filteredPlants}
            selectedPlant={selectedPlant}
            onPlantSelect={handlePlantSelect}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}

export default App

