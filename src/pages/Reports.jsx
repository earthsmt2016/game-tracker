import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Trophy, Clock, BarChart3, Download, FileText, Edit, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, addWeeks, isWithinInterval } from 'date-fns';
import Header from '../components/Header';
import Footer from '../components/Footer';
import jsPDF from 'jspdf';
import { generateWeeklyReport } from '../utils/openaiService';
import { toast } from 'react-toastify';
import { safeNumber, safeDivision } from '../utils/helpers';

// --- Normalizers to keep React children safe --- //
const toStringArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map(item =>
      typeof item === 'string'
        ? item
        : (item && typeof item === 'object' ? JSON.stringify(item) : String(item))
    );
  }
  return [String(v)];
};

const normalizeWeeklyReport = (raw) => {
  const r = raw || {};
  // Support APIs that use either `progress` or `nextSteps`
  const progress = r.progress ?? r.nextSteps ?? [];
  return {
    summary:
      typeof r.summary === 'string'
        ? r.summary
        : JSON.stringify(r.summary ?? ''),
    highlights: toStringArray(r.highlights),
    progress: toStringArray(progress),
    insights: toStringArray(r.insights),
    nextWeekGoals: toStringArray(r.nextWeekGoals),
    categoryAnalysis: r.categoryAnalysis ?? {},
    difficultyAnalysis: r.difficultyAnalysis ?? {},
    recommendedFocus: toStringArray(r.recommendedFocus),
  };
};

const Reports = () => {
  const [games, setGames] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [weeklyReport, setWeeklyReport] = useState({
    summary: '',
    highlights: [],
    progress: [],
    insights: [],
    nextWeekGoals: [],
    categoryAnalysis: {},
    difficultyAnalysis: {},
    recommendedFocus: []
  });
  const [isGeneratingWeeklyReport, setIsGeneratingWeeklyReport] = useState(false);
  const [isEditingWeeklyReport, setIsEditingWeeklyReport] = useState(false);
  const [editedWeeklyReport, setEditedWeeklyReport] = useState(null);
  const [hiddenSections, setHiddenSections] = useState({
    gamesThisWeek: false,
    completedGames: false,
    weeklyActivity: false,
    platformDistribution: false
  });

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

  // Filter games for the selected week based on notes
  const weekStart = selectedWeek;
  const weekEnd = endOfWeek(selectedWeek);
  const gamesThisWeek = Array.isArray(games) ? games.filter(game => {
    if (!Array.isArray(game.notes) || game.notes.length === 0) return false;
    
    // Check if any notes were created during this week ...
    return game.notes.some(note => {
      try {
        const noteDate = new Date(note.date);
        if (isNaN(noteDate.getTime())) return false;
        return isWithinInterval(noteDate, { start: weekStart, end: weekEnd });
      } catch {
        return false;
      }
    });
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
    try {
      if (!Array.isArray(gamesThisWeek) || gamesThisWeek.length === 0) {
        return [];
      }

      const platformCounts = gamesThisWeek.reduce((acc, game) => {
        if (game && typeof game === 'object' && typeof game.platform === 'string' && game.platform.trim()) {
          acc[game.platform] = (acc[game.platform] || safeNumber(0)) + safeNumber(1);
        }
        return acc;
      }, {});

      const colors = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

      return Object.entries(platformCounts).map(([platform, count], index) => {
        const safeCount = safeNumber(count);
        const finalCount = (Number.isFinite(safeCount) && !isNaN(safeCount) && safeCount > 0) ? safeCount : safeNumber(1);
        return {
          name: platform || 'Unknown',
          value: finalCount,
          color: colors[index % colors.length]
        };
      }).filter(item => item.value > 0);
    } catch (error) {
      console.error('Error generating platform data:', error);
      return [];
    }
  };

  // Progress data for this week
  const getProgressData = () => {
    try {
      if (!Array.isArray(gamesThisWeek) || gamesThisWeek.length === 0) {
        return [];
      }

      return gamesThisWeek
        .filter(game => {
          return game && 
                 typeof game === 'object' && 
                 game.status === 'playing' && 
                 typeof game.title === 'string' && 
                 game.title.trim() && 
                 typeof game.progress === 'number' && 
                 Number.isFinite(game.progress) && 
                 !isNaN(game.progress);
        })
        .map(game => {
          const safeTitle = game.title || 'Untitled Game';
          const truncatedTitle = (safeTitle.length > safeNumber(15)) ? 
            safeTitle.substring(safeNumber(0), safeNumber(15)) + '...' : safeTitle;
          
          const p = safeNumber(game.progress);
          const safeProgress = (Number.isFinite(p) && !isNaN(p)) ? 
            Math.max(safeNumber(0), Math.min(safeNumber(100), safeNumber(p))) : safeNumber(0);
          
          return {
            name: truncatedTitle,
            progress: safeProgress
          };
        })
        .sort((a, b) => {
          const aProgress = safeNumber(a.progress) || safeNumber(0);
          const bProgress = safeNumber(b.progress) || safeNumber(0);
          return bProgress - aProgress;
        });
    } catch (error) {
      console.error('Error generating progress data:', error);
      return [];
    }
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
    // Initialize PDF with better defaults
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    try {
      
      // Set margins and spacing
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 15; // 15mm margin
      const rightMargin = 15; // 15mm margin
      const topMargin = 20; // 20mm from top
      const bottomMargin = 20; // 20mm from bottom
      const maxWidth = pageWidth - leftMargin - rightMargin;
      let yPosition = topMargin;
      const lineHeight = 5; // Base line height in mm
      const sectionSpacing = 8; // Space between sections
      const paragraphSpacing = 4; // Space between paragraphs
    
    // Helper function to add text with wrapping and page breaks
    const addTextWithWrapping = (text, y, options = {}) => {
      const { 
        x = leftMargin, 
        maxY = pageHeight - bottomMargin,
        lineHeight: customLineHeight = lineHeight,
        maxWidth: customMaxWidth = maxWidth,
        align = 'left',
        style = 'normal',
        bulletPoint = false
      } = options;
      
      // Set font style
      const currentFont = doc.getFont();
      doc.setFont(currentFont.fontName, style);
      
      // Ensure text is a string and trim whitespace
      const textStr = String(text || '').trim();
      if (!textStr) return y;
      
      // Add bullet point if needed
      const displayText = bulletPoint && !textStr.startsWith('•') ? `• ${textStr}` : textStr;
      
      // Split text into lines that fit within maxWidth
      const splitText = doc.splitTextToSize(displayText, customMaxWidth - (bulletPoint ? 5 : 0));
      
      for (let i = 0; i < splitText.length; i++) {
        // Check if we need a new page
        if (y + customLineHeight > maxY) {
          doc.addPage();
          y = topMargin;
        }
        
        // Calculate x position based on alignment and bullet point
        let textX = x;
        if (bulletPoint && i === 0) {
          textX = x + 5; // Indent bullet points
        }
        
        // Add text with specified alignment
        if (align === 'center') {
          const textWidth = doc.getTextWidth(splitText[i]);
          textX = (pageWidth - textWidth) / 2;
        } else if (align === 'right') {
          const textWidth = doc.getTextWidth(splitText[i]);
          textX = pageWidth - rightMargin - textWidth;
        }
        
        // Ensure text doesn't go off the page
        const textWidth = doc.getTextWidth(splitText[i]);
        if (textX + textWidth > pageWidth - rightMargin) {
          textX = pageWidth - rightMargin - textWidth - 1;
        }
        
        // Draw the text
        doc.text(splitText[i], textX, y);
        y += customLineHeight;
      }
      
      return y;
    };

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    yPosition = addTextWithWrapping('GAMING REPORTS SUMMARY', yPosition, {
      align: 'center',
      lineHeight: lineHeight * 1.5,
      maxWidth: maxWidth,
      style: 'bold'
    });
    
    // Add a horizontal line under the title
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    yPosition += 2;
    doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition);
    yPosition += sectionSpacing;
    
    // Date range
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const dateRange = `${format(weekStart, 'MMM d, yyyy')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    yPosition = addTextWithWrapping(dateRange, yPosition, {
      align: 'center',
      lineHeight: lineHeight * 1.2,
      maxWidth: maxWidth,
      style: 'normal'
    });
    
    yPosition += sectionSpacing;

    const weeklyData = generateWeeklyData() || [];
    const gamesThisWeekLocal = gamesThisWeek || [];
    const playingGamesThisWeek = gamesThisWeekLocal.filter(g => g.status === 'playing');
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

    // Stats section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    yPosition = addTextWithWrapping('Summary Statistics', yPosition + sectionSpacing, {
      lineHeight: lineHeight * 1.3,
      maxWidth: maxWidth,
      style: 'bold'
    });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Calculate column widths
    const col1Width = maxWidth * 0.5;
    const col2Width = maxWidth * 0.5;
    
    const addStatLine = (label, value, y) => {
      y = addTextWithWrapping(label, y, {
        maxWidth: col1Width,
        lineHeight: lineHeight
      });
      
      return addTextWithWrapping(value, y, {
        x: leftMargin + col1Width,
        maxWidth: col2Width,
        lineHeight: lineHeight
      });
    };
    
    // Add stats in two columns
    let currentY = yPosition;
    currentY = addStatLine('• Total Games:', gamesThisWeekLocal.length.toString(), currentY);
    currentY = addStatLine('• Completed:', gamesThisWeekLocal.filter(g => g.status === 'completed').length.toString(), currentY);
    currentY = addStatLine('• In Progress:', gamesThisWeekLocal.filter(g => g.status === 'playing').length.toString(), currentY);
    currentY = addStatLine('• Avg Progress:', 
      `${(Number.isFinite(averageProgressThisWeek) && !isNaN(averageProgressThisWeek) ? averageProgressThisWeek : 0).toFixed(1)}%`,
      currentY
    );
    
    yPosition = currentY + sectionSpacing;

    if (weeklyReport?.summary) {
      // Add section header with more space
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      yPosition = addTextWithWrapping('WEEKLY SUMMARY', yPosition + sectionSpacing, {
        lineHeight: lineHeight * 1.3,
        maxWidth: maxWidth,
        style: 'bold'
      });
      
      // Add summary with proper wrapping
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      yPosition = addTextWithWrapping(weeklyReport.summary, yPosition, {
        lineHeight: lineHeight * 1.1,
        maxWidth: maxWidth
      });
      yPosition += sectionSpacing;

      // Add highlights section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      yPosition = addTextWithWrapping('HIGHLIGHTS', yPosition + sectionSpacing, {
        lineHeight: lineHeight * 1.3,
        maxWidth: maxWidth,
        style: 'bold'
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      (weeklyReport.highlights || []).forEach((highlight) => {
        yPosition = addTextWithWrapping(highlight, yPosition, {
          lineHeight: lineHeight * 1.1,
          maxWidth: maxWidth - 10,
          x: leftMargin + 5,
          bulletPoint: true
        });
      });
      yPosition += sectionSpacing;

      // Add progress section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      yPosition = addTextWithWrapping('PROGRESS', yPosition + sectionSpacing, {
        lineHeight: lineHeight * 1.3,
        maxWidth: maxWidth,
        style: 'bold'
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      (weeklyReport.progress || []).forEach((prog) => {
        yPosition = addTextWithWrapping(prog, yPosition, {
          lineHeight: lineHeight * 1.1,
          maxWidth: maxWidth - 10,
          x: leftMargin + 5,
          bulletPoint: true
        });
      });
      yPosition += sectionSpacing;

      // Add insights section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      yPosition = addTextWithWrapping('INSIGHTS', yPosition + sectionSpacing, {
        lineHeight: lineHeight * 1.3,
        maxWidth: maxWidth,
        style: 'bold'
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      (weeklyReport.insights || []).forEach((insight) => {
        yPosition = addTextWithWrapping(insight, yPosition, {
          lineHeight: lineHeight * 1.1,
          maxWidth: maxWidth - 10,
          x: leftMargin + 5,
          bulletPoint: true
        });
      });
      yPosition += sectionSpacing;
      
      // Next week goals section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      yPosition = addTextWithWrapping('NEXT WEEK GOALS', yPosition + sectionSpacing, {
        lineHeight: lineHeight * 1.3,
        maxWidth: maxWidth,
        style: 'bold'
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      (weeklyReport.nextWeekGoals || []).forEach((goal) => {
        yPosition = addTextWithWrapping(goal, yPosition, {
          lineHeight: lineHeight * 1.1,
          maxWidth: maxWidth - 5,
          x: leftMargin + 5
        });
      });
      yPosition += sectionSpacing / 2;
      yPosition += safeNumber(lineHeight);

      // Add next week goals section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      yPosition = addTextWithWrapping('NEXT WEEK GOALS', yPosition + sectionSpacing, {
        lineHeight: lineHeight * 1.3,
        maxWidth: maxWidth,
        style: 'bold'
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      (weeklyReport.nextWeekGoals || []).forEach((goal) => {
        yPosition = addTextWithWrapping(`• ${goal}`, yPosition, {
          lineHeight: lineHeight * 1.1,
          maxWidth: maxWidth - 10,
          x: leftMargin + 5,
          bulletPoint: true
        });
      });
      yPosition += sectionSpacing;
    }

    // Add notes and screenshots from games this week
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    yPosition = addTextWithWrapping('GAME NOTES', yPosition + sectionSpacing, {
      lineHeight: lineHeight * 1.3,
      maxWidth: maxWidth,
      style: 'bold'
    });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    gamesThisWeekLocal.forEach(game => {
      if (game.notes && game.notes.length > 0) {
        // Add game title
        yPosition = addTextWithWrapping(`${game.title}:`, yPosition + lineHeight, {
          lineHeight: lineHeight * 1.2,
          style: 'bold'
        });
        
        // Add notes
        game.notes.forEach((note) => {
          const noteText = `${safeFormat(note.date, 'MMM d, yyyy')}: ${note.text}`;
          yPosition = addTextWithWrapping(noteText, yPosition, {
            lineHeight: lineHeight * 1.1,
            bulletPoint: true,
            x: leftMargin + 5
          });
          
          // Add screenshot if available
          if (note.screenshot) {
            try {
              const imageHeight = 40; // Fixed height for all images
              const imageWidth = 80; // Fixed width for all images
              
              // Check if we need a new page for the image
              if (yPosition + imageHeight > pageHeight - bottomMargin) {
                doc.addPage();
                yPosition = topMargin;
              }
              
              doc.addImage(note.screenshot, 'JPEG', leftMargin, yPosition, imageWidth, imageHeight);
              yPosition += imageHeight + lineHeight;
            } catch (e) {
              console.error('Error adding screenshot to PDF:', e);
              yPosition = addTextWithWrapping('(Screenshot could not be embedded)', yPosition, {
                lineHeight: lineHeight,
                style: 'italic'
              });
            }
          }
        });
        yPosition += lineHeight;
      }
    });

      // Save the PDF
      doc.save('gaming-report.pdf');
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('An error occurred while generating the PDF.');
    }
  };

  const exportWeeklyReportTXT = () => {
    if (!weeklyReport || !weeklyReport.summary) {
      toast.error('No weekly report to export!');
      return;
    }
    const reportText = `
Weekly Report for ${safeFormat(selectedWeek, 'MMM d, yyyy')} - ${safeFormat(endOfWeek(selectedWeek), 'MMM d, yyyy')}

Summary:
${weeklyReport.summary}

Highlights:
${(weeklyReport.highlights || []).map(h => `- ${h}`).join('\n')}

Progress:
${(weeklyReport.progress || []).map(p => `- ${p}`).join('\n')}

Insights:
${(weeklyReport.insights || []).map(i => `- ${i}`).join('\n')}

Next Week Goals:
${(weeklyReport.nextWeekGoals || []).map(g => `- ${g}`).join('\n')}

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
    if (!weeklyReport || !weeklyReport.summary) {
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
    (weeklyReport.highlights || []).forEach((highlight) => {
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
    (weeklyReport.progress || []).forEach((prog) => {
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
    (weeklyReport.insights || []).forEach((insight) => {
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
    (weeklyReport.nextWeekGoals || []).forEach((goal) => {
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
      allScreenshots.forEach((screenshot) => {
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
    console.log('[DEBUG] Starting weekly report generation...');
    console.log('[DEBUG] Games this week:', gamesThisWeek);
    console.log('[DEBUG] Week start:', weekStart);
    console.log('[DEBUG] Week end:', weekEnd);
    
    if (!gamesThisWeek || gamesThisWeek.length === 0) {
      const errorMsg = 'No games found for the selected week';
      console.error('[DEBUG]', errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsGeneratingWeeklyReport(true);
    
    try {
      console.log('[DEBUG] Calling generateWeeklyReport...');
      const raw = await generateWeeklyReport(gamesThisWeek, weekStart, weekEnd);
      if (!raw) {
        throw new Error('Received empty report from API');
      }

      const report = normalizeWeeklyReport(raw);
      console.log('[DEBUG] Report generated successfully (normalized):', report);

      // Optional: sanity check
      const requiredFields = ['summary', 'highlights', 'progress', 'insights', 'nextWeekGoals'];
      const missing = requiredFields.filter(
        k => report[k] == null || (Array.isArray(report[k]) && report[k].length === 0)
      );
      if (missing.length > 0) {
        console.warn('[DEBUG] Report missing or empty fields:', missing);
      }
      
      setWeeklyReport(report);
      setEditedWeeklyReport(report);
      toast.success('AI Weekly Report generated successfully!');
      
    } catch (error) {
      console.error('[DEBUG] Error generating weekly report:', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      
      toast.error(`Failed to generate report: ${error.message || 'Unknown error'}`);
      
      // Provide fallback report (already normalized)
      const fallbackReport = normalizeWeeklyReport({
        summary: 'Weekly report generation failed. Using fallback data.',
        highlights: ['Check console for detailed error logs'],
        progress: ['Could not generate progress data'],
        insights: ['Error occurred during report generation'],
        nextWeekGoals: ['Try generating the report again']
      });
      
      setWeeklyReport(fallbackReport);
      setEditedWeeklyReport(fallbackReport);
      
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
    setWeeklyReport({ summary: '', highlights: [], progress: [], insights: [], nextWeekGoals: [], categoryAnalysis: {}, difficultyAnalysis: {}, recommendedFocus: [] });
    setEditedWeeklyReport(null);
  };

  const toggleSection = (sectionKey) => {
    setHiddenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const exportBackup = () => {
    try {
      const backupData = {
        games: JSON.parse(localStorage.getItem('gameTracker_games') || '[]'),
        weeklyReports: JSON.parse(localStorage.getItem('gameTracker_weeklyReports') || '{}'),
        gameReports: JSON.parse(localStorage.getItem('gameTracker_gameReports') || '{}'),
        settings: JSON.parse(localStorage.getItem('gameTracker_settings') || '{}'),
        hiddenSections: JSON.parse(localStorage.getItem('gameTracker_hiddenSections') || '{}'),
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `gametracker-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Backup exported successfully!');
    } catch (error) {
      console.error('Error exporting backup:', error);
      toast.error('Failed to export backup. Please try again.');
    }
  };

  const importBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        // Validate backup structure
        if (!backupData.version || !backupData.exportDate) {
          throw new Error('Invalid backup file format');
        }

        // Restore data to localStorage
        if (backupData.games) {
          localStorage.setItem('gameTracker_games', JSON.stringify(backupData.games));
        }
        if (backupData.weeklyReports) {
          localStorage.setItem('gameTracker_weeklyReports', JSON.stringify(backupData.weeklyReports));
        }
        if (backupData.gameReports) {
          localStorage.setItem('gameTracker_gameReports', JSON.stringify(backupData.gameReports));
        }
        if (backupData.settings) {
          localStorage.setItem('gameTracker_settings', JSON.stringify(backupData.settings));
        }
        if (backupData.hiddenSections) {
          localStorage.setItem('gameTracker_hiddenSections', JSON.stringify(backupData.hiddenSections));
        }

        // Refresh the page to load new data
        toast.success(`Backup imported successfully! Exported on ${format(new Date(backupData.exportDate), 'MMM d, yyyy HH:mm')}`);
        setTimeout(() => window.location.reload(), 1500);
        
      } catch (error) {
        console.error('Error importing backup:', error);
        toast.error('Failed to import backup. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const weeklyData = generateWeeklyData() || [];
  const platformData = getPlatformData() || [];
  const progressData = getProgressData() || [];

  const totalGamesThisWeek = safeNumber(gamesThisWeek.length) || safeNumber(0);
  const completedGamesThisWeek = safeNumber(gamesThisWeek.filter(game => game.status === 'completed').length) || safeNumber(0);
  const playingGamesThisWeek = gamesThisWeek.filter(game => game.status === 'playing');
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

  const milestonesCompleted = (() => {
    try {
      return (Array.isArray(gamesThisWeek) ? gamesThisWeek : []).reduce((total, game) => {
        if (!game || typeof game !== 'object') return safeNumber(total);
        const milestoneCount = Array.isArray(game.milestones) ? game.milestones.filter(m => m && m.completed).length : safeNumber(0);
        const safeMilestoneCount = (Number.isFinite(milestoneCount) && !isNaN(milestoneCount)) ? milestoneCount : safeNumber(0);
        return safeNumber(total) + safeMilestoneCount;
      }, safeNumber(0));
    } catch (error) {
      console.error('Error calculating milestones completed:', error);
      return safeNumber(0);
    }
  })();

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
              Analyze my gaming habits and track my progress over time.
            </motion.p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportBackup}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Download className="h-4 w-4" />
              <span>Export Backup</span>
            </button>
            
            <label className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={importBackup}
                className="hidden"
              />
              <FileText className="h-4 w-4" />
              <span>Import Backup</span>
            </label>
            
            <button
              onClick={exportPDF}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          </div>
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
          {!hiddenSections.gamesThisWeek && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: safeNumber(0.2) }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative"
            >
              <button
                onClick={() => toggleSection('gamesThisWeek')}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
              <div className="flex items-center">
                <div className="p-3 bg-violet-100 dark:bg-violet-900/20 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-violet-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Games This Week</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalGamesThisWeek}</p>
                </div>
              </div>
            </motion.div>
          )}

          {!hiddenSections.completedGames && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: safeNumber(0.3) }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative"
            >
              <button
                onClick={() => toggleSection('completedGames')}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
              <div className="flex items-center">
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Games Completed This Week</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{completedGamesThisWeek}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Weekly Activity */}
          {!hiddenSections.weeklyActivity && weeklyData && weeklyData.length > 0 && weeklyData.some(item => item && typeof item.hours === 'number' && item.hours > 0) ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: safeNumber(0.6) }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative"
            >
              <button
                onClick={() => toggleSection('weeklyActivity')}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-violet-600" />
                Weekly Activity
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    const filteredData = weeklyData.filter(item => 
                      item && 
                      typeof item.hours === 'number' && 
                      Number.isFinite(item.hours) && 
                      !isNaN(item.hours) && 
                      item.hours >= 0 &&
                      typeof item.notes === 'number' && 
                      Number.isFinite(item.notes) && 
                      !isNaN(item.notes) && 
                      item.notes >= 0
                    );
                    return filteredData.length === 0 ? 
                      [{day: 'Mon', hours: 0, notes: 0}, {day: 'Tue', hours: 0, notes: 0}, {day: 'Wed', hours: 0, notes: 0}, {day: 'Thu', hours: 0, notes: 0}, {day: 'Fri', hours: 0, notes: 0}, {day: 'Sat', hours: 0, notes: 0}, {day: 'Sun', hours: 0, notes: 0}] : 
                      filteredData;
                  })()}>
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
          {!hiddenSections.platformDistribution && platformData && platformData.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: safeNumber(0.7) }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative"
            >
              <button
                onClick={() => toggleSection('platformDistribution')}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
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


        {/* AI Weekly Report */}
        {(weeklyReport?.summary ?? '').trim() && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: safeNumber(0.9) }}
            className="bg-gradient-to-r from-indigo-600 to-purple-500 rounded-xl p-6 mt-8 text-slate-100 overflow-hidden"
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
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-400/30 scrollbar-track-transparent">
              <div>
                <h4 className="font-semibold mb-2">Summary</h4>
                {isEditingWeeklyReport ? (
                  <textarea
                    value={editedWeeklyReport?.summary ?? ''}
                    onChange={(e) => setEditedWeeklyReport({ ...(editedWeeklyReport ?? {}), summary: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words text-slate-100/90 leading-relaxed">{weeklyReport.summary}</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Highlights</h4>
                {isEditingWeeklyReport ? (
                  (editedWeeklyReport?.highlights ?? []).map((highlight, index) => (
                    <input
                      key={index}
                      value={highlight}
                      onChange={(e) => {
                        const list = [...(editedWeeklyReport?.highlights ?? [])];
                        list[index] = e.target.value;
                        setEditedWeeklyReport({ ...(editedWeeklyReport ?? {}), highlights: list });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-3">
                    {(weeklyReport.highlights ?? []).map((highlight, index) => (
                      <li key={index} className="break-words text-slate-100/90 leading-relaxed">{highlight}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Progress</h4>
                {isEditingWeeklyReport ? (
                  (editedWeeklyReport?.progress ?? []).map((prog, index) => (
                    <input
                      key={index}
                      value={prog}
                      onChange={(e) => {
                        const list = [...(editedWeeklyReport?.progress ?? [])];
                        list[index] = e.target.value;
                        setEditedWeeklyReport({ ...(editedWeeklyReport ?? {}), progress: list });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-3">
                    {(weeklyReport.progress ?? []).map((prog, index) => (
                      <li key={index} className="break-words text-slate-100/90 leading-relaxed">{prog}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Insights</h4>
                {isEditingWeeklyReport ? (
                  (editedWeeklyReport?.insights ?? []).map((insight, index) => (
                    <input
                      key={index}
                      value={insight}
                      onChange={(e) => {
                        const list = [...(editedWeeklyReport?.insights ?? [])];
                        list[index] = e.target.value;
                        setEditedWeeklyReport({ ...(editedWeeklyReport ?? {}), insights: list });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-3">
                    {(weeklyReport.insights ?? []).map((insight, index) => (
                      <li key={index} className="break-words text-slate-100/90 leading-relaxed">{insight}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Next Week Goals</h4>
                {isEditingWeeklyReport ? (
                  (editedWeeklyReport?.nextWeekGoals ?? []).map((goal, index) => (
                    <input
                      key={index}
                      value={goal}
                      onChange={(e) => {
                        const list = [...(editedWeeklyReport?.nextWeekGoals ?? [])];
                        list[index] = e.target.value;
                        setEditedWeeklyReport({ ...(editedWeeklyReport ?? {}), nextWeekGoals: list });
                      }}
                      className="w-full px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-3">
                    {(weeklyReport.nextWeekGoals ?? []).map((goal, index) => (
                      <li key={index} className="break-words text-slate-100/90 leading-relaxed">{goal}</li>
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
