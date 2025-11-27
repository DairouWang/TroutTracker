import React, { useState, useCallback, useRef } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import './Map.css'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Washington State center coordinates
const DEFAULT_CENTER = {
  lat: 47.7511,
  lng: -120.7401
}

const DEFAULT_ZOOM = 7

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
}

const Map = ({ plants, selectedPlant, onPlantSelect, loading, stats }) => {
  const [map, setMap] = useState(null)
  const [activeMarker, setActiveMarker] = useState(null)
  const markersRef = useRef({})

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const onLoad = useCallback((mapInstance) => {
    mapInstance.setCenter(DEFAULT_CENTER)
    mapInstance.setZoom(DEFAULT_ZOOM)
    setMap(mapInstance)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  // When selected plant changes, move map to that location
  React.useEffect(() => {
    if (selectedPlant && selectedPlant.coordinates && map) {
      const { lat, lng } = selectedPlant.coordinates
      map.panTo({ lat: parseFloat(lat), lng: parseFloat(lng) })
      map.setZoom(12)
      setActiveMarker(selectedPlant.id)
    }
  }, [selectedPlant, map])

  const handleMarkerClick = (plant) => {
    setActiveMarker(plant.id)
    onPlantSelect(plant)
  }

  const handleInfoWindowClose = () => {
    setActiveMarker(null)
  }

  const getMarkerAnimation = (plantId) => {
    if (selectedPlant?.id !== plantId) {
      return null
    }
    return window.google?.maps?.Animation?.BOUNCE || null
  }

  // Get marker color (based on species)
  const getMarkerIcon = (species) => {
    if (!species) {
      return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
    }
    
    // Normalize species name for matching (case-insensitive, trim whitespace)
    const normalizedSpecies = species.toLowerCase().trim()
    
    // Use more flexible matching to handle variations in species names
    if (normalizedSpecies.includes('rainbow')) {
      return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
    } else if (normalizedSpecies.includes('brook')) {
      return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
    } else if (normalizedSpecies.includes('brown')) {
      return 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png'
    }
    
    // Default color for unknown species
    return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
  }

  if (loadError) {
    return (
      <div className="map-error">
        <p>⚠️ Failed to load map</p>
        <p className="error-detail">{loadError.message}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="map-loading">
        <div className="spinner"></div>
        <p>Loading map...</p>
      </div>
    )
  }

  // Filter plants with coordinates
  const plantsWithCoordinates = plants.filter(p => p.coordinates && p.coordinates.lat && p.coordinates.lng)

  return (
    <div className="map-container">
      {loading && (
        <div className="map-overlay">
          <div className="spinner"></div>
          <p>Loading data...</p>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {plantsWithCoordinates.map((plant) => {
          const lat = parseFloat(plant.coordinates.lat)
          const lng = parseFloat(plant.coordinates.lng)

          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return null
          }

          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`

          return (
            <Marker
              key={plant.id}
              position={{ lat, lng }}
              onClick={() => handleMarkerClick(plant)}
              icon={getMarkerIcon(plant.species)}
              animation={getMarkerAnimation(plant.id)}
            >
              {activeMarker === plant.id && (
                <InfoWindow onCloseClick={handleInfoWindowClose}>
                  <div className="info-window">
                    <h3 className="info-window-title">{plant.lake_name}</h3>
                    
                    <div className="info-window-content">
                      <div className="info-row">
                        <span className="info-label">Stocking Date:</span>
                        <span className="info-value">{plant.stock_date}</span>
                      </div>
                      
                      <div className="info-row">
                        <span className="info-label">Species:</span>
                        <span className="info-value">{plant.species}</span>
                      </div>
                      
                      <div className="info-row">
                        <span className="info-label">Quantity:</span>
                        <span className="info-value">{plant.number?.toLocaleString()} fish</span>
                      </div>
                      
                      <div className="info-row">
                        <span className="info-label">Size:</span>
                        <span className="info-value">{plant.fish_per_pound} per lb</span>
                      </div>
                      
                      {plant.county && (
                        <div className="info-row">
                          <span className="info-label">County:</span>
                          <span className="info-value">{plant.county}</span>
                        </div>
                      )}
                      
                      {plant.region && (
                        <div className="info-row">
                          <span className="info-label">Region:</span>
                          <span className="info-value">Region {plant.region}</span>
                        </div>
                      )}
                      
                      {plant.hatchery && (
                        <div className="info-row">
                          <span className="info-label">Hatchery:</span>
                          <span className="info-value">{plant.hatchery}</span>
                        </div>
                      )}
                    </div>

                    {mapsUrl && (
                      <div className="info-actions">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="info-link"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          )
        })}
      </GoogleMap>

      {/* Legend - Desktop only */}
      <div className="map-legend-container">
        <div className="map-legend">
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
      </div>
    </div>
  )
}

export default Map
