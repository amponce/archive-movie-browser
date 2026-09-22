import React, { useState, useEffect, useRef } from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';
import tmdbService from '../services/tmdb';

// "About the posters": where the artwork comes from, and your own TMDB key if you want live
// matching for films outside the index (#44). A native <dialog> opened with showModal(), so
// focus moves in, Tab stays inside, Escape closes and the page behind is inert, the same way
// the film page works.
export default function SettingsModal({ isOpen, onClose, currentApiKey, onApiKeyChange }) {
  // Only a key the visitor saved here is ever shown; the site's own key (if any) stays out of the UI
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem('tmdb-api-key') || ''; } catch { return ''; } });
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
      <div className="bg-panel rounded-xl shadow-2xl text-bone">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 id="settings-title" className="text-lg font-semibold text-bone">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ink rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* TMDB API Status */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-muted mb-2">
              <Key className="w-4 h-4" />
              TMDB API Status
            </label>

            <div className={`flex items-center gap-2 p-3 rounded-lg ${isEnabled ? 'bg-nitrate/10 border border-nitrate/40' : 'bg-signal/10 border border-red-600/50'
              }`}>
              {isEnabled ? (
                <>
                  <Check className="w-5 h-5 text-nitrate" />
                  <div>
                    <p className="text-nitrate font-medium">TMDB Enabled</p>
                    <p className="text-xs text-muted">High-quality posters and metadata are active</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-signal" />
                  <div>
                    <p className="text-signal font-medium">TMDB Disabled</p>
                    <p className="text-xs text-muted">Add VITE_TMDB_API_KEY to your .env file</p>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* API Key Input */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-muted mb-2">
              TMDB API Key
            </label>

            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError('');
              }}
              placeholder="Enter your TMDB API key"
              className="w-full px-3 py-2 bg-ink border border-line rounded-lg text-bone placeholder:text-dim focus:outline-none focus:border-signal"
            />

            <p className="mt-2 text-xs text-dim">
              Your API key is stored only in this browser.
            </p>
            {error && (
              <p className="mt-2 text-xs text-signal">
                {error}
              </p>
            )}
          </div>

          {/* Info box */}
          <div className="bg-ink rounded-lg p-3 text-xs text-muted">
            <p className="font-medium text-muted mb-1">What TMDB provides:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>High-resolution movie posters</li>
              <li>Accurate movie ratings</li>
              <li>Better genre categorization</li>
              <li>Movie overview descriptions</li>
            </ul>
          </div>

          {!isEnabled && (
            <div className="bg-ink rounded-lg p-3 text-xs">
              <p className="text-muted font-medium mb-2">To enable TMDB:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted">
                <li>Get a free API key at themoviedb.org/settings/api</li>
                <li>Create a .env file in the project root</li>
                <li>Add: VITE_TMDB_API_KEY=your_key_here</li>
                <li>Restart the dev server</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-line">
          <button onClick={onClose} className="btn-ghost">Close</button>

          <button
            onClick={handleSave}
            className="btn-primary ml-2"
          >
            Save
          </button>

          <button
            onClick={handleClear}
            className="btn-ghost ml-2"
          >
            Clear
          </button>
        </div>
      </div>
    </dialog>
  );
}
