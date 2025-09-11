import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Circle, Calendar, Trophy, Target, FileText, Plus, Edit, Save, Download, Image, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { generateGameReport, generateMilestones } from '../utils/openaiService';
import { analyzeMilestoneFromNote, getTriggeredMilestones, categorizeNotesByMilestones, generateMilestoneInsights } from '../utils/milestoneAnalyzer';
import { toast } from 'react-toastify';
import { safeNumber, safeDivision } from '../utils/helpers';
import jsPDF from 'jspdf';

const GameDetailModal = ({ isOpen, onClose, game, onUpdateProgress, onUpdateNotes, onStatusChange, onUpdateGame }) => {
  const [milestones, setMilestones] = useState([]);
  const [report, setReport] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedReport, setEditedReport] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [reportScreenshots, setReportScreenshots] = useState([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [localMilestones, setLocalMilestones] = useState([]);
  
  // Initialize local state when component mounts or game changes
  useEffect(() => {
    if (game) {
      setLocalMilestones([...(game.milestones || [])]);
    }
  }, [game]);
  const [isRegeneratingMilestones, setIsRegeneratingMilestones] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingMilestoneUpdates, setPendingMilestoneUpdates] = useState([]);
  const [categorizedNotes, setCategorizedNotes] = useState({ categorized: [], uncategorized: [] });
  
  // Safely get notes array
  const getSafeNotes = () => {
    return game?.notes || [];
  };
  const [milestoneInsights, setMilestoneInsights] = useState({});
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(true);
  const [hoursPlayed, setHoursPlayed] = useState('');
  const [minutesPlayed, setMinutesPlayed] = useState('');
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [newCoverUrl, setNewCoverUrl] = useState('');

  // Initialize state when component mounts or game changes
  useEffect(() => {
    if (!game) return;
    
    // Safely initialize all state based on game prop
    const safeMilestones = Array.isArray(game.milestones) ? [...game.milestones] : [];
    setLocalMilestones(safeMilestones);
    setNewCoverUrl(game.image || '');
    
    // Initialize notes and insights
    const notes = Array.isArray(game.notes) ? [...game.notes] : [];
    const categorized = categorizeNotesByMilestones(notes, safeMilestones);
    setCategorizedNotes(categorized);
    
    const insights = generateMilestoneInsights(safeMilestones, notes);
    setMilestoneInsights(insights);
  }, [game]);

  // Update categorized notes when milestones or notes change
  useEffect(() => {
    console.log('Updating categorized notes...');
    const notes = Array.isArray(game?.notes) ? [...game.notes] : [];
    console.log('Current notes:', notes);
    console.log('Current localMilestones:', localMilestones);
    
    const categorized = categorizeNotesByMilestones(notes, localMilestones);
    console.log('Categorized notes result:', categorized);
    setCategorizedNotes(categorized);
    
    // Update milestone insights
    const insights = generateMilestoneInsights(localMilestones, notes);
    console.log('Milestone insights:', insights);
    setMilestoneInsights(insights);
  }, [localMilestones, game?.notes]);

  const handleCoverUpdate = () => {
    if (!newCoverUrl.trim()) {
      toast.error('Please enter a valid image URL');
      return;
    }

    const updatedGame = {
      ...game,
      image: newCoverUrl.trim()
    };

    onUpdateGame(updatedGame);
    setIsEditingCover(false);
    toast.success('Game cover updated successfully!');
  };

  const handleCancelCoverEdit = () => {
    setNewCoverUrl(game.image || '');
    setIsEditingCover(false);
  };

  const safeMilestones = Array.isArray(localMilestones) ? localMilestones : [];
  const completedMilestones = safeMilestones.filter(m => m && m.completed).length;
  const totalMilestones = safeMilestones.length;
  const progressPercentage = totalMilestones > safeNumber(0) ? safeDivision(safeNumber(completedMilestones), safeNumber(totalMilestones)) * safeNumber(100) : safeNumber(0);
  const safeProgressPercentage = Number.isFinite(progressPercentage) && !isNaN(progressPercentage) ? Math.max(safeNumber(0), Math.min(safeNumber(100), Math.round(safeNumber(progressPercentage)))) : safeNumber(0);

  const safeFormat = (dateStr, formatStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, formatStr);
    } catch {
      return 'Invalid date';
    }
  };

  const toggleMilestone = (milestoneId) => {
    if (!game || !game.id) return;
    
    const updatedMilestones = (localMilestones || []).map(milestone =>
      milestone && milestone.id === milestoneId
        ? { ...milestone, completed: !milestone.completed }
        : milestone
    ).filter(Boolean); // Remove any null/undefined entries
    
    setLocalMilestones(updatedMilestones);

    const completedCount = updatedMilestones.filter(m => m.completed).length;
    const progress = updatedMilestones.length > safeNumber(0) 
      ? safeDivision(safeNumber(completedCount), safeNumber(updatedMilestones.length)) * safeNumber(100) 
      : safeNumber(0);

    onUpdateProgress(game.id, progress, updatedMilestones);
  };

  const deleteMilestone = (milestoneId) => {
    const updatedMilestones = localMilestones.filter(m => m.id !== milestoneId);
    setLocalMilestones(updatedMilestones);
    const completedCount = updatedMilestones.filter(m => m.completed).length;
    const progress = updatedMilestones.length > safeNumber(0) ? safeDivision(safeNumber(completedCount), safeNumber(updatedMilestones.length)) * safeNumber(100) : safeNumber(0);
    onUpdateProgress(game.id, progress, updatedMilestones);
    toast.success('Milestone deleted!');
  };

  const addCustomMilestone = () => {
    if (newMilestoneTitle.trim() && newMilestoneDescription.trim()) {
      const newMilestone = {
        id: Date.now(),
        title: newMilestoneTitle,
        description: newMilestoneDescription,
        completed: false
      };
      const updatedMilestones = [...localMilestones, newMilestone];
      setLocalMilestones(updatedMilestones);
      const completedCount = updatedMilestones.filter(m => m.completed).length;
      const progress = updatedMilestones.length > safeNumber(0) ? safeDivision(safeNumber(completedCount), safeNumber(updatedMilestones.length)) * safeNumber(100) : safeNumber(0);
      onUpdateProgress(game.id, progress, updatedMilestones);
      setNewMilestoneTitle('');
      setNewMilestoneDescription('');
      toast.success('Custom milestone added!');
    }
  };

  const clearAllMilestones = () => {
    console.log('clearAllMilestones called');
    console.log('Current localMilestones before clear:', localMilestones);
    
    const updatedMilestones = (localMilestones || []).map((m) => ({
      ...m,
      completed: false,
      completedDate: null,
      triggeredByNote: undefined, // Explicitly set to undefined to ensure it's removed
      notes: []
    }));
    
    console.log('Clearing all milestones, updatedMilestones:', updatedMilestones);
    
    // Update local state - the useEffect will handle updating categorizedNotes
    setLocalMilestones(updatedMilestones);
    
    // Update the parent component's state
    const updatedGame = {
      ...game,
      milestones: updatedMilestones
    };
    console.log('Updated game object:', updatedGame);
    onUpdateGame(updatedGame);
  };

  const regenerateMilestones = async () => {
    if (localMilestones.length > 0) {
      if (!window.confirm('This will replace all existing milestones. Are you sure?')) {
        return;
      }
    }
    
    setIsRegeneratingMilestones(true);
    try {
      const newMilestones = await generateMilestones(game.title);
      // Update local state immediately for better UX
      setLocalMilestones(newMilestones);
      
      // Then update the parent component
      const completedCount = newMilestones.filter(m => m.completed).length;
      const progress = newMilestones.length > safeNumber(0) 
        ? safeDivision(safeNumber(completedCount), safeNumber(newMilestones.length)) * safeNumber(100) 
        : safeNumber(0);
      
      // Update parent with the new milestones
      onUpdateProgress(game.id, progress, newMilestones);
      
      // Re-categorize notes with new milestones
      const notes = Array.isArray(game.notes) ? [...game.notes] : [];
      const categorized = categorizeNotesByMilestones(notes, newMilestones);
      setCategorizedNotes(categorized);
      
      toast.success('Milestones regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating milestones:', error);
      toast.error('Failed to regenerate milestones. Please try again.');
    } finally {
      setIsRegeneratingMilestones(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const generatedReport = await generateGameReport(game.title, localMilestones, game.notes || []);
      setReport(generatedReport);
      setEditedReport(generatedReport);
      // Note: Automatic milestone completion removed to prevent unwanted auto-clearing
      // Milestones will only be marked complete through manual user confirmation
      onUpdateNotes(game.id, game.notes || [], generatedReport, reportScreenshots);
      toast.success('AI report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate AI report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleEditReport = () => {
    setIsEditingReport(true);
    setEditedReport(report);
  };

  const handleSaveReport = () => {
    setReport(editedReport);
    onUpdateNotes(game.id, game.notes || [], editedReport, reportScreenshots);
    setIsEditingReport(false);
    toast.success('Report updated successfully!');
  };

  const handleAddNote = () => {
    if (!game?.id || !newNote.trim()) return;
    
    const note = {
      text: newNote,
      date: new Date().toISOString(),
      hoursPlayed: hoursPlayed ? parseFloat(hoursPlayed) : undefined,
      minutesPlayed: minutesPlayed ? parseFloat(minutesPlayed) : undefined
    };
    
    // Use enhanced milestone analysis
    const suggestedMilestones = analyzeMilestoneFromNote(note, localMilestones);
    
    // Check if we have the no-milestones placeholder
    if (suggestedMilestones.length === 1 && suggestedMilestones[0].isPlaceholder) {
      // Show the placeholder message to the user
      toast.info(suggestedMilestones[0].title);
      
      // Add the note directly without showing milestone confirmation
      const updatedNotes = [...getSafeNotes(), note];
      onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
      setNewNote('');
      setHoursPlayed('');
      setMinutesPlayed('');
      
      // Update categorized notes
      const categorized = categorizeNotesByMilestones(updatedNotes, localMilestones);
      setCategorizedNotes(categorized);
    } else if (suggestedMilestones.length > 0) {
      // We have actual milestones to suggest
      const milestonesWithNote = suggestedMilestones.map(milestone => ({
        ...milestone,
        triggeredByNote: note.text // Include the note text with each suggested milestone
      }));
      
      setPendingMilestoneUpdates(milestonesWithNote);
      setShowConfirmationModal(true);
    } else {
      // No milestones to suggest, add note directly
      const updatedNotes = [...getSafeNotes(), note];
      onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
      setNewNote('');
      setHoursPlayed('');
      setMinutesPlayed('');
      toast.success('Note added successfully!');
      
      // Update categorized notes
      const categorized = categorizeNotesByMilestones(updatedNotes, localMilestones);
      setCategorizedNotes(categorized);
    }
  };

  const handleMilestoneDecision = (milestoneId, agree) => {
    // Start with current milestones
    let updatedMilestones = [...localMilestones];
    
    // Find the pending milestone to get the associated note text
    const pendingMilestone = pendingMilestoneUpdates.find(m => m.id === milestoneId);
    const noteText = pendingMilestone?.triggeredByNote || newNote;
    
    if (agree) {
      // Update the specific milestone that was confirmed
      updatedMilestones = updatedMilestones.map(milestone => {
        if (milestone.id === milestoneId) {
          return {
            ...milestone,
            completed: true,
            completedDate: new Date().toISOString(),
            triggeredByNote: typeof noteText === 'string' ? noteText : noteText.text, // Ensure we store just the text
            lastUpdated: new Date().toISOString()
          };
        }
        return milestone;
      });
      
      // Update local state with the new milestones
      setLocalMilestones(updatedMilestones);
      
      // Calculate progress
      const completedCount = updatedMilestones.filter(m => m.completed).length;
      const progress = updatedMilestones.length > 0 
        ? (completedCount / updatedMilestones.length) * 100 
        : 0;
      
      // Update parent component with the new state
      onUpdateProgress(game.id, progress, updatedMilestones);
      
      // Show toast for the specific milestone
      const milestone = updatedMilestones.find(m => m.id === milestoneId);
      if (milestone) {
        toast.success(`Milestone marked as completed: ${milestone.title}`);
      }
    }
    
    // Filter out the processed milestone
    const remainingUpdates = pendingMilestoneUpdates.filter(m => m.id !== milestoneId);
    
    // If no more pending updates, add the note and clean up
    if (remainingUpdates.length === 0) {
      // Create the note object
      const noteToAdd = {
        text: newNote,
        date: new Date().toISOString(),
        hoursPlayed: hoursPlayed ? parseFloat(hoursPlayed) : undefined,
        minutesPlayed: minutesPlayed ? parseFloat(minutesPlayed) : undefined,
        id: `note-${Date.now()}`
      };
      
      // Create the updated notes array with the new note
      const updatedNotes = [...getSafeNotes(), noteToAdd];
      
      // Update notes in parent component
      onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
      
      // Update categorized notes with the latest milestones and notes
      const categorized = categorizeNotesByMilestones(updatedNotes, updatedMilestones);
      setCategorizedNotes(categorized);
      
      // Reset form fields
      setNewNote('');
      setHoursPlayed('');
      setMinutesPlayed('');
      setShowConfirmationModal(false);
      
      toast.success('Note added successfully!');
    }
    
    // Update pending updates for the next confirmation
    setPendingMilestoneUpdates(remainingUpdates);
  };

  const confirmAddNote = () => {
    if (!game?.id) return;
    
    // Create the note object
    const note = {
      text: newNote,
      date: new Date().toISOString(),
      hoursPlayed: hoursPlayed ? parseFloat(hoursPlayed) : undefined,
      minutesPlayed: minutesPlayed ? parseFloat(minutesPlayed) : undefined,
      id: `note-${Date.now()}`
    };
    
    // Add the note
    const updatedNotes = [...getSafeNotes(), note];
    onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
    
    // Reset form fields and state
    setNewNote('');
    setHoursPlayed('');
    setMinutesPlayed('');
    setShowConfirmationModal(false);
    
    // For any pending milestones that weren't processed, mark them as not completed
    if (pendingMilestoneUpdates.length > 0) {
      const updatedMilestones = [...localMilestones];
      let needsUpdate = false;
      
      pendingMilestoneUpdates.forEach(pending => {
        const existing = updatedMilestones.find(m => m.id === pending.id);
        if (existing && !existing.completed) {
          existing.triggeredByNote = undefined;
          needsUpdate = true;
        }
      });
      
      if (needsUpdate) {
        setLocalMilestones(updatedMilestones);
        const completedCount = updatedMilestones.filter(m => m.completed).length;
        const progress = updatedMilestones.length > 0 
          ? (completedCount / updatedMilestones.length) * 100 
          : 0;
        onUpdateProgress(game.id, progress, updatedMilestones);
      }
      
      setPendingMilestoneUpdates([]);
    }
    
    // Update categorized notes
    const categorized = categorizeNotesByMilestones(updatedNotes, localMilestones);
    setCategorizedNotes(categorized);
    
    toast.success('Note added successfully!');
  };

  const handleReportScreenshotUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const updatedScreenshots = [...reportScreenshots, e.target.result];
        setReportScreenshots(updatedScreenshots);
        onUpdateNotes(game.id, game.notes || [], report, updatedScreenshots);
        toast.success('Screenshot added to report!');
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteReportScreenshot = (index) => {
    const updatedScreenshots = reportScreenshots.filter((_, i) => i !== index);
    setReportScreenshots(updatedScreenshots);
    onUpdateNotes(game.id, game.notes || [], report, updatedScreenshots);
    toast.success('Report screenshot deleted!');
  };

  const disassociateMilestoneFromNote = (milestoneId, noteText) => {
    if (!game?.id) return;
    
    // Update the milestone to remove the triggeredByNote reference and mark as incomplete
    const updatedMilestones = localMilestones.map(milestone => {
      if (milestone.id === milestoneId && milestone.triggeredByNote === noteText) {
        return {
          ...milestone,
          completed: false,
          completedDate: null,
          triggeredByNote: undefined,
          lastUpdated: new Date().toISOString()
        };
      }
      return milestone;
    });
    
    // Update local state
    setLocalMilestones(updatedMilestones);
    
    // Update parent component
    const completedCount = updatedMilestones.filter(m => m.completed).length;
    const progress = updatedMilestones.length > 0 
      ? (completedCount / updatedMilestones.length) * 100 
      : 0;
    onUpdateProgress(game.id, progress, updatedMilestones);
    
    // Update categorized notes
    const categorized = categorizeNotesByMilestones(game.notes || [], updatedMilestones);
    setCategorizedNotes(categorized);
    
    toast.success('Milestone marked as incomplete and disassociated from note!');
  };

  const deleteNote = (noteIndex) => {
    if (!game?.id) return;
    
    const currentNotes = getSafeNotes();
    if (noteIndex < 0 || noteIndex >= currentNotes.length) return;
    
    const updatedNotes = [...currentNotes];
    const deletedNote = updatedNotes[noteIndex];
    
    // Uncheck any milestones that were completed by this note
    const updatedMilestones = (localMilestones || []).map(milestone => {
      if (milestone.completed && milestone.triggeredByNote === deletedNote.text) {
        return {
          ...milestone,
          completed: false,
          completedDate: null,
          triggeredByNote: undefined,
          lastUpdated: new Date().toISOString()
        };
      }
      return milestone;
    });
    
    updatedNotes.splice(noteIndex, 1);
    onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
    
    // Update milestones in parent component if any were changed
    if (JSON.stringify(updatedMilestones) !== JSON.stringify(localMilestones)) {
      const completedCount = updatedMilestones.filter(m => m.completed).length;
      const progress = updatedMilestones.length > 0 
        ? (completedCount / updatedMilestones.length) * 100 
        : 0;
      onUpdateProgress(game.id, progress, updatedMilestones);
      setLocalMilestones(updatedMilestones);
    }
    
    // Update categorized notes
    const categorized = categorizeNotesByMilestones(updatedNotes, updatedMilestones.length > 0 ? updatedMilestones : localMilestones);
    setCategorizedNotes(categorized);
    
    toast.success('Note deleted successfully!');
  };

  const exportReport = () => {
    const reportText = `
Game: ${game.title}
Platform: ${game.platform}
Last Played: ${safeFormat(game.lastPlayed, 'MMM d, yyyy')}

Progress: ${safeProgressPercentage}% 

AI Report Summary:
${report?.summary || 'No summary available'}

Key Highlights:
${report?.highlights?.map(h => `- ${h}`).join('\n') || 'No highlights available'}

Next Steps:
${report?.nextSteps?.map(s => `- ${s}`).join('\n') || 'No next steps available'}

Detailed Analysis:
${report?.detailedAnalysis || 'No detailed analysis available'}

Achievements:
${report?.achievements?.map(a => `- ${a}`).join('\n') || 'No achievements available'}

Challenges Faced:
${report?.challenges?.map(c => `- ${c}`).join('\n') || 'No challenges available'}

Future Goals:
${report?.futureGoals?.map(g => `- ${g}`).join('\n') || 'No future goals available'}

Notes:
${(game.notes || []).map(note => `${safeFormat(note.date, 'MMM d, yyyy')}: ${note.text}`).join('\n')}

Screenshots: ${reportScreenshots.length > 0 ? `${reportScreenshots.length} report screenshots attached` : 'No report screenshots'}
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${game.title}-report.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully!');
  };

  const exportPDF = () => {
    if (!game) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const lineHeight = 7;
    let yPosition = margin;
    
    // Helper function to add text with word wrap and page breaks
    const addText = (text, x, y, maxWidth, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const splitText = doc.splitTextToSize(text, maxWidth);
      let linesDrawn = 0;
      
      for (let i = 0; i < splitText.length; i++) {
        // Check if we need a new page
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        
        doc.text(splitText[i], x, y);
        y += lineHeight;
        linesDrawn++;
      }
      
      return { y, linesDrawn };
    };
    
    // Helper to check and add new page if needed
    const checkNewPage = (requiredSpace) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };
    
    // Add title
    doc.setFontSize(20);
    yPosition = addText(game.title, margin, yPosition, pageWidth - margin * 2, true).y + 10;
    
    // Add date
    doc.setFontSize(12);
    yPosition = addText(`Generated on: ${new Date().toLocaleDateString()}`, margin, yPosition, pageWidth - margin * 2).y + 5;
    
    // Add progress
    doc.setFontSize(14);
    yPosition = addText(`Progress: ${safeProgressPercentage}%`, margin, yPosition, pageWidth - margin * 2).y + 10;
    
    // Add milestones section
    checkNewPage(20);
    doc.setFontSize(16);
    yPosition = addText('Milestones:', margin, yPosition, pageWidth - margin * 2, true).y + 5;
    
    doc.setFontSize(12);
    (localMilestones || []).forEach((milestone, index) => {
      checkNewPage(15);
      
      const status = milestone.completed ? '✓' : '◯';
      const milestoneText = `${status} ${milestone.title}${milestone.difficulty ? ` (${milestone.difficulty})` : ''}`;
      yPosition = addText(milestoneText, margin + 5, yPosition, pageWidth - margin * 2 - 5).y + 5;
    });
    
    // Add notes section
    if (game.notes && game.notes.length > 0) {
      checkNewPage(25);
      doc.setFontSize(16);
      yPosition = addText('Notes:', margin, yPosition, pageWidth - margin * 2, true).y + 5;
      
      doc.setFontSize(12);
      game.notes.forEach((note, index) => {
        checkNewPage(30);
        
        const noteDate = new Date(note.date).toLocaleDateString();
        yPosition = addText(`[${noteDate}]`, margin + 5, yPosition, pageWidth - margin * 2 - 5).y + 2;
        const result = addText(note.text, margin + 10, yPosition, pageWidth - margin * 2 - 10);
        yPosition = result.y + 8;
      });
    }
    
    // Add report if exists
    if (report) {
      checkNewPage(25);
      doc.setFontSize(16);
      yPosition = addText('AI Report:', margin, yPosition, pageWidth - margin * 2, true).y + 5;
      
      doc.setFontSize(12);
      const reportSections = [
        { title: 'Summary', content: report.summary },
        { title: 'Highlights', content: report.highlights?.join('\n• ') || '' },
        { title: 'Next Steps', content: report.nextSteps?.join('\n• ') || '' },
        { title: 'Detailed Analysis', content: report.detailedAnalysis || '' },
        { title: 'Achievements', content: report.achievements?.join('\n• ') || '' },
        { title: 'Challenges Faced', content: report.challenges?.join('\n• ') || '' },
        { title: 'Future Goals', content: report.futureGoals?.join('\n• ') || '' }
      ].filter(section => section.content);
      
      reportSections.forEach(section => {
        checkNewPage(30);
        
        // Add section title
        const titleResult = addText(section.title + ':', margin, yPosition, pageWidth - margin * 2, true);
        yPosition = titleResult.y + 2;
        
        // Add section content
        const contentResult = addText(section.content, margin + 5, yPosition, pageWidth - margin * 2 - 5);
        yPosition = contentResult.y + 8;
      });
    }
    
    // Add report screenshots
    if (reportScreenshots.length > 0) {
      checkNewPage(30);
      doc.setFontSize(16);
      yPosition = addText('Screenshots:', margin, yPosition, pageWidth - margin * 2, true).y + 10;
      
      reportScreenshots.forEach((screenshot, index) => {
        try {
          const imgWidth = 150;
          const imgHeight = (150 * 9) / 16; // 16:9 aspect ratio
          
          // Check if we need a new page for this image
          if (yPosition + imgHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          
          doc.addImage(screenshot, 'JPEG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        } catch (e) {
          console.error('Error adding report screenshot to PDF:', e);
          checkNewPage(15);
          yPosition = addText(`Screenshot ${index + 1} could not be embedded`, margin, yPosition, pageWidth - margin * 2).y + 5;
        }
      });
    }

    // Save the PDF with a timestamp in the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    doc.save(`${game.title || 'game'}-report-${timestamp}.pdf`);
    toast.success('PDF exported successfully!');
  };

  if (!isOpen || !game) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity"
                onClick={() => { setShowConfirmationModal(false); onClose(); }}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl"
              >
                <div className="absolute right-0 top-0 pr-4 pt-4 z-10">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    onClick={() => { setShowConfirmationModal(false); onClose(); }}
                  >
                    <span className="sr-only">Close</span>
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="px-4 pb-4 pt-5 sm:p-6">
                  {/* Game Header */}
                  <div className="mb-6">
                    <div className="aspect-video bg-gradient-to-br from-violet-600 to-indigo-500 rounded-lg overflow-hidden mb-4 relative group">
                      <img
                        src={newCoverUrl || game.image || `https://source.unsplash.com/featured/800x450/?${encodeURIComponent(game.title)}`}
                        alt={game.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // If the current source is already the fallback, try a different approach
                          if (e.target.src.includes('source.unsplash.com')) {
                            e.target.src = `https://source.unsplash.com/featured/800x450/?${encodeURIComponent(game.title + ' ' + game.platform)}`;
                          } else if (e.target.src.includes('source.unsplash.com') || !game.image) {
                            // If still failing, use a generic game cover
                            e.target.src = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=450&fit=crop&crop=center';
                          } else {
                            // First fallback: Try the Unsplash API with game title
                            e.target.src = `https://source.unsplash.com/featured/800x450/?${encodeURIComponent(game.title)}`;
                          }
                        }}
                        onLoad={(e) => {
                          // If image loads but is too small, try to find a better one
                          if (e.target.naturalWidth < 200 || e.target.naturalHeight < 100) {
                            e.target.src = `https://source.unsplash.com/featured/800x450/?${encodeURIComponent(game.title + ' ' + game.platform)}`;
                          }
                        }}
                      />
                      {!isEditingCover && (
                        <button
                          onClick={() => setIsEditingCover(true)}
                          className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Change cover image"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {isEditingCover && (
                      <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Update Cover Image</h4>
                        <div className="flex space-x-2">
                          <input
                            type="url"
                            value={newCoverUrl}
                            onChange={(e) => setNewCoverUrl(e.target.value)}
                            placeholder="Enter image URL..."
                            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                          />
                          <button
                            onClick={handleCoverUpdate}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelCoverEdit}
                            className="px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Enter a direct link to an image (jpg, png, gif, etc.)
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                          {game.title}
                        </h2>

                        <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium">Platform: {game.platform}</span>
                          {game.lastPlayed && (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>Last played: {safeFormat(game.lastPlayed, 'MMM d, yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {game.status === 'playing' && (
                          <button
                            onClick={() => onStatusChange(game.id, 'completed')}
                            className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <Trophy className="h-4 w-4" />
                            <span>Mark as Complete</span>
                          </button>
                        )}
                        <button
                          onClick={handleGenerateReport}
                          disabled={isGeneratingReport}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FileText className="h-4 w-4" />
                          <span>{isGeneratingReport ? 'Generating...' : 'Generate AI Report'}</span>
                        </button>
                        {report && (
                          <>
                            <button
                              onClick={exportReport}
                              className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                              <Download className="h-4 w-4" />
                              <span>Export TXT</span>
                            </button>
                            <button
                              onClick={exportPDF}
                              className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <Download className="h-4 w-4" />
                              <span>Export PDF</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Overview */}
                  <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center">
                        <Target className="h-5 w-5 mr-2 text-violet-600" />
                        Progress Overview
                      </h3>
                      <span className="text-2xl font-bold text-violet-600">{safeProgressPercentage}%</span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                      <div
                        className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${safeProgressPercentage}%` }}
                      />
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {completedMilestones} of {totalMilestones} milestones completed
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* AI-Generated Milestones */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center">
                          <Trophy className="h-5 w-5 mr-2 text-indigo-500" />
                          AI-Generated Milestones
                        </h3>
                        <button
                          onClick={regenerateMilestones}
                          disabled={isRegeneratingMilestones}
                          className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={`h-4 w-4 ${isRegeneratingMilestones ? 'animate-spin' : ''}`} />
                          <span>{isRegeneratingMilestones ? 'Regenerating...' : 'Regenerate'}</span>
                        </button>
                      </div>

                      <div className="mb-4">
                        <input
                          type="text"
                          placeholder="Custom milestone title"
                          value={newMilestoneTitle}
                          onChange={(e) => setNewMilestoneTitle(e.target.value)}
                          className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white text-black"
                        />
                        <textarea
                          placeholder="Custom milestone description"
                          value={newMilestoneDescription}
                          onChange={(e) => setNewMilestoneDescription(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white text-black"
                        />
                        <button
                          onClick={addCustomMilestone}
                          className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors"
                        >
                          <Plus className="h-4 w-4 inline mr-2" />
                          Add Custom Milestone
                        </button>
                      </div>

                      <div className="mb-4">
                        <button
                          onClick={() => setShowAllMilestones(!showAllMilestones)}
                          className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                        >
                          {showAllMilestones ? 'Show Less' : `Show All Milestones (${localMilestones.length})`}
                        </button>
                      </div>

                      <div className={`space-y-3 overflow-y-auto ${showAllMilestones ? 'max-h-[70vh]' : 'max-h-96'}`}>
                        {localMilestones.length > safeNumber(0) ? (
                          localMilestones.map((milestone, index) => (
                            <motion.div
                              key={milestone.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.03 }}
                              className={`p-4 rounded-lg border ${milestone.completed ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'} hover:shadow-sm transition-all cursor-pointer`}
                              onClick={() => toggleMilestone(milestone.id)}
                            >
                              <div className="flex items-start">
                                <div className="mr-3 flex-shrink-0 mt-0.5">
                                  {milestone.completed ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-gray-300" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center flex-wrap gap-2 mb-1">
                                    <h3 className={`text-base font-medium ${milestone.completed ? 'text-gray-600 line-through' : 'text-gray-900'}`}>
                                      {milestone.title}
                                    </h3>
                                    {milestone.gamePercentage && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full whitespace-nowrap">
                                        ~{milestone.gamePercentage}%
                                      </span>
                                    )}
                                    {milestone.difficulty && (
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                                        milestone.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                        milestone.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                        milestone.difficulty === 'hard' ? 'bg-orange-100 text-orange-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {milestone.difficulty.charAt(0).toUpperCase() + milestone.difficulty.slice(1)}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {milestone.description && (
                                    <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                                  )}
                                  
                                  {milestone.action && (
                                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800/50">
                                      {game.title === 'Sonic Heroes' && milestone.team && (
                                        <div className="mb-2">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                            {milestone.team.split(',')[0].trim()}
                                          </span>
                                        </div>
                                      )}
                                      <p className="text-sm text-gray-700 dark:text-gray-300">{milestone.action}</p>
                                      {milestone.gamePercentage && (
                                        <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-400">
                                          Expected completion: ~{milestone.gamePercentage}% of game
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="flex-shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteMilestone(milestone.id);
                                    }}
                                    className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                                    title="Delete Milestone"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                            No milestones available for this game.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-green-500" />
                        Notes
                      </h3>

                      <div className="space-y-3 mb-4">
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a new note..."
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                        />
                        
                        {/* Time Played Inputs */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Hours Played
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={hoursPlayed}
                              onChange={(e) => setHoursPlayed(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Minutes Played
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              step="1"
                              value={minutesPlayed}
                              onChange={(e) => setMinutesPlayed(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100 text-sm"
                            />
                          </div>
                        </div>
                        
                        <button
                          onClick={handleAddNote}
                          className="inline-flex items-center space-x-2 px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Note</span>
                        </button>
                      </div>

                      <div className="mb-4">
                        <button
                          onClick={() => setShowAllNotes(!showAllNotes)}
                          className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                        >
                          {showAllNotes ? 'Show Less' : `Show More (${(game.notes || []).length})`}
                        </button>
                      </div>

                      <div className={`space-y-3 overflow-y-auto ${showAllNotes ? 'max-h-[70vh]' : 'max-h-64'}`}>
                        {/* All Notes */}
                        {[...(game.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map((note, index) => {
                          // Check if this note is in the categorized list
                          const categorizedNote = categorizedNotes.categorized.find(cn => 
                            cn.note.text === note.text && cn.note.date === note.date
                          );
                          
                          // If it's a categorized note, use that data, otherwise treat as uncategorized
                          const noteData = categorizedNote || { note, relatedMilestones: [] };
                          const noteIndex =
                            game.notes?.findIndex(
                              (n) => n.text === noteData.note.text && n.date === noteData.note.date
                            ) ?? -1;

                          return (
                            <div
                              key={`note-${index}`}
                              className={`p-3 rounded-lg relative hover:shadow-sm transition-shadow ${
                                categorizedNote 
                                  ? 'bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800'
                                  : 'bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600'
                              }`}
                            >
                              <p className="text-sm text-slate-900 dark:text-slate-100 mb-2">
                                {noteData.note.text}
                              </p>
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                                <span>{safeFormat(noteData.note.date, "MMM d, yyyy")}</span>
                                {(noteData.note.hoursPlayed || noteData.note.minutesPlayed) && (
                                  <span className="text-violet-600 dark:text-violet-400 font-medium">
                                    {noteData.note.hoursPlayed ? `${noteData.note.hoursPlayed}h` : ""}
                                    {noteData.note.hoursPlayed && noteData.note.minutesPlayed ? " " : ""}
                                    {noteData.note.minutesPlayed
                                      ? `${noteData.note.minutesPlayed}m`
                                      : ""}
                                  </span>
                                )}
                              </div>

                              {categorizedNote && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {categorizedNote.isTriggered ? 'Milestones Cleared by This Note:' : 'Related Milestones:'}
                                  </p>
                                  {categorizedNote.relatedMilestones
                                    .filter(milestone => milestone.completed) // Only show completed milestones
                                    .map((milestone) => (
                                      <div
                                        key={milestone.id}
                                        className="group relative text-xs rounded px-2 py-1 border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:pr-6 transition-all"
                                      >
                                        <div className="font-medium text-slate-900 dark:text-slate-100">
                                          {milestone.title}
                                        </div>
                                        <div className="mt-1 text-sm text-green-600 dark:text-green-400 flex justify-between items-center">
                                          <span>✓ Cleared by this note</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              disassociateMilestoneFromNote(milestone.id, noteData.note.text);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 absolute right-1 top-1 p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                                            title="Disassociate milestone from this note"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (noteIndex >= 0) {
                                    deleteNote(noteIndex);
                                  }
                                }}
                                className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
                                title="Delete Note"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* Empty state when there are no notes */}
                        
                        {(game.notes || []).length === 0 && (
                          <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                            No notes yet. Add your first note above!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* AI Report */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-indigo-500" />
                        AI Progress Report
                      </h3>

                      {report ? (
                        <div className="space-y-4">
                          {isEditingReport ? (
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Summary</label>
                                <textarea
                                  value={editedReport.summary}
                                  onChange={(e) => setEditedReport({ ...editedReport, summary: e.target.value })}
                                  rows={3}
                                  style={{ color: 'black' }}
                                  className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Highlights</label>
                                {editedReport.highlights.map((highlight, index) => (
                                  <input
                                    key={index}
                                    value={highlight}
                                    onChange={(e) => {
                                      const newHighlights = [...editedReport.highlights];
                                      newHighlights[index] = e.target.value;
                                      setEditedReport({ ...editedReport, highlights: newHighlights });
                                    }}
                                    style={{ color: 'black' }}
                                    className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                                  />
                                ))}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Next Steps</label>
                                {editedReport.nextSteps.map((step, index) => (
                                  <input
                                    key={index}
                                    value={step}
                                    onChange={(e) => {
                                      const newSteps = [...editedReport.nextSteps];
                                      newSteps[index] = e.target.value;
                                      setEditedReport({ ...editedReport, nextSteps: newSteps });
                                    }}
                                    style={{ color: 'black' }}
                                    className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                                  />
                                ))}
                              </div>
                              <button
                                onClick={handleSaveReport}
                                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                              >
                                Save Changes
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Summary</h4>
                                <p className="text-sm text-slate-900 dark:text-slate-100">{report.summary}</p>
                              </div>

                              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Key Highlights</h4>
                                <ul className="text-sm text-slate-900 dark:text-slate-100 space-y-1">
                                  {report.highlights.map((highlight, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{highlight}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Next Steps</h4>
                                <ul className="text-sm text-slate-900 dark:text-slate-100 space-y-1">
                                  {report.nextSteps.map((step, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Detailed Analysis</h4>
                                <p className="text-sm text-slate-900 dark:text-slate-100">{report.detailedAnalysis}</p>
                              </div>

                              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Achievements</h4>
                                <ul className="text-sm text-slate-900 dark:text-slate-100 space-y-1">
                                  {report.achievements.map((achievement, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{achievement}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Challenges Faced</h4>
                                <ul className="text-sm text-slate-900 dark:text-slate-100 space-y-1">
                                  {report.challenges.map((challenge, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{challenge}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Future Goals</h4>
                                <ul className="text-sm text-slate-900 dark:text-slate-100 space-y-1">
                                  {report.futureGoals.map((goal, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{goal}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="mb-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <Image className="h-4 w-4 text-slate-400" />
                                  <span className="text-sm text-slate-600 dark:text-slate-400">Add Screenshot to Report</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleReportScreenshotUpload}
                                    className="hidden"
                                  />
                                </label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {reportScreenshots.map((screenshot, index) => (
                                    <div key={index} className="relative">
                                      <img src={screenshot} alt={`Report screenshot ${index + safeNumber(1)}`} className="w-20 h-20 object-cover rounded-md" />
                                      <button
                                        onClick={() => deleteReportScreenshot(index)}
                                        className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
                                        title="Delete Screenshot"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <button
                                onClick={handleEditReport}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                              >
                                <Edit className="h-4 w-4 inline mr-2" />
                                Edit Report
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Click "Generate AI Report" to get insights based on your progress and notes.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      onClick={() => { setShowConfirmationModal(false); onClose(); }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Pending Milestones */}
      <AnimatePresence>
        {showConfirmationModal && (
          <div className="fixed inset-0 z-[70] overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity"
                onClick={() => setShowConfirmationModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
              >
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-slate-100 mb-4">
                      Suggested Milestones
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      Based on your note, these milestones might be completed. Agree or disagree for each:
                    </p>
                    <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                      {pendingMilestoneUpdates.map((milestone) => (
                        <div key={milestone.id} className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <div className="flex-1 min-w-0 pr-3">
                            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">{milestone.title}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{milestone.description}</p>
                            {milestone.action && (
                              <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 font-medium">
                                <span className="font-semibold">How to achieve:</span> {milestone.action}
                              </p>
                            )}
                            <div className="flex items-center mt-2 space-x-2 text-xs">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                milestone.category === 'story' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                milestone.category === 'exploration' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                milestone.category === 'gameplay' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                              }`}>
                                {milestone.category}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                milestone.difficulty === 'easy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                milestone.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                milestone.difficulty === 'hard' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {milestone.difficulty}
                              </span>
                              {milestone.matchScore && (
                                <span className="text-slate-600 dark:text-slate-400">
                                  Match: {Math.min(milestone.matchScore * 20, 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col space-y-2 flex-shrink-0">
                            <button
                              onClick={() => handleMilestoneDecision(milestone.id, true)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                            >
                              Agree
                            </button>
                            <button
                              onClick={() => handleMilestoneDecision(milestone.id, false)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                            >
                              Disagree
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="button"
                        className="inline-flex w-full justify-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 sm:ml-3 sm:w-auto"
                        onClick={confirmAddNote}
                      >
                        Add Note
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 sm:mt-0 sm:w-auto"
                        onClick={() => setShowConfirmationModal(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GameDetailModal;