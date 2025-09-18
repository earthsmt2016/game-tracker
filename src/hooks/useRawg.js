import { useState, useEffect, useCallback } from 'react';
import {
  searchGames as searchGamesService,
  getGameDetails as getGameDetailsService,
  getGameAchievements as getGameAchievementsService,
  getGameScreenshots as getGameScreenshotsService,
  getSimilarGames as getSimilarGamesService
} from '../services/rawgService';

export const useRawg = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const transformGameData = (gameData, achievements = []) => {
    // Sort achievements by completion percentage (rarest first)
    const sortedAchievements = [...achievements].sort((a, b) => 
      (a.percent || 0) - (b.percent || 0)
    );

    return {
      id: `rawg-${gameData.id}`,
      title: gameData.name,
      platform: gameData.platforms?.map(p => p.platform.name).join(', ') || 'Unknown',
      coverImage: gameData.background_image || '',
      status: 'not_started',
      progress: 0,
      hoursPlayed: 0,
      rating: 0,
      notes: [],
      milestones: sortedAchievements.map(achievement => ({
        id: `ach-${achievement.id}`,
        title: achievement.name,
        description: achievement.description || 'No description available',
        completed: false,
        category: 'achievement',
        difficulty: (achievement.percent < 10) ? 'expert' :
                   (achievement.percent < 25) ? 'hard' : 
                   (achievement.percent < 60) ? 'medium' : 'easy',
        completionPercentage: achievement.percent || 0,
        estimatedTime: calculateEstimatedTime(achievement.percent || 0)
      })),
      addedDate: new Date().toISOString(),
      lastPlayed: null,
      rawgId: gameData.id,
      rawgData: gameData // Store the raw data for future reference
    };
  };

  // Helper function to estimate time based on achievement rarity
  const calculateEstimatedTime = (percent) => {
    if (percent < 5) return 120; // 2+ hours for very rare achievements
    if (percent < 15) return 60;  // 1 hour for rare achievements
    if (percent < 40) return 30;  // 30 minutes for uncommon
    if (percent < 70) return 15;  // 15 minutes for common
    return 5;                     // 5 minutes for very common
  };

  const searchGames = useCallback(async (query, page = 1, pageSize = 10) => {
    if (!query) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      return await searchGamesService(query, page, pageSize);
    } catch (err) {
      console.error('Error in searchGames:', err);
      setError(err.message || 'Failed to search games');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getGameDetails = useCallback(async (gameId) => {
    if (!gameId) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      return await getGameDetailsService(gameId);
    } catch (err) {
      console.error('Error in getGameDetails:', err);
      setError(err.message || 'Failed to fetch game details');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getGameAchievements = useCallback(async (gameId) => {
    if (!gameId) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      let allAchievements = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 40; // Maximum allowed by RAWG API
      
      // Fetch all pages of achievements
      while (hasMore) {
        const response = await getGameAchievementsService(gameId, page, pageSize);
        if (response && response.results && response.results.length > 0) {
          allAchievements = [...allAchievements, ...response.results];
          // Check if there are more pages
          hasMore = response.next !== null;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allAchievements;
    } catch (err) {
      console.error('Error in getGameAchievements:', err);
      setError(err.message || 'Failed to fetch game achievements');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getGameScreenshots = useCallback(async (gameId) => {
    if (!gameId) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      return await getGameScreenshotsService(gameId);
    } catch (err) {
      console.error('Error in getGameScreenshots:', err);
      setError(err.message || 'Failed to fetch game screenshots');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getSimilarGames = useCallback(async (gameId, pageSize = 5) => {
    if (!gameId) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      return await getSimilarGamesService(gameId, pageSize);
    } catch (err) {
      console.error('Error in getSimilarGames:', err);
      setError(err.message || 'Failed to fetch similar games');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const trackGame = useCallback(async (gameId) => {
    if (!gameId) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get game details
      const details = await getGameDetailsService(gameId);
      
      // Get game achievements if available
      let achievements = [];
      try {
        const achievementsData = await getGameAchievementsService(gameId);
        if (Array.isArray(achievementsData)) {
          achievements = achievementsData;
        }
      } catch (err) {
        console.warn('Could not fetch achievements:', err);
      }
      
      // Transform the data into our game format
      return transformGameData(details, achievements);
    } catch (err) {
      console.error('Error tracking game:', err);
      setError(err.message || 'Failed to track game');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getGameDetailsService, getGameAchievementsService]);

  return {
    loading,
    error,
    searchGames,
    getGameDetails,
    getGameAchievements,
    getGameScreenshots,
    getSimilarGames,
    trackGame,
  };
};

export default useRawg;
