import axios from 'axios'

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_ENDPOINT,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Get trout stocking data
 * @param {Object} params - Query parameters
 * @param {string} params.state - State code (default 'WA')
 * @param {number} params.days - Get data from last N days (default 30)
 * @param {string} params.lake - Lake name (optional)
 * @returns {Promise<Array>} Array of stocking data
 */
export const getTroutPlants = async (params = {}) => {
  try {
    const response = await api.get('/trout', { params })
    return response.data.data || []
  } catch (error) {
    console.error('Error fetching trout plants:', error)
    throw error
  }
}

/**
 * Get statistics
 * @param {Object} params - Query parameters
 * @param {number} params.days - Get stats from last N days (default 30)
 * @returns {Promise<Object>} Statistics data
 */
export const getStatistics = async (params = {}) => {
  try {
    const response = await api.get('/trout/stats', { params })
    return response.data || {}
  } catch (error) {
    console.error('Error fetching statistics:', error)
    throw error
  }
}

/**
 * Query by lake name
 * @param {string} lakeName - Lake name
 * @returns {Promise<Object>} Lake data
 */
export const getLakeByName = async (lakeName) => {
  try {
    const response = await api.get('/trout', {
      params: { lake: lakeName }
    })
    return response.data.data?.[0] || null
  } catch (error) {
    console.error('Error fetching lake data:', error)
    throw error
  }
}

/**
 * Send user feedback to the backend
 * @param {Object} payload - Feedback data
 * @param {string} payload.name - Sender name
 * @param {string} payload.email - Sender email
 * @param {string} payload.message - Feedback content
 * @returns {Promise<Object>} API response payload
 */
export const sendFeedback = async (payload) => {
  try {
    const response = await api.post('/feedback', payload)
    return response.data
  } catch (error) {
    console.error('Error sending feedback:', error)
    throw error
  }
}

export default api
