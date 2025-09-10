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
    const prompt = `You are a gaming expert with deep knowledge of "${gameTitle}". Generate 25-30 ultra-specific milestones that cover the ENTIRE progression of the game, from start to finish. Research the actual game content thoroughly to ensure accuracy and depth.

ABSOLUTE REQUIREMENTS - ZERO GENERIC CONTENT:
- Generate EXACTLY 25-30 milestones that cover the full game progression
- Every milestone MUST use EXACT names, locations, characters, items from "${gameTitle}"
- NO generic terms like "Complete tutorial", "Defeat first boss", "Unlock features"
- Include SPECIFIC numbers, collectible names, character names, level names
- Order by EXACT game progression (how the game actually flows)
- Each milestone should be instantly recognizable to someone who has played this game
- Ensure milestones are evenly distributed throughout the entire game
- Include key story moments, major bosses, and significant gameplay milestones
- For open-world games, include milestones for different regions/areas in the order they're typically explored

GAME-SPECIFIC RESEARCH REQUIREMENTS:
For Sonic Heroes: Seaside Hill, Ocean Palace, Grand Metropolis, Power Plant, Casino Park, BINGO Highway, Rail Canyon, Bullet Station, Frog Forest, Lost Jungle, Hang Castle, Mystic Mansion, Egg Fleet, Final Fortress, Team Blast abilities, Formation changes, Chaos Emeralds, Team Dark/Rose/Chaotix stories, Metal Overlord, Neo Metal Sonic

For other games, research and include:
- Exact level/stage names in order
- Specific boss names and locations  
- Unique items, weapons, abilities by their real names
- Character progression systems
- Collectible systems with exact names and quantities
- Story beats with specific character/location names
- Side content that's significant to game completion

MILESTONE DISTRIBUTION (25-30 total):
1. Early Game (6-8 milestones): Tutorial areas, first major objectives, initial story setup
2. Mid Game (10-12 milestones): Major story beats, key upgrades, important bosses
3. Late Game (6-8 milestones): Climactic story moments, challenging bosses, final upgrades
4. Completion (3-5 milestones): Post-game content, 100% completion, secret endings

Format requirements:
- title: Exact game terminology, character/location names (max 65 chars)
- description: Specific context only players would know (max 150 chars)
- action: Precise instructions using game-specific terms (max 200 chars)
- category: "story", "exploration", "gameplay", or "completion"
- difficulty: "easy", "medium", "hard", or "expert"
- estimatedTime: realistic time in minutes from game start
- progressionOrder: chronological sequence (1-30)

EXAMPLES OF GOOD SPECIFICITY:
Sonic Heroes: {"title": "Defeat Egg Hawk in Ocean Palace", "description": "First boss battle against Dr. Eggman's flying mech using Team Sonic's Thunder Shoot formation attack", "action": "Use Team Blast when Egg Hawk hovers low, then switch to Power formation and jump attack the cockpit 3 times", "category": "story", "difficulty": "easy", "estimatedTime": 45, "progressionOrder": 4}

Mario Odyssey: {"title": "Capture T-Rex in Cascade Kingdom", "description": "Use Cappy to possess the sleeping T-Rex near the Odyssey landing site to break blocks", "action": "Throw Cappy at the sleeping T-Rex's head, press Y to capture, use roar button to break stone blocks", "category": "gameplay", "difficulty": "easy", "estimatedTime": 15, "progressionOrder": 3}

Return ONLY the JSON array with 25-30 game-specific milestones, properly formatted and in exact chronological order.`;

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
    
    // Validate and format the milestones, sorting by progression order
    const sortedMilestones = milestones.sort((a, b) => {
      const orderA = typeof a.progressionOrder === 'number' ? a.progressionOrder : 999;
      const orderB = typeof b.progressionOrder === 'number' ? b.progressionOrder : 999;
      return orderA - orderB;
    });
    
    return sortedMilestones.map((milestone, index) => ({
      id: index + safeNumber(1),
      title: typeof milestone.title === 'string' ? milestone.title : `Milestone ${index + safeNumber(1)}`,
      completed: false,
      description: typeof milestone.description === 'string' ? milestone.description : `Brief milestone for ${gameTitle}`,
      action: typeof milestone.action === 'string' ? milestone.action : `Complete this milestone in ${gameTitle}`,
      category: typeof milestone.category === 'string' ? milestone.category : 'gameplay',
      difficulty: typeof milestone.difficulty === 'string' ? milestone.difficulty : 'medium',
      estimatedTime: typeof milestone.estimatedTime === 'number' ? milestone.estimatedTime : 30,
      progressionOrder: typeof milestone.progressionOrder === 'number' ? milestone.progressionOrder : index + 1,
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
      description: `Brief milestone for ${gameTitle}`,
      action: `Work towards completing: ${title}`,
      category: 'gameplay',
      difficulty: 'medium',
      estimatedTime: 30,
      progressionOrder: index + 1,
      dateCompleted: null,
      triggeredByNote: null
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
    
    // REMOVED: Automatic milestone completion analysis to prevent unwanted auto-clearing
    // The AI will no longer automatically mark milestones as completed based on notes
    // Users must manually confirm milestone completion through the suggestion system

    // Use existing milestones without auto-completion
    const updatedMilestones = Array.isArray(milestones) ? milestones : [];
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
      difficultyBreakdown
      // Note: updatedMilestones removed to prevent auto-clearing of milestones
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
      if (!Array.isArray(game.notes) || game.notes.length === 0) return false;
      
      // Check if any notes were created during this week
      return game.notes.some(note => {
        try {
          const noteDate = new Date(note.date);
          if (isNaN(noteDate.getTime())) return false;
          const weekStartDate = new Date(weekStart);
          const weekEndDate = new Date(weekEnd);
          return noteDate >= weekStartDate && noteDate <= weekEndDate;
        } catch {
          return false;
        }
      });
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