import React, { useEffect, useRef } from 'react';
import { X, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';

// "About the posters": where the artwork comes from and whether TMDB is on. A native <dialog>
// opened with showModal(), so focus moves in, Tab stays inside, Escape closes and the page
// behind is inert, the same way the film page works.
export default function SettingsModal({ isOpen, onClose, currentApiKey }) {
  const dialogRef = useRef(null);
  const isEnabled = !!currentApiKey;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="about-posters-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} // the backdrop
      className="bg-transparent p-4 backdrop:bg-black/70 max-w-md w-full"
    >
      <div className="bg-gray-800 rounded-xl shadow-2xl text-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="about-posters-title" className="text-lg font-semibold text-white">About the posters</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <p className="text-gray-300">
            Archive.org uploads rarely come with artwork, and their titles can be anything. This site works out which
            film each upload is and shows that film's poster, with TMDB's cast and ratings on the film page.
          </p>

          <div className={`flex items-start gap-3 p-3 rounded-lg ${isEnabled ? 'bg-green-900/30 border border-green-600/50' : 'bg-gray-700/60 border border-gray-600'}`}>
            {isEnabled ? <Check className="w-5 h-5 text-green-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-gray-400 shrink-0" />}
            <div>
              <p className={`font-medium ${isEnabled ? 'text-green-400' : 'text-gray-200'}`}>{isEnabled ? 'TMDB is on' : 'TMDB is off'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isEnabled
                  ? 'Films the index does not know are matched live, and film pages show cast, ratings and details.'
                  : 'Posters come from the built-in index only, and film pages show what Archive.org knows. Everything still plays.'}
              </p>
            </div>
          </div>

          <div className="bg-gray-750 rounded-lg p-3 text-xs text-gray-400">
            <p className="font-medium text-gray-300 mb-1 flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> Where a poster comes from</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>The poster index: which film an upload is, decided once and shipped with the site</li>
              <li>A live TMDB match, when TMDB is on and the index has no answer</li>
              <li>A generated cover when neither knows the film</li>
            </ul>
            <p className="mt-2">
              Wrong poster? Every film page links to its Archive.org item; corrections are a one-line change in the{' '}
              <a href="https://github.com/amponce/archive-movie-browser#poster-index" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline">poster index</a>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end p-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-lg text-sm font-medium">
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
