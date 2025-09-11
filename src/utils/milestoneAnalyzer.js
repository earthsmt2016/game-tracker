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

export const categorizeNotesByMilestones = (notes, milestones) => {
  if (!Array.isArray(notes) || !Array.isArray(milestones)) {
    console.log('Invalid input to categorizeNotesByMilestones:', { notes, milestones });
    return { categorized: [], uncategorized: notes || [] };
  }
  
  console.log('Categorizing notes. Total notes:', notes.length, 'Total milestones:', milestones.length);
  
  const categorized = [];
  const uncategorized = [];
  const processedNoteIds = new Set();
  
  // First pass: Process all notes and collect unique ones by milestone
  const notesByMilestone = new Map();
  
  notes.forEach(note => {
    if (!note?.id || processedNoteIds.has(note.id)) return;
    processedNoteIds.add(note.id);
    
    // Check for milestones triggered by this note
    const triggeredMilestones = [];
    
    milestones.forEach(milestone => {
      if (!milestone?.triggeredByNote) return;
      
      const isMatch = typeof milestone.triggeredByNote === 'string'
        ? milestone.triggeredByNote === note.text
        : milestone.triggeredByNote?.text === note.text;
        
      if (isMatch) {
        triggeredMilestones.push(milestone);
      }
    });
    
    if (triggeredMilestones.length > 0) {
      triggeredMilestones.forEach(milestone => {
        if (!notesByMilestone.has(milestone.id)) {
          notesByMilestone.set(milestone.id, { note, milestone });
        }
      });
    }
  });
  
  // Second pass: Process unique notes and build the final result
  const processedNotes = new Set();
  
  // First, add all notes that triggered milestones (without duplicates)
  for (const [milestoneId, { note, milestone }] of notesByMilestone) {
    if (processedNotes.has(note.id)) continue;
    
    const existingEntry = categorized.find(c => 
      c.note.id === note.id || 
      c.relatedMilestones.some(m => m.id === milestoneId)
    );
    
    if (!existingEntry) {
      const allMilestones = Array.from(notesByMilestone.entries())
        .filter(([_, { note: n }]) => n.id === note.id)
        .map(([_, { milestone: m }]) => m);
      
      if (allMilestones.length > 0) {
        categorized.push({
          note,
          relatedMilestones: allMilestones,
          primaryMilestone: allMilestones[0],
          isTriggered: true
        });
        processedNotes.add(note.id);
      }
    }
  }
  
  // Then process remaining notes that didn't trigger milestones
  notes.forEach(note => {
    if (processedNotes.has(note.id)) return;
    
    const matches = analyzeMilestoneFromNote(note, milestones);
    if (matches.length > 0) {
      // Only suggest milestones that aren't already completed or used
      const suggestedMilestones = matches
        .filter(m => !m.completed && !notesByMilestone.has(m.id))
        .slice(0, 3);
        
      if (suggestedMilestones.length > 0) {
        categorized.push({
          note,
          relatedMilestones: suggestedMilestones,
          primaryMilestone: suggestedMilestones[0],
          isTriggered: false
        });
        processedNotes.add(note.id);
        return;
      }
    }
    
    // If we get here, no relevant milestones were found
    uncategorized.push(note);
  });
  
  return { categorized, uncategorized };
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
