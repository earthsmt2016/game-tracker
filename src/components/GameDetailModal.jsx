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
  const [isRegeneratingMilestones, setIsRegeneratingMilestones] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingMilestoneUpdates, setPendingMilestoneUpdates] = useState([]);
  const [categorizedNotes, setCategorizedNotes] = useState({ categorized: [], uncategorized: [] });
  const [milestoneInsights, setMilestoneInsights] = useState({});
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [hoursPlayed, setHoursPlayed] = useState('');
  const [minutesPlayed, setMinutesPlayed] = useState('');
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [newCoverUrl, setNewCoverUrl] = useState('');

  useEffect(() => {
    if (game) {
      setMilestones(game.milestones || []);
      setReport(game.report || null);
      setReportScreenshots(game.reportScreenshots || []);
      setNewCoverUrl(game.image || '');
      
      // Analyze notes and milestones
      const notes = game.notes || [];
      const categorized = categorizeNotesByMilestones(notes, game.milestones || []);
      setCategorizedNotes(categorized);
      
      const insights = generateMilestoneInsights(game.milestones || [], notes);
      setMilestoneInsights(insights);
    }
  }, [game]);

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

  const completedMilestones = milestones.filter(m => m.completed).length;
  const totalMilestones = milestones.length;
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
    const updatedMilestones = milestones.map(milestone =>
      milestone.id === milestoneId
        ? { ...milestone, completed: !milestone.completed }
        : milestone
    );
    setMilestones(updatedMilestones);

    const completedCount = updatedMilestones.filter(m => m.completed).length;
    const progress = updatedMilestones.length > safeNumber(0) ? safeDivision(safeNumber(completedCount), safeNumber(updatedMilestones.length)) * safeNumber(100) : safeNumber(0);

    onUpdateProgress(game.id, progress, updatedMilestones);
  };

  const deleteMilestone = (milestoneId) => {
    const updatedMilestones = milestones.filter(m => m.id !== milestoneId);
    setMilestones(updatedMilestones);
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
      const updatedMilestones = [...milestones, newMilestone];
      setMilestones(updatedMilestones);
      const completedCount = updatedMilestones.filter(m => m.completed).length;
      const progress = updatedMilestones.length > safeNumber(0) ? safeDivision(safeNumber(completedCount), safeNumber(updatedMilestones.length)) * safeNumber(100) : safeNumber(0);
      onUpdateProgress(game.id, progress, updatedMilestones);
      setNewMilestoneTitle('');
      setNewMilestoneDescription('');
      toast.success('Custom milestone added!');
    }
  };

  const regenerateMilestones = async () => {
    setIsRegeneratingMilestones(true);
    try {
      const newMilestones = await generateMilestones(game.title);
      setMilestones(newMilestones);
      const completedCount = newMilestones.filter(m => m.completed).length;
      const progress = newMilestones.length > safeNumber(0) ? safeDivision(safeNumber(completedCount), safeNumber(newMilestones.length)) * safeNumber(100) : safeNumber(0);
      onUpdateProgress(game.id, progress, newMilestones);
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
      const generatedReport = await generateGameReport(game.title, milestones, game.notes || []);
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
    if (newNote.trim()) {
      const note = {
        text: newNote,
        date: new Date().toISOString(),
        hoursPlayed: hoursPlayed ? parseFloat(hoursPlayed) : undefined,
        minutesPlayed: minutesPlayed ? parseFloat(minutesPlayed) : undefined
      };
      
      // Use enhanced milestone analysis
      const suggestedMilestones = analyzeMilestoneFromNote(note, milestones);

      if (suggestedMilestones.length > 0) {
        setPendingMilestoneUpdates(suggestedMilestones);
        setShowConfirmationModal(true);
      } else {
        // No milestones to suggest, add note directly
        const updatedNotes = [...(game.notes || []), note];
        onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
        setNewNote('');
        setHoursPlayed('');
        setMinutesPlayed('');
        toast.success('Note added successfully!');
        
        // Update categorized notes
        const categorized = categorizeNotesByMilestones(updatedNotes, milestones);
        setCategorizedNotes(categorized);
      }
    }
  };

  const handleMilestoneDecision = (milestoneId, agree) => {
    setPendingMilestoneUpdates(prev => prev.filter(m => m.id !== milestoneId));
    if (agree) {
      const updatedMilestones = milestones.map(milestone =>
        milestone.id === milestoneId
          ? { ...milestone, completed: true, dateCompleted: new Date().toISOString(), triggeredByNote: newNote }
          : milestone
      );
      setMilestones(updatedMilestones);
      
      const completedCount = updatedMilestones.filter(m => m.completed).length;
      const progress = updatedMilestones.length > safeNumber(0) ? safeDivision(safeNumber(completedCount), safeNumber(updatedMilestones.length)) * safeNumber(100) : safeNumber(0);
      onUpdateProgress(game.id, progress, updatedMilestones);
    }
    
    // If no more pending updates, proceed with adding the note
    if (pendingMilestoneUpdates.filter(m => m.id !== milestoneId).length === 0) {
      confirmAddNote();
    }
  };

  const confirmAddNote = () => {
    const note = {
      text: newNote,
      date: new Date().toISOString(),
      hoursPlayed: hoursPlayed ? parseFloat(hoursPlayed) : undefined,
      minutesPlayed: minutesPlayed ? parseFloat(minutesPlayed) : undefined
    };
    const updatedNotes = [...(game.notes || []), note];
    onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
    setNewNote('');
    setHoursPlayed('');
    setMinutesPlayed('');
    setShowConfirmationModal(false);
    setPendingMilestoneUpdates([]);
    toast.success('Note added successfully!');
    
    // Update categorized notes
    const categorized = categorizeNotesByMilestones(updatedNotes, milestones);
    setCategorizedNotes(categorized);
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

  const deleteNote = (noteIndex) => {
    const updatedNotes = [...(game.notes || [])];
    updatedNotes.splice(noteIndex, 1);
    onUpdateNotes(game.id, updatedNotes, report, reportScreenshots);
    toast.success('Note deleted!');
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
    const doc = new jsPDF();
    let yPosition = safeNumber(20);
    const lineHeight = safeNumber(10);
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(safeNumber(16));
    doc.text(`Game Report: ${game.title}`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight) * safeNumber(2);

    doc.setFontSize(safeNumber(12));
    doc.text(`Platform: ${game.platform}`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    doc.text(`Last Played: ${safeFormat(game.lastPlayed, 'MMM d, yyyy')}`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    doc.text(`Progress: ${safeProgressPercentage}%`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight) * safeNumber(2);

    if (report) {
      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('AI Report Summary:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      const summaryLines = doc.splitTextToSize(report.summary, safeNumber(170));
      doc.text(summaryLines, safeNumber(20), yPosition);
      yPosition += summaryLines.length * safeNumber(lineHeight) + safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Key Highlights:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      report.highlights.forEach((highlight, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${highlight}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
      yPosition += safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Next Steps:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      report.nextSteps.forEach((step, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${step}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
      yPosition += safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Detailed Analysis:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      const analysisLines = doc.splitTextToSize(report.detailedAnalysis, safeNumber(170));
      doc.text(analysisLines, safeNumber(20), yPosition);
      yPosition += analysisLines.length * safeNumber(lineHeight) + safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Achievements:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      report.achievements.forEach((achievement, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${achievement}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
      yPosition += safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Challenges Faced:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      report.challenges.forEach((challenge, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${challenge}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
      yPosition += safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Future Goals:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      report.futureGoals.forEach((goal, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${goal}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
    }

    // Add notes
    if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
      doc.addPage();
      yPosition = safeNumber(20);
    }
    doc.text('Notes:', safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    (game.notes || []).forEach((note, index) => {
      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text(`${safeFormat(note.date, 'MMM d, yyyy')}: ${note.text}`, safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
    });

    // Add report screenshots
    if (reportScreenshots.length > 0) {
      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Report Screenshots:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      reportScreenshots.forEach((screenshot, index) => {
        if (yPosition + safeNumber(60) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        try {
          doc.addImage(screenshot, 'JPEG', safeNumber(20), yPosition, safeNumber(50), safeNumber(50));
          yPosition += safeNumber(60);
        } catch (e) {
          console.error('Error adding report screenshot to PDF:', e);
          doc.text(`Screenshot ${index + 1} could not be embedded`, safeNumber(20), yPosition);
          yPosition += safeNumber(lineHeight);
        }
      });
    }

    doc.save(`${game.title}-report.pdf`);
    toast.success('PDF exported successfully!');
  };

  if (!game) return null;

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
                        src={newCoverUrl || `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&h=338&fit=crop&crop=center`}
                        alt={game.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&h=338&fit=crop&crop=center`;
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
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                        />
                        <textarea
                          placeholder="Custom milestone description"
                          value={newMilestoneDescription}
                          onChange={(e) => setNewMilestoneDescription(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
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
                          {showAllMilestones ? 'Show Less' : `Show All Milestones (${milestones.length})`}
                        </button>
                      </div>

                      <div className={`space-y-3 overflow-y-auto ${showAllMilestones ? 'max-h-[70vh]' : 'max-h-96'}`}>
                        {milestones.length > safeNumber(0) ? (
                          milestones.map((milestone, index) => (
                            <motion.div
                              key={milestone.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * safeNumber(0.1) }}
                              className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                                milestone.completed
                                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                  : 'bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-600'
                              }`}
                              onClick={() => toggleMilestone(milestone.id)}
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {milestone.completed ? (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-slate-400 hover:text-violet-500 transition-colors" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-medium ${
                                  milestone.completed
                                    ? 'text-green-800 dark:text-green-300 line-through'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}>
                                  {milestone.title}
                                </h4>
                                <p className={`text-xs mt-1 ${
                                  milestone.completed
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}>
                                  {milestone.description}
                                </p>
                                {milestone.action && (
                                  <p className={`text-xs mt-1 font-medium ${
                                    milestone.completed
                                      ? 'text-green-700 dark:text-green-300'
                                      : 'text-violet-600 dark:text-violet-400'
                                  }`}>
                                    <span className="font-semibold">How to achieve:</span> {milestone.action}
                                  </p>
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
                          {showAllNotes ? 'Show Less' : `Show All Notes (${(game.notes || []).length})`}
                        </button>
                      </div>

                      <div className={`space-y-2 overflow-y-auto ${showAllNotes ? 'max-h-[70vh]' : 'max-h-64'}`}>
                        {/* Categorized Notes with Related Milestones */}
                        {categorizedNotes.categorized.map((noteData, index) => (
                          <div key={`cat-${index}`} className="p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg relative border border-green-200 dark:border-green-800">
                            <p className="text-sm text-slate-900 dark:text-slate-100 mb-2">{noteData.note.text}</p>
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                              <span>{safeFormat(noteData.note.date, 'MMM d, yyyy')}</span>
                              {(noteData.note.hoursPlayed || noteData.note.minutesPlayed) && (
                                <span className="text-violet-600 dark:text-violet-400 font-medium">
                                  {noteData.note.hoursPlayed ? `${noteData.note.hoursPlayed}h` : ''}
                                  {noteData.note.hoursPlayed && noteData.note.minutesPlayed ? ' ' : ''}
                                  {noteData.note.minutesPlayed ? `${noteData.note.minutesPlayed}m` : ''}
                                </span>
                              )}
                            </div>
                            
                            {/* Actually Cleared Milestones */}
                            {(() => {
                              const clearedMilestones = milestones.filter(m => 
                                m.completed && m.triggeredByNote === noteData.note.text
                              );
                              return clearedMilestones.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Milestones Cleared by This Note:
                                  </p>
                                  {clearedMilestones.slice(0, 3).map((milestone) => (
                                    <div key={milestone.id} className="text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 rounded px-2 py-1 border border-green-200 dark:border-green-800">
                                      <span className="font-medium text-green-800 dark:text-green-300">{milestone.title}</span>
                                      <span className="ml-2 text-green-600 dark:text-green-400">✓ Completed</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                            
                            <button
                              onClick={() => deleteNote(categorizedNotes.categorized.length + index)}
                              className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
                              title="Delete Note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        
                        {/* Uncategorized Notes */}
                        {categorizedNotes.uncategorized.map((note, index) => (
                          <div key={`uncat-${index}`} className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg relative">
                            <p className="text-sm text-slate-900 dark:text-slate-100">{note.text}</p>
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span>{safeFormat(note.date, 'MMM d, yyyy')}</span>
                              {(note.hoursPlayed || note.minutesPlayed) && (
                                <span className="text-violet-600 dark:text-violet-400 font-medium">
                                  {note.hoursPlayed ? `${note.hoursPlayed}h` : ''}
                                  {note.hoursPlayed && note.minutesPlayed ? ' ' : ''}
                                  {note.minutesPlayed ? `${note.minutesPlayed}m` : ''}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => deleteNote(categorizedNotes.categorized.length + index)}
                              className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
                              title="Delete Note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        
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
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
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
                                    className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
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
                                    className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
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
                                <h4 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-2">Summary</h4>
                                <p className="text-sm text-indigo-700 dark:text-indigo-400">{report.summary}</p>
                              </div>

                              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Key Highlights</h4>
                                <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                                  {report.highlights.map((highlight, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{highlight}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">Next Steps</h4>
                                <ul className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                                  {report.nextSteps.map((step, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Detailed Analysis</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-400">{report.detailedAnalysis}</p>
                              </div>

                              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Achievements</h4>
                                <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                                  {report.achievements.map((achievement, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{achievement}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Challenges Faced</h4>
                                <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                                  {report.challenges.map((challenge, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{challenge}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Future Goals</h4>
                                <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
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