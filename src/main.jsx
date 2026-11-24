import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/app.css';

// Préférence gardée sur le téléphone : grands textes (la langue est gérée par src/i18n).
try { if (localStorage.getItem('mieru:grand') === '1') document.documentElement.classList.add('grand'); } catch { /* stockage indisponible */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
