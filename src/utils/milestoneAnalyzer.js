// Enhanced milestone analysis and note correlation system
import { safeNumber } from './helpers';

export const analyzeMilestoneFromNote = (note, milestones) => {
  if (!note || !note.text || !Array.isArray(milestones)) return [];
  
  const noteText = note.text.toLowerCase();
  const noteWords = noteText.split(/\s+/);
  
  // Enhanced keyword matching with scoring - include all milestones, not just uncompleted ones
  const potentialMilestones = milestones
    .filter(milestone => milestone) // Just filter out any null/undefined milestones
    .map(milestone => {
      let score = 0;
      const titleWords = milestone.title.toLowerCase().split(/\s+/);
      const descWords = milestone.description.toLowerCase().split(/\s+/);
      const actionWords = milestone.action ? milestone.action.toLowerCase().split(/\s+/) : [];
      
      // Direct word matches in title (highest weight)
      titleWords.forEach(word => {
        if (word.length > 2 && noteWords.some(nw => nw.includes(word) || word.includes(nw))) {
          score += 4;
        }
      });
      
      // Direct word matches in description
      descWords.forEach(word => {
        if (word.length > 2 && noteWords.some(nw => nw.includes(word) || word.includes(nw))) {
          score += 2;
        }
      });
      
      // Direct word matches in action instructions
      actionWords.forEach(word => {
        if (word.length > 2 && noteWords.some(nw => nw.includes(word) || word.includes(nw))) {
          score += 1;
        }
      });
      
      // Enhanced context-based scoring with more keywords
      if (noteText.includes('completed') || noteText.includes('finished') || noteText.includes('beat') || noteText.includes('cleared') || noteText.includes('done')) {
        score += 3;
      }
      
      if (noteText.includes('unlocked') || noteText.includes('obtained') || noteText.includes('found') || noteText.includes('got') || noteText.includes('acquired')) {
        score += 2;
      }
      
      if (noteText.includes('started') || noteText.includes('began') || noteText.includes('beginning')) {
        if (milestone.difficulty === 'easy') {
          score += 2;
        }
      }
      
      // Boss/enemy mentions
      if (noteText.includes('boss') || noteText.includes('defeated') || noteText.includes('killed')) {
        if (milestone.title.toLowerCase().includes('boss') || milestone.title.toLowerCase().includes('defeat')) {
          score += 3;
        }
      }
      
      // Location mentions
      if (noteText.includes('reached') || noteText.includes('arrived') || noteText.includes('entered')) {
        if (milestone.category === 'exploration') {
          score += 2;
        }
      }
      
      // Item/collectible mentions
      if (noteText.includes('collected') || noteText.includes('picked up') || noteText.includes('got')) {
        if (milestone.title.toLowerCase().includes('collect') || milestone.category === 'completion') {
          score += 2;
        }
      }
      
      return { ...milestone, matchScore: score };
    })
    .filter(milestone => milestone.matchScore > 1) // Lower threshold for more matches
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 15); // Return top 15 matches for better suggestions
  
  return potentialMilestones;
};

export const getTriggeredMilestones = (notes, milestones) => {
  if (!Array.isArray(notes) || !Array.isArray(milestones)) return [];
  
  const triggeredMilestones = [];
  
  notes.forEach(note => {
    const matches = analyzeMilestoneFromNote(note, milestones);
    matches.forEach(match => {
      if (!triggeredMilestones.find(tm => tm.id === match.id)) {
        triggeredMilestones.push({
          ...match,
          triggeredByNote: note,
          confidence: Math.min(match.matchScore * 20, 100) // Convert to percentage
        });
      }
    });
  });
  
  return triggeredMilestones.sort((a, b) => b.confidence - a.confidence);
};

export const categorizeNotesByMilestones = (notes = [], milestones = []) => {
  if (!Array.isArray(notes) || !Array.isArray(milestones)) {
    console.error('Invalid input to categorizeNotesByMilestones:', { notes, milestones });
    return { categorized: [], uncategorized: [...(notes || [])] };
  }

  console.log('Categorizing notes. Total notes:', notes.length, 'Total milestones:', milestones.length);
  
  const categorized = [];
  const uncategorized = [];
  const processedNoteIds = new Set();
  
  // First, find all notes that have triggered milestones
  const noteToMilestones = new Map();
  
  // Build a map of note text to the milestones it triggered
  milestones.forEach(milestone => {
    if (!milestone?.triggeredByNote) return;
    
    // Extract the note text that triggered this milestone
    const noteText = typeof milestone.triggeredByNote === 'string' 
      ? milestone.triggeredByNote 
      : milestone.triggeredByNote.text;
      
    if (!noteText) return;
    
    // Find the original note object that triggered this milestone
    // We need to find the most recent note that matches this text
    const matchingNotes = notes.filter(n => n.text === noteText);
    if (matchingNotes.length === 0) return;
    
    // If there are multiple notes with the same text, use the most recent one
    const originalNote = matchingNotes.reduce((latest, current) => {
      return (!latest || new Date(current.date) > new Date(latest.date)) ? current : latest;
    }, null);
    
    if (!originalNote) return;
    
    if (!noteToMilestones.has(originalNote.id)) {
      noteToMilestones.set(originalNote.id, {
        note: originalNote,
        milestones: []
      });
    }
    noteToMilestones.get(originalNote.id).milestones.push(milestone);
  });
  
  // Process all notes exactly once
  notes.forEach(note => {
    if (processedNoteIds.has(note.id)) return;
    processedNoteIds.add(note.id);
    
    // Check if this note triggered any milestones
    const noteWithMilestones = noteToMilestones.get(note.id);
    
    if (noteWithMilestones?.milestones?.length > 0) {
      // This note triggered milestones
      categorized.push({
        note: noteWithMilestones.note,
        relatedMilestones: noteWithMilestones.milestones,
        primaryMilestone: noteWithMilestones.milestones[0],
        isTriggered: true
      });
    } else {
      // Check for potential milestone matches
      const matches = analyzeMilestoneFromNote(note, milestones);
      if (matches.length > 0) {
        // Only suggest milestones that aren't completed
        const suggestedMilestones = matches
          .filter(m => !m.completed)
          .slice(0, 3);
          
        if (suggestedMilestones.length > 0) {
          categorized.push({
            note,
            relatedMilestones: suggestedMilestones,
            primaryMilestone: suggestedMilestones[0],
            isTriggered: false
          });
          return;
        }
      }
      
      // If we get here, no relevant milestones were found
      uncategorized.push(note);
    }
  });
  
  // Sort both lists by date (newest first)
  const sortByDate = (a, b) => new Date(b.date || 0) - new Date(a.date || 0);
  
  return { 
    categorized: [...categorized].sort((a, b) => sortByDate(a.note, b.note)),
    uncategorized: [...uncategorized].sort(sortByDate)
  };
};

export const generateMilestoneInsights = (milestones, notes) => {
  if (!Array.isArray(milestones) || !Array.isArray(notes)) return {};
  
  const completed = milestones.filter(m => m.completed);
  const pending = milestones.filter(m => !m.completed);
  
  const categoryStats = milestones.reduce((acc, milestone) => {
    const category = milestone.category || 'other';
    if (!acc[category]) {
      acc[category] = { total: 0, completed: 0 };
    }
    acc[category].total++;
    if (milestone.completed) {
      acc[category].completed++;
    }
    return acc;
  }, {});
  
  const difficultyStats = milestones.reduce((acc, milestone) => {
    const difficulty = milestone.difficulty || 'medium';
    if (!acc[difficulty]) {
      acc[difficulty] = { total: 0, completed: 0 };
    }
    acc[difficulty].total++;
    if (milestone.completed) {
      acc[difficulty].completed++;
    }
    return acc;
  }, {});
  
  const recentActivity = notes
    .filter(note => {
      const noteDate = new Date(note.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return noteDate >= weekAgo;
    })
    .length;
  
  return {
    totalMilestones: milestones.length,
    completedMilestones: completed.length,
    pendingMilestones: pending.length,
    completionRate: milestones.length > 0 ? (completed.length / milestones.length) * 100 : 0,
    categoryStats,
    difficultyStats,
    recentActivity,
    estimatedTimeRemaining: pending.reduce((sum, m) => sum + (m.estimatedTime || 30), 0),
    nextRecommendedMilestones: pending
      .filter(m => m.difficulty === 'easy' || m.difficulty === 'medium')
      .slice(0, 5)
  };
};
