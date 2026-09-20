import React from 'react';
import { Film } from 'lucide-react';

// Archive.org thumbnails are a random video frame, often cropped opening
// credits, so they are only used as a blurred backdrop behind the title.
// Positioned absolutely: the parent must be `relative` and have a fixed size.
// size: 'full' (grid, detail), 'small' (related cards), 'thumb' (80px list, no title text)
export default function TitleCover({ src, title, year, size = 'full' }) {
  const isThumb = size === 'thumb';
  const isSmall = size === 'small';

  return (
    <div className="absolute inset-0 bg-gray-800">
      {src && (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover blur scale-110 opacity-80"
          onError={(e) => { e.target.style.display = 'none'; }}
          loading="lazy"
        />
      )}
      {isThumb ? (
        <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
          <Film className="w-5 h-5 text-yellow-400" />
        </div>
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent flex flex-col justify-end ${
            isSmall ? 'p-2' : 'p-3'
          }`}
        >
          <Film className={`text-yellow-400 ${isSmall ? 'w-4 h-4 mb-1' : 'w-5 h-5 mb-2'}`} />
          <span
            className={`font-bold text-white leading-tight ${
              isSmall ? 'text-xs line-clamp-3' : 'text-base line-clamp-4'
            }`}
          >
            {title}
          </span>
          {year && <span className="text-xs text-gray-400 mt-1">{year}</span>}
        </div>
      )}
    </div>
  );
}