import OpenAI from 'openai';
import { safeNumber, safeDivision, safePercentage, safeArrayFilter } from './helpers';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: For production, use a backend proxy for security
});

export const generateMilestones = async (gameTitle) => {
  try {
    const prompt = `Generate 12 brief and tailored milestones for the video game "${gameTitle}". 
    Each milestone should be a concise checkpoint that players typically encounter in this specific game.
    Format the response as a JSON array of objects, where each object has:
    - title: A short milestone title (max 40 characters)
    - description: A brief description of what the milestone involves (max 80 characters)
    
    Make them logical progression from early game to completion. Ensure they are specific to "${gameTitle}" and not generic.
    Return only the JSON array, no additional text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: safeNumber(1000),
      temperature: safeNumber(0.7),
    });

    const content = response.choices[safeNumber(0)].message.content.trim();
    
    // Parse the JSON response
    const milestones = JSON.parse(content);
    
    // Validate and format the milestones
    return milestones.map((milestone, index) => ({
      id: index + safeNumber(1),
      title: typeof milestone.title === 'string' ? milestone.title : `Milestone ${index + safeNumber(1)}`,
      completed: false,
      description: typeof milestone.description === 'string' ? milestone.description : `Brief milestone for ${gameTitle}`
    }));
  } catch (error) {
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
  try {
    const notesText = Array.isArray(notes) ? notes.map(note => note.text).join(' ') : '';
    const totalMilestones = Array.isArray(milestones) ? milestones.length : safeNumber(0);
    
    // Analyze notes to determine completed milestones
    const promptForCompletion = `Based on the following notes for "${gameTitle}", determine which of these milestones might be completed. Return a JSON array of milestone IDs that appear completed based on the notes.

Milestones:
${Array.isArray(milestones) ? milestones.map(m => `${m.id}: ${m.title} - ${m.description}`).join('\n') : ''}

Screenshots: ${gamesThisWeek.reduce((total, game) => {
  const noteScreenshots = Array.isArray(game.notes) ? safeArrayFilter(game.notes, n => n.screenshot).length : 0;
  const reportScreenshots = Array.isArray(game.reportScreenshots) ? game.reportScreenshots.length : 0;
  return total + noteScreenshots + reportScreenshots;
}, 0)} screenshots from notes and reports attached milestones

Notes:
${notesText || 'No notes provided'}

Return only a JSON array of numbers (milestone IDs), no additional text.`;

    const completionResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: promptForCompletion }],
      max_tokens: safeNumber(500),
      temperature: safeNumber(0.3),
    });

    const completionContent = completionResponse.choices[safeNumber(0)].message.content.trim();
    const completedIds = JSON.parse(completionContent);
    const updatedMilestones = Array.isArray(milestones) ? milestones.map(m => ({
      ...m,
      completed: Array.isArray(completedIds) && completedIds.includes(m.id) ? true : m.completed
    })) : [];
    
    const completedMilestones = updatedMilestones.filter(m => m.completed);
    const completedCount = completedMilestones.length;
    
    const prompt = `Based on the following completed milestones and personal notes for the game "${gameTitle}", generate a super detailed personalized progress report as if I wrote it myself. Use first-person language and make it sound like my own reflections on what I've achieved so far, including deep insights, emotional responses, and strategic thinking.

Completed Milestones:
${completedMilestones.map(m => `- ${m.title}: ${m.description}`).join('\n')}

My Notes:
${notesText || 'No notes provided'}

Total milestones: ${totalMilestones}, Completed: ${completedCount}

Format the response as a JSON object with:
- summary: A personal summary of my progress (max 300 characters, first-person, detailed)
- highlights: An array of 5-7 key achievements I've made, phrased personally and with context
- nextSteps: An array of 3-5 suggestions for what I should do next, phrased personally and detailed
- detailedAnalysis: A deeper analysis of my gameplay style, strengths, and areas for improvement (max 500 characters)
- achievements: An array of 4-6 specific achievements unlocked or completed, with personal reflections
- challenges: An array of 3-5 challenges I faced and how I overcame them or plan to
- futureGoals: An array of 3-5 long-term goals for completing the game, including specific targets

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

export const generateWeeklyReport = async (games, selectedWeek) => {
  try {
    const weekGames = Array.isArray(games) ? games.filter(game => {
      if (!game.lastPlayed) return false;
      try {
        const gameDate = new Date(game.lastPlayed);
        if (isNaN(gameDate.getTime())) return false;
        const weekStart = new Date(selectedWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + safeNumber(6));
        return gameDate >= weekStart && gameDate <= weekEnd;
      } catch {
        return false;
      }
    }) : [];

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

    const prompt = `Generate a personalized weekly gaming report based on the following data for the week starting ${selectedWeek}. Use first-person language as if I wrote it myself, reflecting on my gaming achievements, progress, and insights.

Games played this week: ${weekGames.length}
Games completed this week: ${completedThisWeek.length}
Games in progress: ${progressThisWeek.length}
Total milestones completed: ${milestonesCompleted}
Average progress on in-progress games: ${averageProgress}%

Game details:
${weekGames.map(game => {
  const progress = safeNumber(game.progress, 0);
  const milestones = Array.isArray(game.milestones) ? game.milestones : [];
  const completed = safeArrayFilter(milestones, m => m.completed).length;
  const total = milestones.length;
  return `- ${game.title} (${game.platform}): ${game.status}, Progress: ${progress}%, Milestones: ${completed}/${total}`;
}).join('\n')}

Format the response as a JSON object with:
- summary: A personal summary of my weekly gaming activity (max 300 characters, first-person)
- highlights: An array of 4-6 key highlights from the week, phrased personally
- progress: An array of 3-5 progress updates on specific games
- insights: An array of 3-5 insights or lessons learned
- nextWeekGoals: An array of 3-5 goals for the next week

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
      nextWeekGoals: Array.isArray(report.nextWeekGoals) ? report.nextWeekGoals.map(g => typeof g === 'string' ? g : 'Goal') : []
    };
  } catch (error) {
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