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

const Map = ({ plants, selectedPlant, onPlantSelect, loading }) => {
  const [map, setMap] = useState(null)
  const [activeMarker, setActiveMarker] = useState(null)
  const markersRef = useRef({})

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const onLoad = useCallback((map) => {
    setMap(map)
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

  // Get marker color (based on species)
  const getMarkerIcon = (species) => {
    const colors = {
      'Rainbow Trout': 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      'Eastern Brook Trout': 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
      'Brown Trout': 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png',
    }
    return colors[species] || 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
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
        {plantsWithCoordinates.map((plant) => (
          <Marker
            key={plant.id}
            position={{
              lat: parseFloat(plant.coordinates.lat),
              lng: parseFloat(plant.coordinates.lng)
            }}
            onClick={() => handleMarkerClick(plant)}
            icon={getMarkerIcon(plant.species)}
            animation={selectedPlant?.id === plant.id ? window.google.maps.Animation.BOUNCE : null}
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
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>

      {/* Legend */}
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
  )
}

export default Map

