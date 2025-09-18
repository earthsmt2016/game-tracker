// RAWG API Service
// Documentation: https://api.rawg.io/docs/

// Use CORS proxy in development
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const API_BASE_URL = 'https://api.rawg.io/api';
const API_KEY = import.meta.env.VITE_RAWG_API_KEY || 'YOUR_RAWG_API_KEY';

if (!API_KEY || API_KEY === 'YOUR_RAWG_API_KEY') {
  console.warn('RAWG API key is not set. Please add VITE_RAWG_API_KEY to your .env file');
}

console.log('RAWG API Key:', import.meta.env.VITE_RAWG_API_KEY);
console.log('RAWG API Key:', API_KEY);
console.log('Environment:', import.meta.env);
console.log('API Key from env:', import.meta.env.VITE_RAWG_API_KEY);

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `RAWG API error: ${response.status}`);
  }
  return response.json();
};

/**
 * Search for games by name
 * @param {string} query - The search query
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=10] - Number of results per page
 * @returns {Promise<Array>} - Array of matching games
 */
export const searchGames = async (query, page = 1, pageSize = 10) => {
  try {
    const params = new URLSearchParams({
      key: API_KEY,
      search: query,
      page: page.toString(),
      page_size: pageSize.toString()
    });

    const url = import.meta.env.DEV
      ? `${CORS_PROXY}${API_BASE_URL}/games?${params}`
      : `${API_BASE_URL}/games?${params}`;

    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    const data = await handleResponse(response);
    return data.results || [];
  } catch (error) {
    console.error('Error in searchGames:', error);
    throw error;
  }
};

/**
 * Get game details by ID
 * @param {number} gameId - The RAWG game ID
 * @returns {Promise<Object>} - Game details
 */
export const getGameDetails = async (gameId) => {
  try {
    const url = import.meta.env.DEV
      ? `${CORS_PROXY}${API_BASE_URL}/games/${gameId}?key=${API_KEY}`
      : `${API_BASE_URL}/games/${gameId}?key=${API_KEY}`;

    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching game details:', error);
    throw error;
  }
};

/**
 * Get game achievements with pagination support
 * @param {number} gameId - The RAWG game ID
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=40] - Number of results per page (max 40)
 * @returns {Promise<Object>} - Object containing achievements and pagination info
 */
export const getGameAchievements = async (gameId, page = 1, pageSize = 40) => {
  try {
    const params = new URLSearchParams({
      key: API_KEY,
      page: page.toString(),
      page_size: Math.min(40, pageSize).toString() // Max 40 per page
    });

    const url = import.meta.env.DEV
      ? `${CORS_PROXY}${API_BASE_URL}/games/${gameId}/achievements?${params}`
      : `${API_BASE_URL}/games/${gameId}/achievements?${params}`;

    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      // Some games might not have achievements
      if (response.status === 404) {
        return { results: [], next: null, previous: null, count: 0 };
      }
      throw new Error(`Failed to fetch achievements: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching game achievements:', error);
    // Return empty results if achievements can't be fetched
    return { results: [], next: null, previous: null, count: 0 };
  }
};

/**
 * Get game screenshots
 * @param {number} gameId - The RAWG game ID
 * @returns {Promise<Array>} - Array of screenshot URLs
 */
export const getGameScreenshots = async (gameId) => {
  try {
    const url = import.meta.env.DEV
      ? `${CORS_PROXY}${API_BASE_URL}/games/${gameId}/screenshots?key=${API_KEY}`
      : `${API_BASE_URL}/games/${gameId}/screenshots?key=${API_KEY}`;

    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.results?.map(screenshot => screenshot.image) || [];
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    return [];
  }
};

/**
 * Get similar games
 * @param {number} gameId - The RAWG game ID
 * @param {number} [pageSize=5] - Number of similar games to return
 * @returns {Promise<Array>} - Array of similar games
 */
export const getSimilarGames = async (gameId, pageSize = 5) => {
  try {
    const params = new URLSearchParams({
      key: API_KEY,
      page_size: pageSize.toString()
    });

    const url = import.meta.env.DEV
      ? `${CORS_PROXY}${API_BASE_URL}/games/${gameId}/suggested?${params}`
      : `${API_BASE_URL}/games/${gameId}/suggested?${params}`;

    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching similar games:', error);
    return [];
  }
};

export default {
  searchGames,
  getGameDetails,
  getGameAchievements,
  getGameScreenshots,
  getSimilarGames
};
