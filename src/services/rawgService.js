// RAWG API Service with rate limiting and retry logic
// Documentation: https://api.rawg.io/docs/

// Configuration
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const API_BASE_URL = 'https://api.rawg.io/api';
const API_KEY = import.meta.env.VITE_RAWG_API_KEY || 'YOUR_RAWG_API_KEY';
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 1000; // 1 second delay between requests

// Rate limiting state
let lastRequestTime = 0;
let requestQueue = [];
let isProcessingQueue = false;

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Check API key
if (!API_KEY || API_KEY === 'YOUR_RAWG_API_KEY') {
  console.warn('RAWG API key is not set. Please add VITE_RAWG_API_KEY to your .env file');
}

// Process the request queue
const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // Enforce rate limiting (1 request per second)
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  
  const { request, resolve, reject, retryCount = 0 } = requestQueue.shift();
  
  try {
    const response = await request();
    lastRequestTime = Date.now();
    resolve(response);
  } catch (error) {
    if (error.status === 429 && retryCount < MAX_RETRIES) {
      // If rate limited, retry with exponential backoff
      const backoff = Math.pow(2, retryCount) * 1000;
      console.warn(`Rate limited. Retrying in ${backoff}ms... (${retryCount + 1}/${MAX_RETRIES})`);
      
      requestQueue.unshift({
        request,
        resolve,
        reject,
        retryCount: retryCount + 1
      });
      
      setTimeout(processQueue, backoff);
      return;
    }
    reject(error);
  } finally {
    isProcessingQueue = false;
    if (requestQueue.length > 0) {
      processQueue();
    }
  }
};

// Add a request to the queue
const enqueueRequest = (request) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ request, resolve, reject });
    processQueue();
  });
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = new Error(`RAWG API error: ${response.status}`);
    error.status = response.status;
    
    try {
      const errorData = await response.json();
      error.message = errorData.detail || error.message;
      error.data = errorData;
    } catch (e) {
      // If we can't parse the error JSON, use the status text
      error.message = response.statusText || error.message;
    }
    
    throw error;
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
  const cacheKey = `search_${query}_${page}_${pageSize}`;
  const now = Date.now();
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    console.log('Returning cached search results for:', query);
    return cached.data;
  }

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

    const fetchData = () => fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    });
    
    const response = await enqueueRequest(fetchData);
    const data = await handleResponse(response);
    const results = data.results || [];
    
    // Cache the results
    cache.set(cacheKey, {
      data: results,
      timestamp: now
    });
    
    return results;
  } catch (error) {
    console.error('Error in searchGames:', error);
    
    // Return cached results if available, even if expired
    if (cached) {
      console.warn('Using expired cache due to API error');
      return cached.data;
    }
    
    throw error;
  }
};

/**
 * Get game details by ID
 * @param {number|string} gameId - The RAWG game ID
 * @returns {Promise<Object>} - Game details
 */
export const getGameDetails = async (gameId) => {
  const cacheKey = `game_${gameId}`;
  const now = Date.now();
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    console.log('Returning cached game details for ID:', gameId);
    return cached.data;
  }

  try {
    const url = import.meta.env.DEV
      ? `${CORS_PROXY}${API_BASE_URL}/games/${gameId}?key=${API_KEY}`
      : `${API_BASE_URL}/games/${gameId}?key=${API_KEY}`;

    const fetchData = () => fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    });
    
    const response = await enqueueRequest(fetchData);
    const data = await handleResponse(response);
    
    // Cache the results
    cache.set(cacheKey, {
      data,
      timestamp: now
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching game details:', error);
    
    // Return cached results if available, even if expired
    if (cached) {
      console.warn('Using expired cache for game details due to API error');
      return cached.data;
    }
    
    throw error;
  }
};

/**
 * Get game achievements with pagination support
 * @param {number|string} gameId - The RAWG game ID
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=40] - Number of results per page (max 40)
 * @returns {Promise<Object>} - Object containing achievements and pagination info
 */
export const getGameAchievements = async (gameId, page = 1, pageSize = 40) => {
  const cacheKey = `achievements_${gameId}_${page}_${pageSize}`;
  const now = Date.now();
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    console.log('Returning cached achievements for game ID:', gameId);
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      key: API_KEY,
      page: page.toString(),
      page_size: Math.min(40, pageSize).toString() // Max 40 per page
    });

    const url = import.meta.env.DEV
      ? `${CORS_PROXY}${API_BASE_URL}/games/${gameId}/achievements?${params}`
      : `${API_BASE_URL}/games/${gameId}/achievements?${params}`;

    const fetchData = () => fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    });
    
    const response = await enqueueRequest(fetchData);
    const data = await handleResponse(response);
    
    // Cache the results
    cache.set(cacheKey, {
      data,
      timestamp: now
    });
    
    return data;
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
