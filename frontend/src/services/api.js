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
 * 获取鳟鱼放养数据
 * @param {Object} params - 查询参数
 * @param {string} params.state - 州代码（默认 'WA'）
 * @param {number} params.days - 获取最近 N 天的数据（默认 30）
 * @param {string} params.lake - 湖泊名称（可选）
 * @returns {Promise<Array>} 放养数据数组
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
 * 获取统计信息
 * @returns {Promise<Object>} 统计数据
 */
export const getStatistics = async () => {
  try {
    const response = await api.get('/trout/stats')
    return response.data || {}
  } catch (error) {
    console.error('Error fetching statistics:', error)
    throw error
  }
}

/**
 * 根据湖泊名称查询
 * @param {string} lakeName - 湖泊名称
 * @returns {Promise<Object>} 湖泊数据
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

export default api

