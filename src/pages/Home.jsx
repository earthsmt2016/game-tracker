import React, { useState, useEffect } from 'react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import GameCard from '../components/GameCard.jsx';
import AddGameModal from '../components/AddGameModal.jsx';
import GameDetailModal from '../components/GameDetailModal.jsx';
import { safeNumber, safeDivision } from '../utils/helpers';

const Home = () => {
  const [games, setGames] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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

  // New useEffect to sync selectedGame with updated games array
  useEffect(() => {
    if (isDetailModalOpen && selectedGame) {
      const updatedGame = games.find(g => g.id === selectedGame.id);
      if (updatedGame) {
        setSelectedGame(updatedGame);
      }
    }
  }, [games, isDetailModalOpen, selectedGame]);

  const saveGamesToLocalStorage = (updatedGames) => {
    try {
      localStorage.setItem('gameTracker_games', JSON.stringify(updatedGames));
    } catch (error) {
      console.error('Error saving games to localStorage:', error);
    }
  };

  // Fix: Calculate average progress instead of sum
  const totalScore = (Array.isArray(games) && games.length > safeNumber(0)) ? safeDivision(games.reduce((acc, game) => {
    const p = Number(game.progress);
    return acc + ((Number.isFinite(p) && !isNaN(p)) ? safeNumber(p) : safeNumber(0));
  }, safeNumber(0)), games.length) : safeNumber(0);

  const safeTotalScore = Number.isFinite(totalScore) && !isNaN(totalScore) ? Math.max(safeNumber(0), Math.min(safeNumber(100), Math.round(safeNumber(totalScore) * 100) / 100)) : safeNumber(0);

  const handleAddGame = (newGame) => {
    const updatedGames = [...games, newGame];
    setGames(updatedGames);
    saveGamesToLocalStorage(updatedGames);
    setIsModalOpen(false);
  };

  const handleStatusChange = (gameId, newStatus) => {
    const updatedGames = games.map(game =>
      game.id === gameId
        ? { ...game, status: newStatus, lastPlayed: new Date().toISOString() } // Removed progress override to preserve milestone-based percentage
        : game
    );
    setGames(updatedGames);
    saveGamesToLocalStorage(updatedGames);
  };

  const handleViewDetails = (game) => {
    setSelectedGame(game);
    setIsDetailModalOpen(true);
  };

  const handleDeleteGame = (gameId) => {
    const updatedGames = games.filter(game => game.id !== gameId);
    setGames(updatedGames);
    saveGamesToLocalStorage(updatedGames);
  };

  const handleUpdateProgress = (gameId, progress, milestones) => {
    const updatedGames = games.map(game =>
      game.id === gameId
        ? { ...game, progress, milestones, lastPlayed: new Date().toISOString() }
        : game
    );
    setGames(updatedGames);
    saveGamesToLocalStorage(updatedGames);
  };

  const handleUpdateNotes = (gameId, notes, report, reportScreenshots) => {
    const updatedGames = games.map(game =>
      game.id === gameId
        ? { ...game, notes, report, reportScreenshots, lastPlayed: new Date().toISOString() }
        : game
    );
    setGames(updatedGames);
    saveGamesToLocalStorage(updatedGames);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Game Tracker</h1>
            <p className="text-slate-600 dark:text-slate-400">Track your gaming progress and achievements.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <span>Add Game</span>
          </button>
        </div>

        <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Average Progress</h2>
          <p className="text-2xl font-bold text-violet-600">{safeTotalScore}%</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onStatusChange={handleStatusChange}
              onViewDetails={handleViewDetails}
              onDeleteGame={handleDeleteGame}
            />
          ))}
        </div>

        {games.length === safeNumber(0) && (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">No games added yet. Click "Add Game" to get started!</p>
          </div>
        )}
      </main>

      <AddGameModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddGame={handleAddGame}
      />

      <GameDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        game={selectedGame}
        onUpdateProgress={handleUpdateProgress}
        onUpdateNotes={handleUpdateNotes}
        onStatusChange={handleStatusChange}
      />

      <Footer />
    </div>
  );
};

export default Home;