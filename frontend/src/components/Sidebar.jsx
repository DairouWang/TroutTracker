import React from 'react'
import { format } from 'date-fns'
import './Sidebar.css'

const Sidebar = ({ 
  plants, 
  selectedPlant, 
  onPlantSelect, 
  filters, 
  onFilterChange, 
  loading, 
  error,
  className = ''
}) => {
  // Get all unique species
  const uniqueSpecies = [...new Set(plants.map(p => p.species))].filter(Boolean)

  const handleSearchChange = (e) => {
    onFilterChange({ searchTerm: e.target.value })
  }

  const handleSpeciesChange = (e) => {
    onFilterChange({ species: e.target.value })
  }

  const handleDaysChange = (e) => {
    onFilterChange({ days: parseInt(e.target.value) })
  }

  const formatDate = (dateStr) => {
    try {
      // WDFW date format: "Nov 20, 2025"
      const date = new Date(dateStr)
      return format(date, 'yyyy-MM-dd')
    } catch {
      return dateStr
    }
  }

  return (
    <div className={`sidebar ${className}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">Stocking Records</h2>
        <span className="plant-count">{plants.length} records</span>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="search" className="filter-label">
            Search Lakes
          </label>
          <input
            id="search"
            type="text"
            placeholder="Enter lake name or county..."
            value={filters.searchTerm}
            onChange={handleSearchChange}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="species" className="filter-label">
            Species
          </label>
          <select
            id="species"
            value={filters.species}
            onChange={handleSpeciesChange}
            className="filter-select"
          >
            <option value="all">All</option>
            {uniqueSpecies.map(species => (
              <option key={species} value={species}>
                {species}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="days" className="filter-label">
            Time Range
          </label>
          <select
            id="days"
            value={filters.days}
            onChange={handleDaysChange}
            className="filter-select"
          >
            <option value="1">Last 1 day</option>
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="error-state">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Plants list */}
      {!loading && !error && (
        <div className="plants-list">
          {plants.length === 0 ? (
            <div className="empty-state">
              <p>No stocking records found</p>
            </div>
          ) : (
            plants.map((plant) => (
              <div
                key={plant.id}
                className={`plant-card ${selectedPlant?.id === plant.id ? 'selected' : ''}`}
                onClick={() => onPlantSelect(plant)}
              >
                <div className="plant-card-header">
                  <h3 className="plant-lake-name">{plant.lake_name}</h3>
                  <span className="plant-date">{formatDate(plant.stock_date)}</span>
                </div>
                
                <div className="plant-details">
                  <div className="plant-detail-row">
                    <span className="detail-label">Species:</span>
                    <span className="detail-value">{plant.species}</span>
                  </div>
                  
                  <div className="plant-detail-row">
                    <span className="detail-label">Quantity:</span>
                    <span className="detail-value">{plant.number?.toLocaleString()} fish</span>
                  </div>
                  
                  <div className="plant-detail-row">
                    <span className="detail-label">Size:</span>
                    <span className="detail-value">{plant.fish_per_pound} per lb</span>
                  </div>
                  
                  {plant.county && (
                    <div className="plant-detail-row">
                      <span className="detail-label">County:</span>
                      <span className="detail-value">{plant.county}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default Sidebar
