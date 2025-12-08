import React from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, currentApiKey }) {
  if (!isOpen) return null;

  const isEnabled = !!currentApiKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* TMDB API Status */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Key className="w-4 h-4" />
              TMDB API Status
            </label>

            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              isEnabled ? 'bg-green-900/30 border border-green-600/50' : 'bg-red-900/30 border border-red-600/50'
            }`}>
              {isEnabled ? (
                <>
                  <Check className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-400 font-medium">TMDB Enabled</p>
                    <p className="text-xs text-gray-400">High-quality posters and metadata are active</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-red-400 font-medium">TMDB Disabled</p>
                    <p className="text-xs text-gray-400">Add VITE_TMDB_API_KEY to your .env file</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-gray-750 rounded-lg p-3 text-xs text-gray-400">
            <p className="font-medium text-gray-300 mb-1">What TMDB provides:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>High-resolution movie posters</li>
              <li>Accurate movie ratings</li>
              <li>Better genre categorization</li>
              <li>Movie overview descriptions</li>
            </ul>
          </div>

          {!isEnabled && (
            <div className="bg-gray-700 rounded-lg p-3 text-xs">
              <p className="text-gray-300 font-medium mb-2">To enable TMDB:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>Get a free API key at themoviedb.org/settings/api</li>
                <li>Create a .env file in the project root</li>
                <li>Add: VITE_TMDB_API_KEY=your_key_here</li>
                <li>Restart the dev server</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-lg text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
