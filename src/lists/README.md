# Curated lists

Each `.json` file here is one list on the site's Lists page. Anyone can add one: no code, no API keys, just a pull request with a file like this.

```json
{
  "slug": "noir-under-90",
  "title": "Noir you can finish tonight",
  "blurb": "Twelve films under ninety minutes, from the years when the studios shot fast and cheap and the shadows did the acting.",
  "curator": "amponce",
  "films": [
    { "id": "Detour", "note": "Six days of shooting, one of the bleakest endings in American film." },
    { "id": "Hitch_Hiker" }
  ]
}
```

- `slug`: the list's address, `/lists/<slug>`. Lowercase, dashes.
- `title` and `blurb`: your words. Say why someone should care, not what the films are.
- `curator`: your GitHub handle. It's shown on the list.
- `films`: Archive.org identifiers in the order you want them shown, each with an optional one-line `note`. The identifier is the last part of `archive.org/details/<identifier>`; pick an upload the poster index knows (search the site and look at the film's link), so the list gets a real poster.

Six to twenty films is a good size. `npm test` checks that every file is well formed.
