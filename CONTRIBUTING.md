git clone [https://github.com/](https://github.com/)<you>/archive-movie-browser.git
cd archive-movie-browser
npm install
npm run dev


Node 22 or newer. A TMDB key is optional: without one the app works and shows title covers instead of posters (see the README).

Before you open a pull request

npm test passes.

npm run build passes.

Click through the change in a browser. A passing build does not catch a page that crashes when you open it, and there are no component tests yet. Open a film,