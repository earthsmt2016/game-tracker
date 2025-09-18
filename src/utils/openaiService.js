import OpenAI from 'openai';
import { safeNumber, safeDivision, safeArrayFilter, safePercentage } from './helpers';

// Helper function to parse JSON with retry and error handling
const parseJsonWithRetry = async (jsonString, maxRetries = 3) => {
  let lastError = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      lastError = error;
      console.warn(`[DEBUG] JSON parse attempt ${i + 1} failed, trying to fix...`);
      
      jsonString = jsonString
        .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/gm, '$1')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/([\{\[,]\s*)([a-zA-Z0-9_\-]+?)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/\\"/g, '"')
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '')
        .replace(/,(\s*[}\]])/g, '$1');
      
      if (i === maxRetries - 1) {
        console.error('[DEBUG] Failed to parse JSON after all retries. Content:', jsonString);
      }
    }
  }
  
  throw new Error(`Failed to parse JSON after ${maxRetries} attempts: ${lastError.message}`);
};

// Convert minutes to hours and minutes format
const formatTime = (minutes) => {
  if (!minutes) return '0 minutes';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
  if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
};

// Helper function to clean and validate JSON content
const cleanAndParseJson = (jsonString) => {
  if (!jsonString) {
    throw new Error('Empty JSON string provided');
  }

  // First, try to parse directly
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn('Initial parse failed, trying to clean JSON...', e);
  }

  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch (e) {
    console.warn('Failed to parse JSON from markdown code block, trying other methods...');
  }

  // Clean common issues
  let cleaned = jsonString
    // Remove any characters before the first {
    .replace(/^[^{]*/, '')
    // Remove any characters after the last }
    .replace(/[^}]*$/, '}')
    // Fix empty arrays with trailing commas
    .replace(/\[\s*,/g, '[')
    // Fix arrays with missing closing brackets
    .replace(/(\[\s*[^\]\s]+\s*),\s*([^\]]*\])/g, '$1,$2')
    // Fix unescaped quotes in text
    .replace(/([^\\])"(?=\s*:)/g, '$1\\"')
    // Fix unescaped single quotes
    .replace(/([^\\])'(?=\s*:)/g, '$1\\\'')
    // Fix unescaped newlines
    .replace(/([^\\])\n/g, '\\n')
    // Fix unescaped tabs
    .replace(/\t/g, '\\t')
    // Remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, '$1')
    // Fix unescaped backslashes
    .replace(/\\([^"'\\/bfnrtu])/g, '\\\\$1')
    // Fix malformed arrays (like achievementIds)
    .replace(/"achievementIds"\s*:\s*\[\s*\]?/g, '"achievementIds": []')
    // Fix unescaped control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON after cleaning:', e);
    console.error('Problem area:', cleaned.substring(e.offset - 20, e.offset + 20));
    throw new Error(`Failed to parse JSON: ${e.message}`);
  }
};

console.log("VITE_OPENAI_API_KEY:", import.meta.env.VITE_OPENAI_API_KEY);

const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });
};

if (!import.meta.env.VITE_OPENAI_API_KEY) {
  console.error('OpenAI API key is not set. Please add VITE_OPENAI_API_KEY to your .env file');
}

// 🔑 NEW: helper to pad milestones if fewer than 15
// 🔑 Smarter helper to pad milestones if fewer than 15
const padMilestones = (milestones, gameTitle) => {
  const variations = ['Time Trial', 'Collectibles Run', 'No-Hit Challenge', 'S-Rank Attempt'];
  let i = 0;

  while (milestones.length < 15 && milestones.length > 0) {
    const base = milestones[milestones.length % milestones.length];
    const variation = variations[i % variations.length];

    // Calculate correct progression and percentage
    const newOrder = milestones.length + 1;
    const newPercentage = Math.round((newOrder / 15) * 100);

    // Clean description so it doesn't duplicate twists
    let cleanDescription = base.description.replace(/ — with a twist.*$/, '');

    const clone = {
      ...base,
      id: `milestone-${Date.now()}-${milestones.length}`,
      title: `${base.title} (${variation})`,
      description: `${cleanDescription} (variation: ${variation}).`,
      progressionOrder: newOrder,
      gamePercentage: newPercentage
    };

    milestones.push(clone);
    i++;
  }

  return milestones;
};

// Generate milestones with AI
const generateMilestonesWithAI = async (gameTitle, platform = 'PC') => {
  const openai = getOpenAIClient();
  
  const systemPrompt = `You are a professional game guide writer with deep knowledge of video games across all platforms. 
  Your task is to create a comprehensive list of 15-20 engaging and meaningful milestones for the game "${gameTitle}" on ${platform}.
  
  For EACH milestone, include:
  1. A clear, specific title (5-8 words)
  2. A detailed description (1-2 sentences)
  3. Category: story, exploration, combat, collection, completion, or multiplayer
  4. Difficulty: easy, medium, hard, or expert
  5. Estimated time to complete in minutes
  6. A fun fact or tip about the milestone
  
  Make the milestones:
  - Varied across different aspects of the game
  - Progressively more challenging
  - Include both main story and side content
  - Reference specific in-game elements when possible
  - Be specific to ${gameTitle}'s unique mechanics and features
  
  Format as a JSON array of objects with these exact keys:
  [{"title": "", "description": "", "category": "", "difficulty": "", "estimatedTime": number, "tip": ""}, ...]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Generate 15-20 detailed milestones for ${gameTitle} on ${platform}.
          Focus on creating a balanced mix of story progression, exploration, and completionist goals.`
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content in response');

    // Extract JSON from the response
    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) throw new Error('Could not find JSON array in response');

    const milestones = JSON.parse(jsonMatch[0]);
    
    // Add unique IDs and ensure required fields
    return milestones.map((milestone, index) => ({
      id: `milestone-${Date.now()}-${index}`,
      title: milestone.title || `Milestone ${index + 1}`,
      description: milestone.description || '',
      category: milestone.category || 'misc',
      difficulty: milestone.difficulty || 'medium',
      estimatedTime: milestone.estimatedTime || 30,
      tip: milestone.tip || '',
      completed: false,
      isAI: true
    }));
  } catch (error) {
    console.error('Error generating milestones with AI:', error);
    throw error;
  }
};

// Generate milestones for a game
export const generateMilestones = async (gameTitle, platform = 'PC') => {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    console.error('OpenAI API key is missing or not configured properly');
    // Fall through to return default milestones
  } else {
    try {
      const milestones = await generateMilestonesWithAI(gameTitle, platform);
      return milestones;
    } catch (error) {
      console.error('Error in generateMilestones:', error);
      // Fall through to return default milestones
    }
  }

  // Default milestones if AI generation fails or API key is missing
  return [
    {
      id: `milestone-${Date.now()}-1`,
      title: 'Complete the tutorial',
      description: 'Finish the introductory section of the game',
      completed: false,
      category: 'tutorial',
      difficulty: 'easy',
      estimatedTime: 30,
      tip: 'Pay attention to the tutorial as it teaches core mechanics',
      isAI: false,
      gamePercentage: 5,
      progressionOrder: 1
    },
    {
      id: `milestone-${Date.now()}-2`,
      title: 'Reach level 10',
      description: 'Level up your character to level 10',
      completed: false,
      category: 'progression',
      difficulty: 'medium',
      estimatedTime: 60,
      tip: 'Complete side quests for extra XP',
      isAI: false,
      gamePercentage: 20,
      progressionOrder: 2
    },
    {
      id: `milestone-${Date.now()}-3`,
      title: 'Complete the main story',
      description: 'Finish the main storyline of the game',
      completed: false,
      category: 'story',
      difficulty: 'hard',
      estimatedTime: 600,
      tip: 'Make sure to save before the final mission',
      isAI: false,
      gamePercentage: 90,
      progressionOrder: 3
    }
  ];
};

export const generateGameReport = async (gameTitle, milestones, notes, gamesThisWeek) => {
  // Validate API key before making requests
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    console.error('OpenAI API key is missing or not configured properly');
    throw new Error('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env file with a valid OpenAI API key.');
  }

    // Initialize OpenAI client
    const openai = getOpenAIClient();

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
- Estimated time invested: ${formatTime(completedMilestones.reduce((sum, m) => sum + (m.estimatedTime || 30), 0))}
- Remaining estimated time: ${formatTime(updatedMilestones.filter(m => !m.completed).reduce((sum, m) => sum + (m.estimatedTime || 30), 0))}

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
  
  // Initialize OpenAI client
  const openai = getOpenAIClient();

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
- progress: An array of 4-6 detailed progress updates on specific games with milestone context
- insights: An array of 4-6 insights or lessons learned, including category and difficulty analysis
- nextWeekGoals: An array of 4-6 specific goals for the next week with milestone targets
- categoryAnalysis: An object with insights for each category I worked on this week
- difficultyAnalysis: An object with insights about my performance on different difficulty levels
- recommendedFocus: An array of 3-4 specific recommendations for next week based on my progress patterns

Return only the JSON object, no additional text.`;

    // Initialize OpenAI client
    const openai = getOpenAIClient();

    // Add system message to ensure valid JSON response
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates detailed gaming reports. Your response MUST be a valid JSON object with the following structure: { "summary": "...", "highlights": ["..."], "progress": ["..."], "insights": ["..."], "nextWeekGoals": ["..."], "categoryAnalysis": {...}, "difficultyAnalysis": {...}, "recommendedFocus": [...] }'
      },
      {
        role: 'user',
        content: prompt + '\n\nIMPORTANT: Your response MUST be valid JSON. Do not include any markdown formatting, code blocks, or additional text outside the JSON object.'
      }
    ];

    console.log('[DEBUG] Sending request to OpenAI with messages:', JSON.stringify(messages, null, 2));
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        response_format: { type: 'json_object' },
        max_tokens: safeNumber(1200),
        temperature: safeNumber(0.7),
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('Empty response from OpenAI API');
      }
      
      console.log('[DEBUG] Raw OpenAI response:', content);
      
      // Try to extract JSON from markdown code blocks if present
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1].trim();
        console.log('[DEBUG] Extracted JSON from markdown code block');
      }
      
      // Clean and parse the JSON with retry logic
      const report = await parseJsonWithRetry(jsonContent);
      console.log('[DEBUG] Successfully parsed JSON response:', report);
      
      // Validate required fields
      const requiredFields = ['summary', 'highlights', 'progress', 'insights', 'nextWeekGoals'];
      const missingFields = requiredFields.filter(field => !(field in report));
      
      if (missingFields.length > 0) {
        console.warn('[DEBUG] Missing required fields in response:', missingFields);
        // Add default values for missing fields
        missingFields.forEach(field => {
          if (field === 'highlights' || field === 'progress' || field === 'insights' || field === 'nextWeekGoals') {
            report[field] = [];
          } else if (field === 'categoryAnalysis' || field === 'difficultyAnalysis') {
            report[field] = {};
          } else {
            report[field] = '';
          }
        });
      }
      
      // Add weekly stats to the report
      return {
        ...report,
        weeklyStats: {
          totalMilestones: totalMilestonesThisWeek,
          completedMilestones: completedMilestonesThisWeek,
          totalNotes: totalNotesThisWeek,
          categoryProgress,
          difficultyProgress
        }
      };
      
    } catch (error) {
      console.error('[DEBUG] Error in OpenAI API call:', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw error;
    }
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
    
    // Fallback report with all required fields
    const fallbackReport = {
      summary: Array.isArray(games) && games.length > 0
        ? `This week, I played ${games.length} games, completed ${games.filter(g => g.status === 'completed').length}, and made solid progress on my gaming goals.`
        : 'This week, I didn\'t play any games. Time to start a new adventure!',
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
      ],
      categoryAnalysis: {
        story: 'Made good progress on main story content',
        exploration: 'Discovered several hidden areas and secrets',
        gameplay: 'Improved combat and gameplay mechanics',
        completion: 'Working towards 100% completion on favorite titles'
      },
      difficultyAnalysis: {
        easy: 'Quickly completed easier challenges',
        medium: 'Solid progress on standard difficulty content',
        hard: 'Overcame several tough challenges',
        expert: 'Making steady progress on expert-level content'
      },
      recommendedFocus: [
        'Focus on completing main story objectives',
        'Try a new game genre to diversify experience',
        'Set specific milestone targets for next week',
        'Allocate time for both progress and exploration'
      ],
      weeklyStats: {
        totalMilestones: 0,
        completedMilestones: 0,
        totalNotes: 0,
        categoryProgress: {},
        difficultyProgress: {}
      }
    };
    
    // If we have games data, update the stats
    if (Array.isArray(games) && games.length > 0) {
      fallbackReport.weeklyStats = {
        totalMilestones: games.reduce((sum, game) => 
          sum + (Array.isArray(game.milestones) ? game.milestones.length : 0), 0),
        completedMilestones: games.reduce((sum, game) => 
          sum + (Array.isArray(game.milestones) ? game.milestones.filter(m => m.completed).length : 0), 0),
        totalNotes: games.reduce((sum, game) => 
          sum + (Array.isArray(game.notes) ? game.notes.length : 0), 0),
        categoryProgress: {},
        difficultyProgress: {}
      };
    }
    
    return fallbackReport;
  }
};