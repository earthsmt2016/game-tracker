import { useState, useEffect, useCallback } from 'react';
import {
  searchGames as searchGamesService,
  getGameDetails as getGameDetailsService,
  getGameAchievements as getGameAchievementsService,
  getGameScreenshots as getGameScreenshotsService,
  getSimilarGames as getSimilarGamesService
} from '../services/rawgService';
import { generateMilestones } from '../utils/openaiService';

const useRawg = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const transformGameData = async (gameData, achievements = []) => {
    // Function to generate default milestones
    const getDefaultMilestones = () => [
      {
        id: `milestone-${Date.now()}-1`,
        title: 'Complete the tutorial',
        description: 'Finish the introductory section of the game',
        completed: false,
        category: 'tutorial',
        difficulty: 'easy',
        completionPercentage: 0,
        estimatedTime: 30,
        isAI: false
      },
      {
        id: `milestone-${Date.now()}-2`,
        title: 'Reach level 10',
        description: 'Level up your character to level 10',
        completed: false,
        category: 'progression',
        difficulty: 'medium',
        completionPercentage: 0,
        estimatedTime: 60,
        isAI: false
      },
      {
        id: `milestone-${Date.now()}-3`,
        title: 'Complete the main story',
        description: 'Finish the main storyline of the game',
        completed: false,
        category: 'story',
        difficulty: 'hard',
        completionPercentage: 0,
        estimatedTime: 600,
        isAI: false
      }
    ];

    // Sort achievements by completion percentage (rarest first) if available
    const hasAchievements = achievements && achievements.length > 0;
    let milestones = [];

    try {
      if (hasAchievements) {
        // If we have achievements, use them as milestones
        const sortedAchievements = [...achievements].sort((a, b) => (a.percent || 0) - (b.percent || 0));
        milestones = sortedAchievements.map(achievement => ({
          id: `ach-${achievement.id}`,
          title: achievement.name,
          description: achievement.description || 'No description available',
          completed: false,
          category: 'achievement',
          difficulty: (achievement.percent < 10) ? 'expert' :
                    (achievement.percent < 25) ? 'hard' : 
                    (achievement.percent < 60) ? 'medium' : 'easy',
          completionPercentage: achievement.percent || 0,
          estimatedTime: calculateEstimatedTime(achievement.percent || 0),
          isAchievement: true,
          isAI: false
        }));
      } else {
        // If no achievements, try to generate AI milestones
        const platform = gameData.platforms?.[0]?.platform?.name || 'PC';
        const aiMilestones = await generateMilestones(gameData.name, platform);
        milestones = (aiMilestones && aiMilestones.length > 0) 
          ? aiMilestones 
          : getDefaultMilestones();
      }
      
      // Sort milestones by estimated time (shortest first)
      milestones.sort((a, b) => (a.estimatedTime || 0) - (b.estimatedTime || 0));
      
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
        milestones: milestones,
        addedDate: new Date().toISOString(),
        lastPlayed: null,
        rawgId: gameData.id,
        rawgData: {
          ...gameData,
          hasAchievements: hasAchievements
        }
      };
    } catch (error) {
      console.error('Error in transformGameData:', error);
      // Return a basic game object with default milestones if anything fails
      return {
        id: `rawg-${gameData.id || Date.now()}`,
        title: gameData.name || 'Unknown Game',
        platform: gameData.platforms?.map(p => p.platform.name).join(', ') || 'Unknown',
        coverImage: gameData.background_image || '',
        status: 'not_started',
        progress: 0,
        hoursPlayed: 0,
        rating: 0,
        notes: [],
        milestones: getDefaultMilestones(),
        addedDate: new Date().toISOString(),
        lastPlayed: null,
        rawgId: gameData.id,
        rawgData: {
          ...gameData,
          hasAchievements: false
        }
      };
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
      const gameDetails = await getGameDetailsService(gameId);
      
      // Then, get achievements and screenshots in parallel
      const [achievements, screenshots] = await Promise.all([
        getGameAchievementsService(gameId).catch(() => []), // Return empty array if achievements fail
        getGameScreenshotsService(gameId).catch(() => [])  // Return empty array if screenshots fail
      ]);

      // Transform the game data with the fetched information (this now includes AI milestone generation)
      const gameData = await transformGameData(gameDetails, achievements);
      
      // If we have screenshots, use the best one as the cover image
      if (screenshots && screenshots.length > 0) {
        // Find the best screenshot (prioritize larger images that aren't thumbnails)
        const bestScreenshot = screenshots.reduce((best, current) => {
          // Skip thumbnails
          if (current.width < 600 || current.height < 300) return best;
          
          // If we don't have a best yet or this one is larger, use this one
          if (!best || (current.width * current.height) > (best.width * best.height)) {
            return current;
          }
          return best;
        }, null);

        // If we found a good screenshot, use it as the cover
        if (bestScreenshot && bestScreenshot.image) {
          gameData.coverImage = bestScreenshot.image;
          
          // Also store the screenshots in rawgData for potential future use
          gameData.rawgData = gameData.rawgData || {};
          gameData.rawgData.screenshots = screenshots;
        } else if (screenshots[0]?.image) {
          // Fallback to the first available screenshot if no good one was found
          gameData.coverImage = screenshots[0].image;
        }
      }

      return gameData;
    } catch (err) {
      console.error('Error tracking game:', err);
      setError('Failed to track game. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getGameDetailsService, getGameAchievementsService, getGameScreenshotsService]);

  return {
    loading,
    error,
    searchGames,
    getGameDetails,
    getGameAchievements,
    getGameScreenshots,
    getSimilarGames,
    trackGame
  };
};

export { useRawg };
