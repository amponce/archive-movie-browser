import React, { useState, useEffect, useRef } from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';
import tmdbService from '../services/tmdb';

export default function SettingsModal({ isOpen, onClose, currentApiKey, onApiKeyChange }) {
  const [apiKey, setApiKey] = useState(currentApiKey || '');
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const isEnabled = !!currentApiKey;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  // handle save
  const handleSave = async () => {
    if (!apiKey.trim()) {
      return;
    }

    const isValid = await tmdbService.validateApiKey(apiKey.trim());

    if (isValid) {
      const trimmedApiKey = apiKey.trim();

      localStorage.setItem('tmdb-api-key', trimmedApiKey);
      onApiKeyChange?.(trimmedApiKey);
    } else {
      setError('Invalid TMDB API key');
    }
  };

  // handle clear
  const handleClear = () => {
    localStorage.removeItem('tmdb-api-key');
    setApiKey('');
    setError('');
    onApiKeyChange?.('');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="bg-transparent p-4 backdrop:bg-black/70 max-w-md w-full"
    >

      {/* Modal */}
      <div className="bg-gray-800 rounded-xl shadow-2xl text-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="settings-title" className="text-lg font-semibold text-white">Settings</h2>
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

            <div className={`flex items-center gap-2 p-3 rounded-lg ${isEnabled ? 'bg-green-900/30 border border-green-600/50' : 'bg-red-900/30 border border-red-600/50'
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

          {/* API Key Input */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              TMDB API Key
            </label>

            <input
              type="text"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError('');
              }}
              placeholder="Enter your TMDB API key"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
            />

            <p className="mt-2 text-xs text-gray-500">
              Your API key is stored only in this browser.
            </p>
            {error && (
              <p className="mt-2 text-xs text-red-400">
                {error}
              </p>
            )}
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

          <button
            onClick={handleSave}
            className="ml-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-gray-900 rounded-lg text-sm font-medium"
          >
            Save
          </button>

          <button
            onClick={handleClear}
            className="ml-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-medium"
          >
            Clear
          </button>
        </div>
      </div>
    </dialog>
  );
}
