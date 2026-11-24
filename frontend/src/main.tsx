import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppProviders from '@/app/providers/AppProviders';
import 'devicon/devicon.min.css';
import './styles/index.css';
import './styles/community-chat.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element was not found.');

createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
