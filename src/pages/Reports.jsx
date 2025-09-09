import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Trophy, Clock, BarChart3, Download, FileText, Edit, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, addWeeks } from 'date-fns';
import Header from '../components/Header';
import Footer from '../components/Footer';
import jsPDF from 'jspdf';
import { generateWeeklyReport } from '../utils/openaiService';
import { toast } from 'react-toastify';
import { safeNumber, safeDivision } from '../utils/helpers';

const Reports = () => {
  const [games, setGames] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [isGeneratingWeeklyReport, setIsGeneratingWeeklyReport] = useState(false);
  const [isEditingWeeklyReport, setIsEditingWeeklyReport] = useState(false);
  const [editedWeeklyReport, setEditedWeeklyReport] = useState(null);

  useEffect(() => {
    try {
      const savedGames = localStorage.getItem('gameTracker_games');
      if (savedGames) {
        const parsed = JSON.parse(savedGames);
        if (!Array.isArray(parsed)) {
          setGames([]);
          return;
        }
        // Sanitize data to prevent NaN errors
        const sanitizedGames = parsed.map(game => ({
          ...game,
          progress: (() => {
            const p = Number(game.progress);
            return (Number.isFinite(p) && !isNaN(p)) ? Math.max(safeNumber(0), Math.min(safeNumber(100), safeNumber(p))) : safeNumber(0);
          })(),
          milestones: Array.isArray(game.milestones) ? game.milestones : [],
          notes: Array.isArray(game.notes) ? game.notes : [],
          reportScreenshots: Array.isArray(game.reportScreenshots) ? game.reportScreenshots : []
        }));
        setGames(sanitizedGames);
      }
    } catch (error) {
      console.error('Error loading games from localStorage:', error);
      setGames([]);
    }
  }, []);

  // Filter games for the selected week
  const weekStart = selectedWeek;
  const weekEnd = endOfWeek(selectedWeek);
  const gamesThisWeek = Array.isArray(games) ? games.filter(game => {
    if (!game.lastPlayed) return false;
    try {
      const gameDate = new Date(game.lastPlayed);
      if (isNaN(gameDate.getTime())) return false;
      return gameDate >= weekStart && gameDate <= weekEnd;
    } catch {
      return false;
    }
  }) : [];

  // Generate weekly activity data based on actual time played from notes
  const generateWeeklyData = () => {
    try {
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      return Array.isArray(days) ? days.map(day => {
        const dayName = format(day, 'EEE');
        const dayString = format(day, 'yyyy-MM-dd');
        
        // Calculate total hours from notes for this day
        let totalHours = 0;
        let notesCount = 0;
        
        gamesThisWeek.forEach(game => {
          if (Array.isArray(game.notes)) {
            game.notes.forEach(note => {
              try {
                const noteDate = new Date(note.date);
                if (!isNaN(noteDate.getTime()) && format(noteDate, 'yyyy-MM-dd') === dayString) {
                  notesCount++;
                  if (note.hoursPlayed && Number.isFinite(note.hoursPlayed) && !isNaN(note.hoursPlayed)) {
                    totalHours += safeNumber(note.hoursPlayed);
                  }
                  if (note.minutesPlayed && Number.isFinite(note.minutesPlayed) && !isNaN(note.minutesPlayed)) {
                    totalHours += safeNumber(note.minutesPlayed) / 60;
                  }
                }
              } catch {
                // Skip invalid dates
              }
            });
          }
        });
        
        const safeHours = (Number.isFinite(totalHours) && !isNaN(totalHours)) ? totalHours : safeNumber(0);
        const roundedHours = Math.round(safeHours * 100) / 100;
        const finalHours = (Number.isFinite(roundedHours) && !isNaN(roundedHours)) ? roundedHours : safeNumber(0);
        
        return {
          day: dayName,
          hours: finalHours,
          notes: safeNumber(notesCount) || safeNumber(0)
        };
      }) : [];
    } catch (error) {
      console.error('Error generating weekly data:', error);
      return [];
    }
  };

  // Platform distribution data for this week
  const getPlatformData = () => {
    const platformCounts = (Array.isArray(gamesThisWeek) ? gamesThisWeek : []).reduce((acc, game) => {
      if (typeof game.platform === 'string' && game.platform.trim()) {
        acc[game.platform] = (acc[game.platform] || safeNumber(0)) + safeNumber(1);
      }
      return acc;
    }, {});

    const colors = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

    return Object.entries(platformCounts).map(([platform, count], index) => {
      const safeCount = safeNumber(count);
      const finalCount = (Number.isFinite(safeCount) && !isNaN(safeCount)) ? safeCount : safeNumber(0);
      return {
        name: platform,
        value: finalCount,
        color: colors[index % colors.length]
      };
    });
  };

  // Progress data for this week
  const getProgressData = () => {
    return (Array.isArray(gamesThisWeek) ? gamesThisWeek : [])
      .filter(game => game.status === 'playing' && typeof game.title === 'string' && game.title.trim() && typeof game.progress === 'number' && Number.isFinite(game.progress) && !isNaN(game.progress))
      .map(game => ({
        name: (game.title.length > safeNumber(15)) ? game.title.substring(safeNumber(0), safeNumber(15)) + '...' : game.title,
        progress: (() => {
          const p = safeNumber(game.progress);
          return (Number.isFinite(p) && !isNaN(p)) ? Math.max(safeNumber(0), Math.min(safeNumber(100), safeNumber(p))) : safeNumber(0);
        })()
      }))
      .sort((a, b) => b.progress - a.progress);
  };

  const safeFormat = (dateStr, formatStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, formatStr);
    } catch {
      return 'Invalid date';
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let yPosition = safeNumber(20);
    const lineHeight = safeNumber(10);
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(safeNumber(16));
    doc.text('Gaming Reports Summary', safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight) * safeNumber(2);

    doc.setFontSize(safeNumber(12));
    doc.text(`Total Games This Week: ${gamesThisWeek.length}`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    doc.text(`Completed This Week: ${gamesThisWeek.filter(g => g.status === 'completed').length}`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    doc.text(`In Progress This Week: ${gamesThisWeek.filter(g => g.status === 'playing').length}`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    const safeAverage = Number.isFinite(averageProgressThisWeek) && !isNaN(averageProgressThisWeek) ? averageProgressThisWeek : safeNumber(0);
    doc.text(`Average Progress This Week: ${safeAverage}%`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight) * safeNumber(2);

    if (weeklyReport) {
      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Weekly Report Summary:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      const summaryLines = doc.splitTextToSize(weeklyReport.summary, safeNumber(170));
      doc.text(summaryLines, safeNumber(20), yPosition);
      yPosition += summaryLines.length * safeNumber(lineHeight) + safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Highlights:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      weeklyReport.highlights.forEach((highlight, index) => {
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
      doc.text('Progress:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      weeklyReport.progress.forEach((prog, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${prog}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
      yPosition += safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Insights:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      weeklyReport.insights.forEach((insight, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${insight}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
      yPosition += safeNumber(lineHeight);

      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Next Week Goals:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      weeklyReport.nextWeekGoals.forEach((goal, index) => {
        if (yPosition + safeNumber(lineHeight) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`- ${goal}`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
      });
    }

    // Add notes and screenshots from games this week
    gamesThisWeek.forEach(game => {
      if (game.notes && game.notes.length > safeNumber(0)) {
        if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        doc.text(`Notes for ${game.title}:`, safeNumber(20), yPosition);
        yPosition += safeNumber(lineHeight);
        game.notes.forEach((note, index) => {
          if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
            doc.addPage();
            yPosition = safeNumber(20);
          }
          doc.text(`${safeFormat(note.date, 'MMM d, yyyy')}: ${note.text}`, safeNumber(20), yPosition);
          yPosition += safeNumber(lineHeight);
          if (note.screenshot) {
            try {
              doc.addImage(note.screenshot, 'JPEG', safeNumber(20), yPosition, safeNumber(50), safeNumber(50));
              yPosition += safeNumber(60);
            } catch (e) {
              console.error('Error adding screenshot to PDF:', e);
              doc.text('(Screenshot could not be embedded)', safeNumber(20), yPosition);
              yPosition += safeNumber(lineHeight);
            }
          }
        });
        yPosition += safeNumber(lineHeight);
      }
    });

    doc.save('gaming-reports.pdf');
    toast.success('PDF exported successfully!');
  };

  const exportWeeklyReportTXT = () => {
    if (!weeklyReport) {
      toast.error('No weekly report to export!');
      return;
    }
    const reportText = `
Weekly Report for ${safeFormat(selectedWeek, 'MMM d, yyyy')} - ${safeFormat(endOfWeek(selectedWeek), 'MMM d, yyyy')}

Summary:
${weeklyReport.summary}

Highlights:
${weeklyReport.highlights.map(h => `- ${h}`).join('\n')}

Progress:
${weeklyReport.progress.map(p => `- ${p}`).join('\n')}

Insights:
${weeklyReport.insights.map(i => `- ${i}`).join('\n')}

Next Week Goals:
${weeklyReport.nextWeekGoals.map(g => `- ${g}`).join('\n')}

Screenshots: ${gamesThisWeek.reduce((total, game) => total + (Array.isArray(game.notes) ? game.notes.filter(n => n.screenshot).length : safeNumber(0)) + (Array.isArray(game.reportScreenshots) ? game.reportScreenshots.length : safeNumber(0)), safeNumber(0))} screenshots from notes and reports attached
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weekly-report-${safeFormat(selectedWeek, 'yyyy-MM-dd')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Weekly report TXT exported successfully!');
  };

  const exportWeeklyReportPDF = () => {
    if (!weeklyReport) {
      toast.error('No weekly report to export!');
      return;
    }
    const doc = new jsPDF();
    let yPosition = safeNumber(20);
    const lineHeight = safeNumber(10);
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(safeNumber(16));
    doc.text(`Weekly Report: ${safeFormat(selectedWeek, 'MMM d, yyyy')} - ${safeFormat(endOfWeek(selectedWeek), 'MMM d, yyyy')}`, safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight) * safeNumber(2);

    doc.setFontSize(safeNumber(12));
    doc.text('Summary:', safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    const summaryLines = doc.splitTextToSize(weeklyReport.summary, safeNumber(170));
    doc.text(summaryLines, safeNumber(20), yPosition);
    yPosition += summaryLines.length * safeNumber(lineHeight) + safeNumber(lineHeight);

    doc.text('Highlights:', safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    weeklyReport.highlights.forEach((highlight) => {
      if (yPosition + safeNumber(lineHeight) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text(`- ${highlight}`, safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
    });
    yPosition += safeNumber(lineHeight);

    doc.text('Progress:', safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    weeklyReport.progress.forEach((prog) => {
      if (yPosition + safeNumber(lineHeight) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text(`- ${prog}`, safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
    });
    yPosition += safeNumber(lineHeight);

    doc.text('Insights:', safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    weeklyReport.insights.forEach((insight) => {
      if (yPosition + safeNumber(lineHeight) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text(`- ${insight}`, safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
    });
    yPosition += safeNumber(lineHeight);

    doc.text('Next Week Goals:', safeNumber(20), yPosition);
    yPosition += safeNumber(lineHeight);
    weeklyReport.nextWeekGoals.forEach((goal) => {
      if (yPosition + safeNumber(lineHeight) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text(`- ${goal}`, safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
    });

    // Add screenshots from games this week
    const allScreenshots = gamesThisWeek.flatMap(game => [
      ...(Array.isArray(game.notes) ? game.notes.filter(n => n.screenshot).map(n => ({ src: n.screenshot, label: `${game.title} note` })) : []),
      ...(Array.isArray(game.reportScreenshots) ? game.reportScreenshots.map(s => ({ src: s, label: `${game.title} report` })) : [])
    ]);

    if (allScreenshots.length > safeNumber(0)) {
      if (yPosition + safeNumber(lineHeight) * safeNumber(2) > pageHeight) {
        doc.addPage();
        yPosition = safeNumber(20);
      }
      doc.text('Screenshots:', safeNumber(20), yPosition);
      yPosition += safeNumber(lineHeight);
      allScreenshots.forEach((screenshot, index) => {
        if (yPosition + safeNumber(60) > pageHeight) {
          doc.addPage();
          yPosition = safeNumber(20);
        }
        try {
          doc.addImage(screenshot.src, 'JPEG', safeNumber(20), yPosition, safeNumber(50), safeNumber(50));
          doc.text(screenshot.label, safeNumber(75), yPosition + safeNumber(25));
          yPosition += safeNumber(60);
        } catch (e) {
          console.error('Error adding screenshot to weekly PDF:', e);
          doc.text(`${screenshot.label}: Screenshot could not be embedded`, safeNumber(20), yPosition);
          yPosition += safeNumber(lineHeight);
        }
      });
    }

    doc.save(`weekly-report-${safeFormat(selectedWeek, 'yyyy-MM-dd')}.pdf`);
    toast.success('Weekly report PDF exported successfully!');
  };

  const handleGenerateWeeklyReport = async () => {
    setIsGeneratingWeeklyReport(true);
    try {
      const report = await generateWeeklyReport(gamesThisWeek, weekStart, weekEnd);
      setWeeklyReport(report);
      setEditedWeeklyReport(report);
      toast.success('AI Weekly Report generated successfully!');
    } catch (error) {
      console.error('Error generating weekly report:', error);
      toast.error('Failed to generate AI Weekly Report. Please try again.');
    } finally {
      setIsGeneratingWeeklyReport(false);
    }
  };

  const handleEditWeeklyReport = () => {
    setIsEditingWeeklyReport(true);
    setEditedWeeklyReport(weeklyReport);
  };

  const handleSaveWeeklyReport = () => {
    setWeeklyReport(editedWeeklyReport);
    setIsEditingWeeklyReport(false);
    toast.success('Weekly report updated successfully!');
  };

  const navigateWeek = (direction) => {
    if (direction === 'prev') {
      setSelectedWeek(prev => subWeeks(prev, safeNumber(1)));
    } else {
      setSelectedWeek(prev => addWeeks(prev, safeNumber(1)));
    }
    setWeeklyReport(null); // Reset report when changing week
    setEditedWeeklyReport(null);
  };

  const weeklyData = generateWeeklyData();
  const platformData = getPlatformData();
  const progressData = getProgressData();

  const totalGamesThisWeek = gamesThisWeek.length;
  const completedGamesThisWeek = gamesThisWeek.filter(game => game.status === 'completed').length;
  const playingGamesThisWeek = gamesThisWeek.filter(game => game.status === 'playing').length;
  const averageProgressThisWeek = (() => {
    const playingCount = safeNumber(playingGamesThisWeek.length);
    if (playingCount === safeNumber(0)) return safeNumber(0);
    
    const sum = (Array.isArray(playingGamesThisWeek) ? playingGamesThisWeek : []).reduce((acc, g) => {
      const p = safeNumber(g.progress);
      const safeP = (Number.isFinite(p) && !isNaN(p)) ? p : safeNumber(0);
      return safeNumber(acc) + safeP;
    }, safeNumber(0));
    
    const safeSum = (Number.isFinite(sum) && !isNaN(sum)) ? sum : safeNumber(0);
    const avg = safeDivision(safeSum, playingCount);
    const safeAvg = (Number.isFinite(avg) && !isNaN(avg)) ? avg : safeNumber(0);
    
    return Math.max(safeNumber(0), Math.min(safeNumber(100), Math.round(safeAvg * 100) / 100));
  })();

  const safeAverage = Number.isFinite(averageProgressThisWeek) && !isNaN(averageProgressThisWeek) ? averageProgressThisWeek : safeNumber(0);

  const milestonesCompleted = (Array.isArray(gamesThisWeek) ? gamesThisWeek : []).reduce((total, game) => {
    const milestoneCount = game.milestones?.filter(m => m.completed).length || safeNumber(0);
    const safeMilestoneCount = (Number.isFinite(milestoneCount) && !isNaN(milestoneCount)) ? milestoneCount : safeNumber(0);
    return safeNumber(total) + safeMilestoneCount;
  }, safeNumber(0));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2"
            >
              Gaming Reports
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: safeNumber(0.1) }}
              className="text-slate-600 dark:text-slate-400"
            >
              Analyze your gaming habits and track your progress over time.
            </motion.p>
          </div>
          <button
            onClick={exportPDF}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>

        {/* Week Navigation */}
        <div className="mb-8 flex items-center justify-center space-x-4">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            ←
          </button>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Week of {safeFormat(selectedWeek, 'MMM d, yyyy')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {safeFormat(selectedWeek, 'MMM d')} - {safeFormat(endOfWeek(selectedWeek), 'MMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            →
          </button>
        </div>

        {/* Generate Weekly Report Button */}
        <div className="mb-8 text-center">
          <button
            onClick={handleGenerateWeeklyReport}
            disabled={isGeneratingWeeklyReport}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-5 w-5" />
            <span>{isGeneratingWeeklyReport ? 'Generating...' : 'Generate AI Weekly Report'}</span>
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: safeNumber(0.2) }}
            className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center">
              <div className="p-3 bg-violet-100 dark:bg-violet-900/20 rounded-lg">
                <BarChart3 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Games This Week</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalGamesThisWeek}</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: safeNumber(0.3) }}
            className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Milestones Completed</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{milestonesCompleted}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Weekly Activity */}
          {weeklyData && weeklyData.length > 0 && weeklyData.some(item => item && typeof item.hours === 'number' && item.hours > 0) ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: safeNumber(0.6) }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-violet-600" />
                Weekly Activity
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData.filter(item => 
                  item && 
                  typeof item.hours === 'number' && 
                  Number.isFinite(item.hours) && 
                  !isNaN(item.hours) && 
                  item.hours >= 0 &&
                  typeof item.notes === 'number' && 
                  Number.isFinite(item.notes) && 
                  !isNaN(item.notes) && 
                  item.notes >= 0
                )}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: 'none', 
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                      formatter={(value, name) => {
                        if (name === 'hours') return [`${value}h`, 'Hours Played'];
                        if (name === 'notes') return [`${value}`, 'Notes Added'];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="hours" fill="#8b5cf6" radius={[safeNumber(4), safeNumber(4), safeNumber(0), safeNumber(0)]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center justify-center">
                <Calendar className="h-5 w-5 mr-2 text-violet-600" />
                Weekly Activity
              </h3>
              <p className="text-slate-500 dark:text-slate-400">No activity data for this week.</p>
            </div>
          )}

          {/* Platform Distribution */}
          {platformData && platformData.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: safeNumber(0.7) }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Platform Distribution This Week
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformData.filter(item => item.value > 0 && Number.isFinite(item.value) && !isNaN(item.value))}
                      cx="50%"
                      cy="50%"
                      outerRadius={safeNumber(80)}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {platformData.filter(item => item.value > 0 && Number.isFinite(item.value) && !isNaN(item.value)).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Platform Distribution This Week
              </h3>
              <p className="text-slate-500 dark:text-slate-400">No platform data for this week.</p>
            </div>
          )}
        </div>

        {/* Game Progress */}
        {progressData.length > safeNumber(0) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: safeNumber(0.8) }}
            className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Current Game Progress This Week
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData.filter(item => Number.isFinite(item.progress) && !isNaN(item.progress))} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[safeNumber(0), safeNumber(100)]} stroke="#64748b" />
                  <YAxis dataKey="name" type="category" width={safeNumber(120)} stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#f1f5f9'
                    }}
                    formatter={(value) => [`${value}%`, 'Progress']}
                  />
                  <Bar dataKey="progress" fill="#6366f1" radius={[safeNumber(0), safeNumber(4), safeNumber(4), safeNumber(0)]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* AI Weekly Report */}
        {weeklyReport && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: safeNumber(0.9) }}
            className="bg-gradient-to-r from-indigo-600 to-purple-500 rounded-xl p-6 text-white mt-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">AI Weekly Report</h3>
              <div className="flex space-x-2">
                <button
                  onClick={exportWeeklyReportTXT}
                  className="inline-flex items-center space-x-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export TXT</span>
                </button>
                <button
                  onClick={exportWeeklyReportPDF}
                  className="inline-flex items-center space-x-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export PDF</span>
                </button>
                {!isEditingWeeklyReport && (
                  <button
                    onClick={handleEditWeeklyReport}
                    className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                )}
                {isEditingWeeklyReport && (
                  <button
                    onClick={handleSaveWeeklyReport}
                    className="inline-flex items-center space-x-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Summary</h4>
                {isEditingWeeklyReport ? (
                  <textarea
                    value={editedWeeklyReport.summary}
                    onChange={(e) => setEditedWeeklyReport({ ...editedWeeklyReport, summary: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                ) : (
                  <p>{weeklyReport.summary}</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Highlights</h4>
                {isEditingWeeklyReport ? (
                  editedWeeklyReport.highlights.map((highlight, index) => (
                    <input
                      key={index}
                      value={highlight}
                      onChange={(e) => {
                        const newHighlights = [...editedWeeklyReport.highlights];
                        newHighlights[index] = e.target.value;
                        setEditedWeeklyReport({ ...editedWeeklyReport, highlights: newHighlights });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {weeklyReport.highlights.map((highlight, index) => (
                      <li key={index}>{highlight}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Progress</h4>
                {isEditingWeeklyReport ? (
                  editedWeeklyReport.progress.map((prog, index) => (
                    <input
                      key={index}
                      value={prog}
                      onChange={(e) => {
                        const newProgress = [...editedWeeklyReport.progress];
                        newProgress[index] = e.target.value;
                        setEditedWeeklyReport({ ...editedWeeklyReport, progress: newProgress });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {weeklyReport.progress.map((prog, index) => (
                      <li key={index}>{prog}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Insights</h4>
                {isEditingWeeklyReport ? (
                  editedWeeklyReport.insights.map((insight, index) => (
                    <input
                      key={index}
                      value={insight}
                      onChange={(e) => {
                        const newInsights = [...editedWeeklyReport.insights];
                        newInsights[index] = e.target.value;
                        setEditedWeeklyReport({ ...editedWeeklyReport, insights: newInsights });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {weeklyReport.insights.map((insight, index) => (
                      <li key={index}>{insight}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Next Week Goals</h4>
                {isEditingWeeklyReport ? (
                  editedWeeklyReport.nextWeekGoals.map((goal, index) => (
                    <input
                      key={index}
                      value={goal}
                      onChange={(e) => {
                        const newGoals = [...editedWeeklyReport.nextWeekGoals];
                        newGoals[index] = e.target.value;
                        setEditedWeeklyReport({ ...editedWeeklyReport, nextWeekGoals: newGoals });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {weeklyReport.nextWeekGoals.map((goal, index) => (
                      <li key={index}>{goal}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Weekly Summary */}
      </main>

      <Footer />
    </div>
  );
};

export default Reports;