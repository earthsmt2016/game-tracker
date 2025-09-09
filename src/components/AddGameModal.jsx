import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { generateMilestones } from '../utils/openaiService';

const gameSchema = z.object({
  title: z.string().min(1, 'Game title is required'),
  platform: z.string().min(1, 'Platform is required'),
  status: z.enum(['playing', 'completed']),
  image: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

const AddGameModal = ({ isOpen, onClose, onAddGame }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(gameSchema),
    defaultValues: {
      status: 'playing'
    }
  });

  const onSubmit = async (data) => {
    try {
      const milestones = await generateMilestones(data.title);
      
      // If status is completed, mark all milestones as completed
      const updatedMilestones = data.status === 'completed' 
        ? milestones.map(m => ({ ...m, completed: true }))
        : milestones;
      
      const newGame = {
        id: Date.now().toString(),
        ...data,
        progress: data.status === 'completed' ? 100 : 0, // Keep as 100 for completed, but milestones will reflect
        lastPlayed: new Date().toISOString(),
        milestones: updatedMilestones,
        notes: data.notes ? [{ text: data.notes, date: new Date().toISOString(), screenshot: null }] : []
      };
      
      onAddGame(newGame);
      reset();
      onClose();
    } catch (error) {
      console.error('Error adding game:', error);
      // You could show a toast error here if desired
    }
  };

  const platforms = [
    'PC', 'PlayStation 5', 'PlayStation 4', 'PlayStation 2', 'Xbox Series X/S', 
    'Xbox One', 'Nintendo Switch', '3DS', 'Wii', 'Mobile', 'Steam Deck'
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
            >
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-slate-100 mb-4">
                    Add New Game
                  </h3>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Game Title
                      </label>
                      <input
                        type="text"
                        id="title"
                        {...register('title')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                        placeholder="Enter game title"
                      />
                      {errors.title && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="platform" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Platform
                      </label>
                      <select
                        id="platform"
                        {...register('platform')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                      >
                        <option value="">Select platform</option>
                        {platforms.map((platform) => (
                          <option key={platform} value={platform}>
                            {platform}
                          </option>
                        ))}
                      </select>
                      {errors.platform && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.platform.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        id="status"
                        {...register('status')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                      >
                        <option value="playing">Currently Playing</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="image" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        id="image"
                        {...register('image')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                        placeholder="https://example.com/image.jpg"
                      />
                      {errors.image && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.image.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Initial Notes (Optional)
                      </label>
                      <textarea
                        id="notes"
                        {...register('notes')}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700 dark:text-slate-100"
                        placeholder="Add any initial notes about the game..."
                      />
                    </div>

                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex w-full justify-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Generating Milestones...' : 'Add Game'}
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 sm:mt-0 sm:w-auto"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddGameModal;