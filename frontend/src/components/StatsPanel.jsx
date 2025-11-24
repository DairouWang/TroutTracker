import React from 'react'
import './StatsPanel.css'

const StatsPanel = ({ stats }) => {
  if (!stats) return null

  return (
    <div className="stats-panel">
      <div className="stat-card">
        <div className="stat-icon">📊</div>
        <div className="stat-content">
          <div className="stat-value">{stats.total_records?.toLocaleString()}</div>
          <div className="stat-label">Total Records</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">🏞️</div>
        <div className="stat-content">
          <div className="stat-value">{stats.unique_lakes?.toLocaleString()}</div>
          <div className="stat-label">Unique Lakes</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">🐟</div>
        <div className="stat-content">
          <div className="stat-value">{stats.total_fish_stocked?.toLocaleString()}</div>
          <div className="stat-label">Total Fish Stocked</div>
        </div>
      </div>

      {stats.species_breakdown && Object.keys(stats.species_breakdown).length > 0 && (
        <div className="stat-card species-card">
          <div className="stat-icon">🎣</div>
          <div className="stat-content">
            <div className="stat-label">Species Distribution</div>
            <div className="species-list">
              {Object.entries(stats.species_breakdown).map(([species, count]) => (
                <div key={species} className="species-item">
                  <span className="species-name">{species}</span>
                  <span className="species-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StatsPanel

