// How a channel page opens: watching, or as a list. Pure functions.

export const CHANNEL_VIEW_KEY = 'channel-view';
// A link's ?view= wins, then what this browser chose last, then watching
export function channelView(search, stored) {
  const asked = new URLSearchParams(search).get('view');
  if (asked === 'list' || asked === 'watch') return asked;
  return stored === 'list' ? 'list' : 'watch';
}
export const channelLink = (origin, id, view) => `${origin}/c/${id}${view === 'list' ? '?view=list' : ''}`;
