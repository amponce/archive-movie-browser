import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startAnalytics } from './services/analytics';

startAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
