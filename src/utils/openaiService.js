import OpenAI from 'openai';
import { safeNumber, safeDivision, safeArrayFilter, safePercentage } from './helpers';

console.log("VITE_OPENAI_API_KEY:", import.meta.env.VITE_OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: For production, use a backend proxy for security
});

// Validate API key on initialization
if (!import.meta.env.VITE_OPENAI_API_KEY) {
  console.error('OpenAI API key is not set. Please add VITE_OPENAI_API_KEY to your .env file');
}

export const generateMilestones = async (gameTitle) => {
  // Validate API key before making request
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    console.error('OpenAI API key is missing or not configured properly');
    throw new Error('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env file with a valid OpenAI API key.');
  }

  try {
    const prompt = `Generate 50+ comprehensive and highly specific milestones for the video game "${gameTitle}". Research the actual game content and create detailed, game-specific milestones that cover every aspect of gameplay:

STORY MILESTONES (18): Main quest progression, key plot points, boss defeats, character encounters, story revelations, cutscenes
EXPLORATION MILESTONES (15): Specific areas, regions, dungeons, hidden locations, secrets, collectibles, easter eggs with exact names
GAMEPLAY MILESTONES (15): Specific mechanics, abilities, weapons, upgrades, combat techniques, skill unlocks, crafting systems
COMPLETION MILESTONES (8): Side quests, achievements, 100% completion goals, optional content, challenges, mini-games

Requirements for each milestone:
- Use EXACT names from "${gameTitle}" (characters, locations, items, abilities, NPCs)
- Include specific numbers/quantities where relevant (e.g., "Collect 50 Star Bits", "Reach Level 25")
- Progressive difficulty from tutorial to endgame content
- Mix of major story beats and smaller accomplishments
- Avoid generic terms - use actual names from the game
- Include both mandatory and optional content
- Cover early, mid, and late game progression
- Include collectibles, upgrades, and skill progression
- Add specific boss names, area names, and item names
- Include social/multiplayer elements if applicable

Format as JSON array with objects containing:
- title: Specific milestone with exact game terminology (max 65 characters)
- description: Detailed description with specific game context (max 150 characters)
- category: "story", "exploration", "gameplay", or "completion"
- difficulty: "easy", "medium", "hard", or "expert"
- estimatedTime: rough time estimate in minutes

Example format for specific games:
Super Mario Odyssey: {"title": "Defeat Bowser in Cloud Kingdom", "description": "Battle Bowser atop the airship in Nimbus Arena using Cappy mechanics and environmental hazards", "category": "story", "difficulty": "medium", "estimatedTime": 45}
Zelda BOTW: {"title": "Obtain Hylian Shield from Hyrule Castle", "description": "Defeat Stalnox in Hyrule Castle lockup to claim the legendary unbreakable shield", "category": "exploration", "difficulty": "hard", "estimatedTime": 90}

Return only the JSON array with no additional text or formatting.`;

    console.log('Attempting OpenAI API call for milestones...');
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: safeNumber(3000),
      temperature: safeNumber(0.7),
    });

    console.log('OpenAI API response received successfully');
    const content = response.choices[safeNumber(0)].message.content.trim();
    
    // Parse the JSON response
    const milestones = JSON.parse(content);
    
    // Validate and format the milestones
    return milestones.map((milestone, index) => ({
      id: index + safeNumber(1),
      title: typeof milestone.title === 'string' ? milestone.title : `Milestone ${index + safeNumber(1)}`,
      completed: false,
      description: typeof milestone.description === 'string' ? milestone.description : `Brief milestone for ${gameTitle}`,
      category: typeof milestone.category === 'string' ? milestone.category : 'gameplay',
      difficulty: typeof milestone.difficulty === 'string' ? milestone.difficulty : 'medium',
      estimatedTime: typeof milestone.estimatedTime === 'number' ? milestone.estimatedTime : 30,
      dateCompleted: null,
      triggeredByNote: null
    }));
  } catch (error) {
    console.error('OpenAI API Error in generateMilestones:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      type: error.type,
      code: error.code
    });
    
    // Provide specific error messages for common issues
    if (error.status === 401) {
      console.error('Authentication failed: Invalid API key or insufficient permissions');
      throw new Error('OpenAI API authentication failed. Please check your API key in the .env file and ensure it has sufficient credits and permissions.');
    } else if (error.status === 429) {
      console.error('Rate limit exceeded or quota reached');
      throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again, or check your API usage quota.');
    } else if (error.status === 500) {
      console.error('OpenAI server error');
      throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }
    
    // Fallback to basic milestones if API fails
    const fallbackMilestones = [
      'Complete tutorial',
      'Reach first checkpoint',
      'Unlock new features',
      'Complete first quest',
      'Reach story midpoint',
      'Unlock advanced content',
      'Complete storyline',
      'Achieve 100% completion',
      'Defeat first boss',
      'Explore hidden areas',
      'Collect key items',
      'Master mechanics'
    ];
    
    return fallbackMilestones.map((title, index) => ({
      id: index + safeNumber(1),
      title,
      completed: false,
      description: `Brief milestone for ${gameTitle}`
    }));
  }
};

export const generateGameReport = async (gameTitle, milestones, notes, gamesThisWeek) => {
  // Validate API key before making request
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    console.error('OpenAI API key is missing or not configured properly');
    throw new Error('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env file with a valid OpenAI API key.');
  }

  try {
    const notesText = Array.isArray(notes) ? notes.map(note => note.text).join(' ') : '';
    const totalMilestones = Array.isArray(milestones) ? milestones.length : safeNumber(0);
    
    // Enhanced milestone analysis with categories and difficulty
    const categoryBreakdown = Array.isArray(milestones) ? milestones.reduce((acc, m) => {
      const cat = m.category || 'other';
      if (!acc[cat]) acc[cat] = { total: 0, completed: 0 };
      acc[cat].total++;
      if (m.completed) acc[cat].completed++;
      return acc;
    }, {}) : {};
    
    const difficultyBreakdown = Array.isArray(milestones) ? milestones.reduce((acc, m) => {
      const diff = m.difficulty || 'medium';
      if (!acc[diff]) acc[diff] = { total: 0, completed: 0 };
      acc[diff].total++;
      if (m.completed) acc[diff].completed++;
      return acc;
    }, {}) : {};
    
    // Analyze notes to determine completed milestones
    const promptForCompletion = `Based on the following notes for "${gameTitle}", determine which of these milestones might be completed. Consider the milestone categories, difficulty levels, and specific game terminology. Return a JSON array of milestone IDs that appear completed based on the notes.

Milestones with Categories & Difficulty:
${Array.isArray(milestones) ? milestones.map(m => `${m.id}: [${m.category || 'other'}] [${m.difficulty || 'medium'}] ${m.title} - ${m.description}`).join('\n') : ''}

Category Progress: ${Object.entries(categoryBreakdown).map(([cat, data]) => `${cat}: ${data.completed}/${data.total}`).join(', ')}
Difficulty Progress: ${Object.entries(difficultyBreakdown).map(([diff, data]) => `${diff}: ${data.completed}/${data.total}`).join(', ')}

Screenshots: ${gamesThisWeek ? gamesThisWeek.reduce((total, game) => {
  const noteScreenshots = Array.isArray(game.notes) ? game.notes.filter(n => n.screenshot).length : 0;
  const reportScreenshots = Array.isArray(game.reportScreenshots) ? game.reportScreenshots.length : 0;
  return total + noteScreenshots + reportScreenshots;
}, 0) : 0} screenshots from notes and reports attached milestones

Notes:
${notesText || 'No notes provided'}

Return only a JSON array of numbers (milestone IDs), no additional text.`;

    console.log('Attempting OpenAI API call for milestone completion analysis...');
    const completionResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: promptForCompletion }],
      max_tokens: safeNumber(500),
      temperature: safeNumber(0.3),
    });
    console.log('Milestone completion analysis successful');

    const completionContent = completionResponse.choices[safeNumber(0)].message.content.trim();
    const completedIds = JSON.parse(completionContent);
    const updatedMilestones = Array.isArray(milestones) ? milestones.map(m => ({
      ...m,
      completed: Array.isArray(completedIds) && completedIds.includes(m.id) ? true : m.completed
    })) : [];
    
    const completedMilestones = updatedMilestones.filter(m => m.completed);
    const completedCount = completedMilestones.length;
    
    const prompt = `Based on the following completed milestones, personal notes, and detailed game analysis for "${gameTitle}", generate a comprehensive personalized progress report as if I wrote it myself. Use first-person language and make it sound like my own reflections, including deep insights, emotional responses, and strategic thinking.

Completed Milestones by Category:
${Object.entries(categoryBreakdown).map(([cat, data]) => `${cat.toUpperCase()}: ${data.completed}/${data.total} completed\n${completedMilestones.filter(m => (m.category || 'other') === cat).map(m => `  - ${m.title}: ${m.description}`).join('\n')}`).join('\n\n')}

Completed Milestones by Difficulty:
${Object.entries(difficultyBreakdown).map(([diff, data]) => `${diff.toUpperCase()}: ${data.completed}/${data.total} completed`).join('\n')}

My Detailed Notes:
${notesText || 'No notes provided'}

Progress Statistics:
- Total milestones: ${totalMilestones}
- Completed: ${completedCount} (${Math.round((completedCount/totalMilestones)*100)}%)
- Estimated time invested: ${completedMilestones.reduce((sum, m) => sum + (m.estimatedTime || 30), 0)} minutes
- Remaining estimated time: ${updatedMilestones.filter(m => !m.completed).reduce((sum, m) => sum + (m.estimatedTime || 30), 0)} minutes

Format the response as a JSON object with:
- summary: A personal summary of my progress (max 400 characters, first-person, detailed with specific numbers)
- highlights: An array of 6-8 key achievements I've made, phrased personally with category context
- nextSteps: An array of 4-6 suggestions for what I should do next, phrased personally with specific milestone references
- detailedAnalysis: A deeper analysis of my gameplay style, strengths, areas for improvement, and category preferences (max 600 characters)
- achievements: An array of 5-8 specific achievements unlocked or completed, with personal reflections and difficulty context
- challenges: An array of 4-6 challenges I faced and how I overcame them or plan to, with specific examples
- futureGoals: An array of 4-6 long-term goals for completing the game, including specific targets and categories
- categoryInsights: An object with insights for each category (story, exploration, gameplay, completion)
- recommendedFocus: An array of 3-4 specific milestone recommendations based on my progress pattern

Return only the JSON object, no additional text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: safeNumber(1500),
      temperature: safeNumber(0.8),
    });

    const content = response.choices[safeNumber(0)].message.content.trim();
    
    // Parse the JSON response
    const report = JSON.parse(content);
    return {
      summary: typeof report.summary === 'string' ? report.summary : 'No summary available',
      highlights: Array.isArray(report.highlights) ? report.highlights.map(h => typeof h === 'string' ? h : 'Highlight') : [],
      nextSteps: Array.isArray(report.nextSteps) ? report.nextSteps.map(s => typeof s === 'string' ? s : 'Next step') : [],
      detailedAnalysis: typeof report.detailedAnalysis === 'string' ? report.detailedAnalysis : 'No detailed analysis available',
      achievements: Array.isArray(report.achievements) ? report.achievements.map(a => typeof a === 'string' ? a : 'Achievement') : [],
      challenges: Array.isArray(report.challenges) ? report.challenges.map(c => typeof c === 'string' ? c : 'Challenge') : [],
      futureGoals: Array.isArray(report.futureGoals) ? report.futureGoals.map(g => typeof g === 'string' ? g : 'Future goal') : [],
      categoryInsights: typeof report.categoryInsights === 'object' ? report.categoryInsights : {},
      recommendedFocus: Array.isArray(report.recommendedFocus) ? report.recommendedFocus.map(r => typeof r === 'string' ? r : 'Recommendation') : [],
      categoryBreakdown,
      difficultyBreakdown,
      updatedMilestones
    };
  } catch (error) {
    // Fallback report
    const updatedMilestones = Array.isArray(milestones) ? milestones : [];
    const completedCount = updatedMilestones.filter(m => m.completed).length;
    return {
      summary: `I've completed ${completedCount} out of ${Array.isArray(milestones) ? milestones.length : safeNumber(0)} milestones in ${gameTitle}. It's been an amazing journey so far, filled with challenges and triumphs that have shaped my gaming experience.`,
      highlights: [
        'I\'ve made great progress on the main story, uncovering plot twists I never expected',
        'Unlocked some really cool features that changed how I approach the game',
        'Feeling confident about continuing, with a better understanding of the mechanics',
        'Discovered hidden areas that added depth to my playthrough',
        'Built strong relationships with in-game characters through my choices',
        'Mastered difficult combat sequences that tested my skills',
        'Collected rare items that enhanced my overall experience'
      ],
      nextSteps: [
        'Keep pushing through the remaining milestones with renewed focus',
        'Explore more side content to fully immerse myself in the world',
        'Aim for that 100% completion by tackling the hardest challenges',
        'Experiment with different playstyles to discover new strategies',
        'Document my journey more thoroughly for future reference'
      ],
      detailedAnalysis: 'My gameplay style leans towards methodical exploration and strategic combat. I excel at puzzle-solving and resource management, but I sometimes rush into difficult encounters. This has led to some setbacks, but also taught me valuable lessons about patience and preparation.',
      achievements: [
        'Completed the tutorial with a perfect score, setting a high standard',
        'Unlocked the first major ability, which opened up new gameplay possibilities',
        'Defeated a challenging boss using creative tactics',
        'Collected all items in a specific area, showcasing my attention to detail',
        'Achieved a high score in a mini-game, proving my skill improvement',
        'Helped an NPC with their quest, adding emotional depth to the story'
      ],
      challenges: [
        'Struggled with a particular puzzle that required thinking outside the box',
        'Faced difficulty in combat against certain enemy types, leading to multiple retries',
        'Managed time constraints in quests that forced quick decision-making',
        'Dealt with emotional story moments that affected my gameplay choices',
        'Overcame technical issues that interrupted my progress'
      ],
      futureGoals: [
        'Complete the entire main storyline without missing any key moments',
        'Achieve 100% completion by finding every collectible and secret',
        'Master all combat mechanics and abilities for optimal performance',
        'Explore every corner of the game world to fully appreciate its design',
        'Share my experiences and tips with the gaming community'
      ],
      updatedMilestones
    };
  }
};

export const generateWeeklyReport = async (games, weekStart, weekEnd) => {
  // Validate API key before making request
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    console.error('OpenAI API key is missing or not configured properly');
    throw new Error('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env file with a valid OpenAI API key.');
  }

  try {
    const weekGames = Array.isArray(games) ? games.filter(game => {
      if (!game.lastPlayed) return false;
      try {
        const gameDate = new Date(game.lastPlayed);
        if (isNaN(gameDate.getTime())) return false;
        const weekStartDate = new Date(weekStart);
        const weekEndDate = new Date(weekEnd);
        return gameDate >= weekStartDate && gameDate <= weekEndDate;
      } catch {
        return false;
      }
    }) : [];

    // Enhanced weekly analysis with milestone and note insights
    const totalMilestonesThisWeek = weekGames.reduce((sum, game) => {
      return sum + (Array.isArray(game.milestones) ? game.milestones.length : 0);
    }, 0);
    
    const completedMilestonesThisWeek = weekGames.reduce((sum, game) => {
      return sum + (Array.isArray(game.milestones) ? game.milestones.filter(m => m.completed).length : 0);
    }, 0);
    
    const totalNotesThisWeek = weekGames.reduce((sum, game) => {
      return sum + (Array.isArray(game.notes) ? game.notes.length : 0);
    }, 0);
    
    const categoryProgress = weekGames.reduce((acc, game) => {
      if (Array.isArray(game.milestones)) {
        game.milestones.forEach(m => {
          const cat = m.category || 'other';
          if (!acc[cat]) acc[cat] = { total: 0, completed: 0 };
          acc[cat].total++;
          if (m.completed) acc[cat].completed++;
        });
      }
      return acc;
    }, {});
    
    const difficultyProgress = weekGames.reduce((acc, game) => {
      if (Array.isArray(game.milestones)) {
        game.milestones.forEach(m => {
          const diff = m.difficulty || 'medium';
          if (!acc[diff]) acc[diff] = { total: 0, completed: 0 };
          acc[diff].total++;
          if (m.completed) acc[diff].completed++;
        });
      }
      return acc;
    }, {});

    const completedThisWeek = weekGames.filter(game => game.status === 'completed');
    const progressThisWeek = weekGames.filter(game => game.status === 'playing');
    const milestonesCompleted = weekGames.reduce((total, game) => {
      const milestones = Array.isArray(game.milestones) ? game.milestones : [];
      const completed = safeArrayFilter(milestones, m => m.completed);
      return total + completed.length;
    }, 0);

    const averageProgress = progressThisWeek.length > 0 ? 
      safePercentage(
        progressThisWeek.reduce((sum, g) => sum + safeNumber(g.progress, 0), 0),
        progressThisWeek.length * 100,
        0
      ) : 0;

    const gameDetails = weekGames.map(game => {
      const completedMilestones = Array.isArray(game.milestones) ? game.milestones.filter(m => m.completed) : [];
      const recentNotes = Array.isArray(game.notes) ? game.notes.slice(-3) : [];
      return {
        title: game.title,
        status: game.status,
        progress: game.progress || 0,
        platform: game.platform,
        completedMilestones: completedMilestones.map(m => ({ title: m.title, category: m.category, difficulty: m.difficulty })),
        recentNotes: recentNotes.map(n => ({ text: n.text, date: n.date, hoursPlayed: n.hoursPlayed, minutesPlayed: n.minutesPlayed }))
      };
    });

    const prompt = `Generate a comprehensive and detailed weekly gaming report based on my gaming activity. Write in first-person as if I'm reflecting on my week. Focus heavily on specific games played, milestones achieved, and detailed analysis.

WEEKLY GAMING DATA:
- Games played this week: ${weekGames.length}
- Games completed: ${completedThisWeek.length}
- Games in progress: ${progressThisWeek.length}
- Total milestones completed: ${milestonesCompleted}
- Average progress on active games: ${averageProgress.toFixed(1)}%

DETAILED GAME ANALYSIS:
${gameDetails.map(game => `
Game: ${game.title} (${game.platform})
Status: ${game.status} - ${game.progress}% complete
Milestones completed this week: ${game.completedMilestones.length}
${game.completedMilestones.map(m => `  • ${m.title} (${m.category}, ${m.difficulty})`).join('\n')}
Recent notes/activities:
${game.recentNotes.map(n => `  • ${n.text} ${n.hoursPlayed ? `(${n.hoursPlayed}h ${n.minutesPlayed || 0}m played)` : ''}`).join('\n')}
`).join('\n')}

MILESTONE BREAKDOWN BY CATEGORY:
${Object.entries(categoryProgress).map(([cat, data]) => `${cat}: ${data.completed}/${data.total} completed`).join('\n')}

MILESTONE BREAKDOWN BY DIFFICULTY:
${Object.entries(difficultyProgress).map(([diff, data]) => `${diff}: ${data.completed}/${data.total} completed`).join('\n')}

Generate a detailed report with these sections:
1. WEEKLY SUMMARY: Overall reflection on my gaming week
2. GAME HIGHLIGHTS: Detailed discussion of each game I played, including specific milestones achieved and what they mean for my progress
3. MILESTONE ANALYSIS: Deep dive into the types of milestones I completed and what they reveal about my gaming patterns
4. PROGRESS INSIGHTS: Analysis of my progress across different games and genres
5. CHALLENGES & ACHIEVEMENTS: Specific challenges I overcame and notable achievements
6. NEXT WEEK GOALS: Strategic goals for the upcoming week based on current progress

Make it personal, detailed, and insightful. Discuss specific games by name and analyze the significance of milestones achieved.

Format the response as a JSON object with:
- summary: A personal summary of my weekly gaming activity (max 400 characters, first-person, include specific numbers)
- highlights: An array of 5-8 key highlights from the week, phrased personally with specific achievements
- progress: An array of 4-6 detailed progress updates on specific games with milestone context
- insights: An array of 4-6 insights or lessons learned, including category and difficulty analysis
- nextWeekGoals: An array of 4-6 specific goals for the next week with milestone targets
- categoryAnalysis: An object with insights for each category I worked on this week
- difficultyAnalysis: An object with insights about my performance on different difficulty levels
- recommendedFocus: An array of 3-4 specific recommendations for next week based on my progress patterns

Return only the JSON object, no additional text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: safeNumber(1200),
      temperature: safeNumber(0.8),
    });

    const content = response.choices[safeNumber(0)].message.content.trim();
    
    // Parse the JSON response
    const report = JSON.parse(content);
    return {
      summary: typeof report.summary === 'string' ? report.summary : 'Weekly summary not available',
      highlights: Array.isArray(report.highlights) ? report.highlights.map(h => typeof h === 'string' ? h : 'Highlight') : [],
      progress: Array.isArray(report.progress) ? report.progress.map(p => typeof p === 'string' ? p : 'Progress') : [],
      insights: Array.isArray(report.insights) ? report.insights.map(i => typeof i === 'string' ? i : 'Insight') : [],
      nextWeekGoals: Array.isArray(report.nextWeekGoals) ? report.nextWeekGoals.map(g => typeof g === 'string' ? g : 'Goal') : [],
      categoryAnalysis: typeof report.categoryAnalysis === 'object' ? report.categoryAnalysis : {},
      difficultyAnalysis: typeof report.difficultyAnalysis === 'object' ? report.difficultyAnalysis : {},
      recommendedFocus: Array.isArray(report.recommendedFocus) ? report.recommendedFocus.map(r => typeof r === 'string' ? r : 'Recommendation') : [],
      weeklyStats: {
        totalMilestones: totalMilestonesThisWeek,
        completedMilestones: completedMilestonesThisWeek,
        totalNotes: totalNotesThisWeek,
        categoryProgress,
        difficultyProgress
      }
    };
  } catch (error) {
    console.error('OpenAI API Error in generateWeeklyReport:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      type: error.type,
      code: error.code
    });
    
    // Provide specific error messages for common issues
    if (error.status === 401) {
      console.error('Authentication failed: Invalid API key or insufficient permissions');
      throw new Error('OpenAI API authentication failed. Please check your API key in the .env file and ensure it has sufficient credits and permissions.');
    } else if (error.status === 429) {
      console.error('Rate limit exceeded or quota reached');
      throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again, or check your API usage quota.');
    } else if (error.status === 500) {
      console.error('OpenAI server error');
      throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }
    
    // Fallback report
    if (!Array.isArray(games) || games.length === 0) {
      return {
        summary: 'This week, I didn\'t play any games. Time to start a new adventure!',
        highlights: ['No games played this week'],
        progress: ['No progress made'],
        insights: ['Consider starting a new game to track progress'],
        nextWeekGoals: ['Pick a game to play', 'Set some gaming goals']
      };
    } else {
      return {
        summary: `This week, I played ${games.length} games, completed ${games.filter(g => g.status === 'completed').length}, and made solid progress on my gaming goals.`,
        highlights: [
          'Completed a challenging game that tested my skills',
          'Made significant progress on multiple titles',
          'Discovered new strategies that improved my gameplay',
          'Enjoyed some relaxing gaming sessions',
          'Achieved personal bests in several games'
        ],
        progress: [
          'Advanced further in my main game with key milestones',
          'Started a new game and got through the initial setup',
          'Improved my completion rate on side quests',
          'Experimented with different playstyles'
        ],
        insights: [
          'I need to focus more on consistent daily play',
          'Certain games require more time than I expected',
          'My strategy for tackling difficult sections is improving',
          'Balancing multiple games helps keep things fresh'
        ],
        nextWeekGoals: [
          'Complete at least one more game',
          'Reach specific milestones in my current games',
          'Try out new games or genres',
          'Spend more time on detailed exploration',
          'Track my progress more meticulously'
        ]
      };
    }
  }
};