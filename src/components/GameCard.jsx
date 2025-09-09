import React from 'react';
import { Calendar, Trophy, Play, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { safeNumber } from '../utils/helpers';

function GameCard({ game, onStatusChange, onViewDetails, onDeleteGame }) {
  const safeProgress = Number.isFinite(game.progress) && !isNaN(game.progress) ? Math.max(safeNumber(0), Math.min(safeNumber(100), Math.round(safeNumber(game.progress) * 100) / 100)) : safeNumber(0);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'playing':
        return <Play className="h-4 w-4 text-blue-400" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'playing':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-video bg-gradient-to-br from-violet-600 to-indigo-500 relative overflow-hidden">
        <img
          src={game.image || `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=225&fit=crop&crop=center`}
          alt={game.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(game.status)}`}>
            {getStatusIcon(game.status)}
            <span className="capitalize">{game.status}</span>
          </span>
        </div>
        <div className="absolute top-3 left-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGame(game.id);
            }}
            className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
            title="Delete Game"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
            {game.title}
          </h3>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium mr-2">Platform:</span>
            <span>{game.platform}</span>
          </div>
          
          {game.lastPlayed && (
            <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="h-4 w-4 mr-2" />
              <span>Last played: {safeFormat(game.lastPlayed, 'MMM d, yyyy')}</span>
            </div>
          )}

          {game.progress !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Progress</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{safeProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${safeProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => onViewDetails(game)}
            className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 text-sm font-medium transition-colors"
          >
            View Details
          </button>
          
          <div className="flex items-center space-x-2">
            {game.status === 'playing' && (
              <button
                onClick={() => onStatusChange(game.id, 'completed')}
                className="inline-flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Trophy className="h-3 w-3" />
                <span>Complete</span>
              </button>
            )}
            
            {game.status === 'completed' && (
              <button
                onClick={() => onStatusChange(game.id, 'playing')}
                className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Play className="h-3 w-3" />
                <span>Resume</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GameCard;