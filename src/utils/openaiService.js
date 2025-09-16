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
    // Fix unescaped quotes in text
    .replace(/([^\\])"(?=\s*:)/g, '$1\\"')
    // Fix unescaped single quotes
    .replace(/([^\\])'(?=\s*:)/g, '$1\\\'')
    // Fix unescaped newlines
    .replace(/([^\\])\n/g, '\\n')
    // Fix unescaped tabs
    .replace(/\t/g, '\\t')
    // Remove trailing commas
    .replace(/,\s*([}\]])/g, '$1')
    // Fix unescaped backslashes
    .replace(/\\([^"'\\/bfnrtu])/g, '\\\\$1')
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

export const generateMilestones = async (gameTitle, platform = 'PC') => {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    console.error('OpenAI API key is missing or not configured properly');
    throw new Error('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
  }

  try {
    const platformDetails = { /* unchanged, left out for brevity */ };
    const platformInfo = platformDetails[platform] || platformDetails['PC'];
    
    let gameSpecificPrompt = '';
    if (gameTitle.toLowerCase().includes('sonic heroes')) {
      gameSpecificPrompt = `For Sonic Heroes, ensure you create milestones for all four teams in this order: Team Rose, Team Sonic, Team Dark, Team Chaotix.`;
    } else if (gameTitle.toLowerCase().includes('spider-man 2')) {
      gameSpecificPrompt = `For Marvel's Spider-Man 2 (${platform}), include character-specific, story, and villain milestones.`;
    }

    // Advanced milestone generation system
    const prompt = `You are a professional game designer creating milestones for "${gameTitle}" (${platform}). 

IMPORTANT: Only include milestones that are specific to this exact game. Do not include any content from sequels, prequels, or other games in the series unless explicitly part of this game. Focus only on the main content of "${gameTitle}".

GENERATION RULES:
1. Create EXACTLY 15 unique and distinct milestones with clear progression, focusing ONLY on content from "${gameTitle}"
2. Each milestone must represent a significant, unique event or achievement
3. Include a balanced mix of:
   - Main story progression points
   - Major side quests or optional content
   - Key item/ability unlocks
   - Boss battles or major encounters
   - Exploration milestones
4. Ensure milestones are specific to "${gameTitle}"'s mechanics, setting, and narrative. Do not reference events, characters, or locations from sequels, DLCs, or other games in the series.
5. Distribute milestones to represent natural progression through the game

MILESTONE STRUCTURE:
{
  "title": "[Specific, unique objective that clearly indicates progress]",
  "description": "2-3 sentences explaining the challenge, narrative significance, and what makes this milestone unique",
  "action": "Complete|Defeat|Collect|Achieve|Master|Discover|Unlock|Rescue|Escape|Upgrade",
  "category": {
    "primary": "story|exploration|combat|puzzle|boss|collection|upgrade|achievement",
    "secondary": "[optional secondary category]"
  },
  "difficulty": {
    "rating": 1-5,
    "factors": ["skill", "time", "knowledge"]
  },
  "estimatedTime": 15-120,
  "prerequisites": ["milestone_id_or_name"],
  "rewards": ["item_name", "ability_unlock", "story_progression"],
  "steps": [
    {
      "description": "Specific, measurable objective",
      "metrics": {
        "type": "count|time|combo|precision",
        "target": "number or condition"
      }
    }
  ],
  "metrics": {
    "primary": {
      "type": "time|score|combo|collection",
      "target": "specific target value"
    },
    "secondary": [
      {
        "type": "damage_taken|items_used|accuracy",
        "target": "optimal value"
      }
    ]
  },
  "validation": {
    "autoTracked": true|false,
    "manualChecks": ["screenshot_required", "save_file_hash"],
    "achievementIds": ["related_achievement_ids"]
  },
  "tags": ["tutorial", "boss", "story", "side_quest", "exploration", "upgrade", "collection", "achievement", "challenge"]
}

PROGRESSION FLOW:
1-3: Introduction & Tutorial (0-20%)
   - Basic controls and mechanics
   - First major story beat
   - First significant challenge or boss

4-7: Early Game (20-45%)
   - Core gameplay loop established
   - First major story developments
   - Introduction to key mechanics
   - First major side content

8-10: Mid Game (45-70%)
   - Story midpoint
   - Major ability/upgrade unlocks
   - More challenging encounters
   - Significant side content

11-14: Late Game (70-95%)
   - Climactic story events
   - Most challenging content
   - Final upgrades/abilities
   - Endgame preparation

15: Finale & Completion (95-100%)
   - Final story mission/ending
   - Post-game content
   - 100% completion (if applicable)

${gameSpecificPrompt}

Return ONLY a valid JSON array with 15 milestone objects, no markdown or additional text.

VERIFICATION: Before finalizing, double-check that all milestones are specific to "${gameTitle}" and do not reference any sequel or DLC content.`;

    console.log(`Generating milestones for: ${gameTitle}`);
    const openai = getOpenAIClient();
    
    // Enhanced system message to ensure proper JSON format
    const systemMessage = `You are a helpful assistant that generates detailed game milestones in JSON format. 
    Your response MUST be a valid JSON object with a 'milestones' array containing exactly 15 milestone objects.
    Each milestone must have a title, description, and progressionOrder field.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    console.log('OpenAI API response received successfully');
    let responseContent = response.choices[0]?.message?.content;
    if (!responseContent) throw new Error('Empty response from OpenAI API');

    console.log('Raw response content (first 500 chars):', responseContent.substring(0, 500) + '...');

    // First try to parse directly
    let parsed;
    try {
      // If the response is already a string that starts with {, try parsing it directly
      if (typeof responseContent === 'string') {
        const trimmed = responseContent.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            parsed = JSON.parse(trimmed);
            console.log('Successfully parsed JSON directly');
          } catch (parseError) {
            console.warn('Direct JSON parse failed, trying to clean...', parseError);
            // Try to clean and parse
            parsed = cleanAndParseJson(responseContent);
          }
        } else {
          // Otherwise, try to clean and parse
          parsed = cleanAndParseJson(responseContent);
        }
      } else {
        // If not a string, use as is
        parsed = responseContent;
      }
    } catch (err) {
      console.warn('Initial JSON parse failed, trying to extract JSON...', err);
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        console.log('Extracted JSON string for parsing (first 200 chars):', jsonStr.substring(0, 200) + '...');
        try {
          parsed = JSON.parse(jsonStr);
          console.log('Successfully parsed extracted JSON');
        } catch (finalErr) {
          console.error('Final JSON parse failed:', finalErr.message);
          // Log more context around the error
          const position = parseInt(finalErr.message.match(/position (\d+)/)?.[1] || '0');
          const start = Math.max(0, position - 50);
          const end = Math.min(jsonStr.length, position + 50);
          console.error('Problem area:', jsonStr.substring(start, end));
          console.error('Full response length:', responseContent.length);
          throw new Error('Failed to parse milestones from API response after multiple attempts');
        }
      } else {
        throw new Error('No valid JSON found in the API response');
      }
    }

    let milestones = [];
    try {
      if (Array.isArray(parsed)) {
        milestones = parsed.slice(0, 15);
      } else if (parsed?.milestones && Array.isArray(parsed.milestones)) {
        milestones = parsed.milestones.slice(0, 15);
      } else if (typeof parsed === 'object' && parsed !== null) {
        // If it's a single milestone object
        milestones = [parsed];
      }
    } catch (e) {
      console.error('Error extracting milestones:', e);
      throw new Error('Invalid milestone format received from API');
    }

    console.log(`Successfully extracted ${milestones.length} milestones:`, JSON.stringify(milestones, null, 2));

    // 🔑 FIX #2: pad if fewer than 15
    if (milestones.length < 15) {
      console.warn(`Only got ${milestones.length}, padding to 15...`);
      milestones = padMilestones(milestones, gameTitle);
    }

    // 🔑 FIX #3: relax validation → always regenerate IDs
    const validatedMilestones = milestones.map((milestone, index) => {
      const defaultMilestone = {
        id: `milestone-${Date.now()}-${index}`,
        title: `Milestone ${index + 1}`,
        description: `Complete this milestone in ${gameTitle}`,
        action: `Complete this objective in ${gameTitle}`,
        team: 'General',
        gamePercentage: Math.min(100, Math.max(1, Math.round(((index + 1) / 15) * 100))),
        storyPath: 'Main Story',
        prerequisites: '',
        reward: '',
        category: 'gameplay',
        difficulty: 'medium',
        estimatedTime: 30,
        progressionOrder: index + 1,
        completed: false,
        dateCompleted: null,
        triggeredByNote: null
      };

      return {
        ...defaultMilestone,
        ...milestone,
        id: `milestone-${Date.now()}-${index}`,
        title: milestone.title || defaultMilestone.title,
        description: milestone.description || defaultMilestone.description,
        gamePercentage: Number.isInteger(milestone.gamePercentage)
          ? Math.min(100, Math.max(1, milestone.gamePercentage))
          : defaultMilestone.gamePercentage,
        progressionOrder: Number.isInteger(milestone.progressionOrder)
          ? milestone.progressionOrder
          : index + 1
      };
    });

    // Sort by progressionOrder first, then by gamePercentage if progressionOrder is equal
    return validatedMilestones.sort((a, b) => {
      const orderDiff = (a.progressionOrder || 0) - (b.progressionOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return (a.gamePercentage || 0) - (b.gamePercentage || 0);
    });
  } catch (error) {
    console.error('OpenAI API Error in generateMilestones:', error);
    throw error;
  }
};

// generateGameReport and generateWeeklyReport unchanged
// (keep your existing versions as they are)

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