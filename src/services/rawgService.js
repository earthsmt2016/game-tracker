// RAWG API Service
// Documentation: https://api.rawg.io/docs/

const API_BASE_URL = 'https://api.rawg.io/api';
const API_KEY = import.meta.env.VITE_RAWG_API_KEY;

if (!API_KEY) {
  console.warn('RAWG API key is not set. Please add VITE_RAWG_API_KEY to your .env file');
}

/**
 * Search for games by name
 * @param {string} query - The search query
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=10] - Number of results per page
 * @returns {Promise<Array>} - Array of matching games
 */
export const searchGames = async (query, page = 1, pageSize = 10) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/games?key=${API_KEY}&search=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`
    );
    
    if (!response.ok) {
      throw new Error(`RAWG API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error searching games:', error);
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
    const response = await fetch(
      `${API_BASE_URL}/games/${gameId}?key=${API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch game details: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching game details:', error);
    throw error;
  }
};

/**
 * Get game achievements
 * @param {number} gameId - The RAWG game ID
 * @returns {Promise<Array>} - Array of achievements
 */
export const getGameAchievements = async (gameId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/games/${gameId}/achievements?key=${API_KEY}`
    );
    
    if (!response.ok) {
      // Some games might not have achievements
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch achievements: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return [];
  }
};

/**
 * Get game screenshots
 * @param {number} gameId - The RAWG game ID
 * @returns {Promise<Array>} - Array of screenshot URLs
 */
export const getGameScreenshots = async (gameId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/games/${gameId}/screenshots?key=${API_KEY}`
    );
    
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
    const response = await fetch(
      `${API_BASE_URL}/games/${gameId}/suggested?key=${API_KEY}&page_size=${pageSize}`
    );
    
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
