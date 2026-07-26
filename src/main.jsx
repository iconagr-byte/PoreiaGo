import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import GoogleAuthRoot from './components/GoogleAuthRoot.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleAuthRoot>
      <App />
    </GoogleAuthRoot>
  </StrictMode>,
);
