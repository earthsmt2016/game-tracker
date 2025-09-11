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
      
      // Try to fix common JSON issues
      jsonString = jsonString
        // Remove markdown code blocks
        .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/gm, '$1')
        // Remove trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        // Add quotes around unquoted keys
        .replace(/([\{\[,]\s*)([a-zA-Z0-9_\-]+?)\s*:/g, '$1"$2":')
        // Replace single quotes with double quotes
        .replace(/'/g, '"')
        // Fix escaped quotes
        .replace(/\\"/g, '"')
        // Remove comments
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '')
        // Remove trailing commas in arrays and objects
        .replace(/,(\s*[}\]])/g, '$1');
      
      // If we're on the last try, log the problematic content
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
  try {
    // Remove any control characters except newlines and tabs
    let cleaned = jsonString.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Fix common JSON issues
    cleaned = cleaned
      .replace(/([\{\,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3') // Add quotes around unquoted property names
      .replace(/:\s*'([^']*)'/g, ': "$1"') // Convert single quotes to double quotes for strings
      .replace(/([^\\])\\n/g, '$1\\\\n') // Escape newlines in strings
      .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
      .replace(/([^\\])\\u/g, '$1\\\\u') // Fix unicode escape sequences
      .replace(/\\"/g, '\\"') // Ensure proper escaping of quotes
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/\t/g, '\\t'); // Escape tabs
    
    // Try to parse the cleaned JSON
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to clean and parse JSON:', error);
    console.error('Original content:', jsonString);
    throw new Error('Failed to parse JSON response after cleaning');
  }
};

console.log("VITE_OPENAI_API_KEY:", import.meta.env.VITE_OPENAI_API_KEY);

// Create a function to get a new OpenAI instance for each request
const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Note: For production, use a backend proxy for security
  });
};

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
    // Special handling for team-based games like Sonic Heroes
    const teamBasedPrompt = gameTitle.toLowerCase().includes('sonic heroes') 
      ? `For Sonic Heroes, ensure you create milestones for all four teams in this order of progression:
1. Team Rose (easiest)
2. Team Sonic (standard difficulty)
3. Team Dark (harder)
4. Team Chaotix (hardest))

Distribute milestones evenly across all teams, showing their parallel stories. Include team-specific challenges and ensure the difficulty increases with each team.`
      : '';

    const prompt = `You are a gaming expert with deep knowledge of "${gameTitle}". Generate EXACTLY 15 key milestones that cover the main story progression and major gameplay moments. Each milestone must be meaningful, concise, and clearly indicate the team it belongs to in the title (e.g., "[Team Rose] Complete Tutorial").

${teamBasedPrompt}

IMPORTANT:
- Return EXACTLY 15 milestone objects in a JSON array
- Each milestone MUST include the 'team' field with the team name
- Include team name in the title (e.g., "[Team Rose] Complete Tutorial")
- Keep titles under 10 words and descriptions under 2 sentences
- Focus on major story beats and key progression points
- Ensure milestones are properly ordered by progression (1-15)
- Do not include markdown or additional text outside the JSON
- Each milestone must include all required fields

Required fields for each milestone:
- title: string
- description: string
- action: string
- category: string (story/exploration/gameplay/completion)
- difficulty: string (easy/medium/hard/expert)
- estimatedTime: number
- progressionOrder: number
- team: string
- storyPath: string
- gamePercentage: number (1-100)
- prerequisites: string
- reward: string

RULES:
1. You MUST return EXACTLY 15 milestones - no more, no less
2. Each milestone must have ALL required fields
3. progressionOrder must be unique and sequential from 1 to 15
4. gamePercentage should be roughly evenly distributed from 1-100%
5. estimatedTime should be realistic (15-60 minutes)
6. ALWAYS include the team name in the title (e.g., "[Team Rose] Complete First Mission")
7. Keep descriptions under 2 sentences and actions under 3 sentences
8. Use consistent team names throughout (Team Rose, Team Sonic, etc.)
9. Ensure prerequisites reference actual milestone titles or game requirements
10. Focus on major story beats and key progression points
11. Each team should have a balanced number of milestones
12. Include a mix of different categories (story, exploration, gameplay, completion)

Generate 15 milestones in the exact format shown above. The response must be valid JSON and nothing else. Do not include any markdown formatting or additional text.

[The response must be valid JSON that can be parsed with JSON.parse().`;

    console.log(`Generating milestones for: ${gameTitle}`);
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates detailed game milestones in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000, // Increased to handle larger responses
      temperature: 0.7,
      response_format: { type: 'json_object' } // Force JSON response format
    });

    console.log('OpenAI API response received successfully');
    const completion = response;
    
    // Parse the response and ensure it's an array
    let milestones = [];
    try {
      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('Empty response from OpenAI API');
      }
      
      // Log the raw response for debugging (first 500 chars to avoid huge logs)
      console.log('Raw OpenAI API response (truncated):', responseContent.substring(0, 500) + (responseContent.length > 500 ? '...' : ''));
      
      // Clean and parse the response
      let parsed;
      try {
        console.log('Attempting to parse JSON content...');
        
        // If the response is a string, try to parse it as JSON
        if (typeof responseContent === 'string') {
          // Try to parse as is first
          try {
            parsed = JSON.parse(responseContent);
            console.log('Successfully parsed direct JSON response');
          } catch (e) {
            // If that fails, try to extract JSON from markdown code blocks
            const codeBlockMatch = responseContent.match(/```(?:json)?\n([\s\S]*?)\n```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
              console.log('Extracted JSON from code block');
              parsed = JSON.parse(codeBlockMatch[1]);
            } else {
              // If no code block, try to clean and parse the content
              const cleaned = responseContent
                .replace(/^[\s\S]*?\[\s*{/, '{') // Remove everything before the first {
                .replace(/}\s*\][\s\S]*$/, '}')  // Remove everything after the last }
                .replace(/([^\\])\'/g, '$1\\\'')  // Escape single quotes
                .replace(/\n/g, '\\n')           // Escape newlines
                .replace(/\r/g, '\\r')           // Escape carriage returns
                .replace(/\t/g, '\\t');           // Escape tabs
              
              // Try to parse as an array
              try {
                parsed = JSON.parse(`[${cleaned}]`);
                console.log('Successfully parsed as JSON array');
              } catch (e) {
                // If that fails, try to parse as an object with a milestones array
                try {
                  parsed = { milestones: JSON.parse(`[${cleaned}]`) };
                  console.log('Successfully parsed as milestones object');
                } catch (e2) {
                  console.error('Failed to parse JSON content:', e2);
                  throw new Error('Could not parse the response as valid JSON');
                }
              }
            }
          }
        } else {
          // If it's not a string, use it as is
          parsed = responseContent;
        }
      } catch (e) {
        console.error('Failed to parse JSON content:', e);
        console.error('Problematic content:', jsonContent);
        throw new Error('Failed to parse the milestone data. The response format was not valid JSON.');
      }
      console.log('Successfully parsed JSON response');
      
      // Handle different response formats
      if (Array.isArray(parsed)) {
        milestones = parsed;
      } else if (parsed.milestones && Array.isArray(parsed.milestones)) {
        milestones = parsed.milestones;
      } else if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        // Handle case where response is a single milestone object
        milestones = [parsed];
      } else {
        console.error('Unexpected response format from OpenAI API:', parsed);
        throw new Error('Invalid response format: Expected an array of milestones or an object with a milestones array');
      }
      
      // Log milestone count and first sample for verification
      console.log(`Successfully extracted ${milestones.length} milestones`);
      if (milestones.length > 0) {
        console.log('First milestone sample:', JSON.stringify(milestones[0], null, 2));
      }
      
      // Log milestone count but don't fail if we get fewer than 15
      if (milestones.length < 15) {
        console.warn(`Received ${milestones.length} milestones. While we prefer 15+, we'll proceed with what we have.`);
      } else {
        console.log(`Successfully generated ${milestones.length} milestones.`);
      }
    } catch (error) {
      console.error('Failed to parse milestones:', error);
      throw new Error('Failed to parse milestones. Please check the OpenAI API response.');
    }
    
    // Validate each milestone has required fields
    const validatedMilestones = milestones.map((milestone, index) => {
      const requiredFields = ['title', 'description', 'action', 'team', 'gamePercentage', 'storyPath'];
      const missingFields = requiredFields.filter(field => !(field in milestone));
      
      if (missingFields.length > 0) {
        console.error(`Milestone #${index + 1} is missing required fields:`, missingFields);
        console.error('Milestone data:', milestone);
        throw new Error(`Invalid milestone format: Missing required fields: ${missingFields.join(', ')}`);
      }

      // Ensure gamePercentage is a number between 1-100
      const percentage = parseInt(milestone.gamePercentage, 10);
      if (isNaN(percentage) || percentage < 1 || percentage > 100) {
        console.error(`Invalid gamePercentage for milestone: ${milestone.title}`, milestone.gamePercentage);
        throw new Error(`Invalid gamePercentage: ${milestone.gamePercentage}. Must be a number between 1-100`);
      }

      return {
        ...milestone,
        gamePercentage: percentage // Ensure it's a number
      };
    });

    // Sort milestones by progression order
    const sortedMilestones = [...validatedMilestones].sort((a, b) => {
      const orderA = typeof a.progressionOrder === 'number' ? a.progressionOrder : 999;
      const orderB = typeof b.progressionOrder === 'number' ? b.progressionOrder : 999;
      return orderA - orderB;
    });
    
    return sortedMilestones.map((milestone, index) => ({
      id: index + safeNumber(1),
      title: milestone.title || `Milestone ${index + safeNumber(1)}`,
      description: milestone.description || `Complete this objective in ${gameTitle}`,
      action: milestone.action || `Complete this milestone in ${gameTitle}`,
      category: ['story', 'exploration', 'gameplay', 'completion'].includes(milestone.category) ? milestone.category : 'gameplay',
      difficulty: ['easy', 'medium', 'hard', 'expert'].includes(milestone.difficulty) ? milestone.difficulty : 'medium',
      estimatedTime: Number.isInteger(milestone.estimatedTime) ? milestone.estimatedTime : 30,
      progressionOrder: Number.isInteger(milestone.progressionOrder) ? milestone.progressionOrder : index + 1,
      team: milestone.team || 'All Teams',
      storyPath: milestone.storyPath || 'Main Story',
      gamePercentage: Number.isInteger(milestone.gamePercentage) ? Math.min(100, Math.max(1, milestone.gamePercentage)) : 0,
      completed: false,
      dateCompleted: null,
      triggeredByNote: null,
      prerequisites: milestone.prerequisites || '',
      reward: milestone.reward || ''
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