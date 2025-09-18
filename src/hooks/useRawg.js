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
      milestones: achievements.map(achievement => ({
        id: `ach-${achievement.id}`,
        title: achievement.name,
        description: achievement.description,
        completed: false,
        category: 'achievement',
        difficulty: achievement.percent < 25 ? 'hard' : 
                   achievement.percent < 60 ? 'medium' : 'easy',
        estimatedTime: 0 // We'll need to estimate this based on the achievement
      })),
      addedDate: new Date().toISOString(),
      lastPlayed: null,
      rawgId: gameData.id,
      rawgData: gameData // Store the raw data for future reference
    };
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
      return await getGameAchievementsService(gameId);
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
