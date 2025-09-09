import React from 'react';
import { X, CheckCircle, XCircle, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MilestoneConfirmationModal = ({ 
  isOpen, 
  onClose, 
  pendingMilestones, 
  noteText, 
  onConfirm, 
  onReject, 
  onConfirmAll, 
  onRejectAll 
}) => {
  if (!isOpen || !pendingMilestones || pendingMilestones.length === 0) return null;

  return (
    <AnimatePresence>
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
            className="relative transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 px-6 pb-6 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl"
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
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20 sm:mx-0 sm:h-10 sm:w-10">
                <Target className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-slate-100 mb-4">
                  Milestone Suggestions
                </h3>
                
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    <strong>Your note:</strong>
                  </p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 italic">
                    "{noteText}"
                  </p>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Based on your note, I think you might have completed these milestones. 
                  Would you like to mark them as complete?
                </p>

                <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                  {pendingMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {milestone.title}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {milestone.description}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-3">
                        <button
                          onClick={() => onConfirm(milestone.id)}
                          className="inline-flex items-center px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                          title="Mark as completed"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Yes
                        </button>
                        <button
                          onClick={() => onReject(milestone.id)}
                          className="inline-flex items-center px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
                          title="Keep as incomplete"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          No
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={onConfirmAll}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark All Complete
                  </button>
                  <button
                    onClick={onRejectAll}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Keep All Incomplete
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Add Note Only
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default MilestoneConfirmationModal;
