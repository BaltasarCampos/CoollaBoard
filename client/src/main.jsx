import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
