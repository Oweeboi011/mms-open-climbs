import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { auth } from './firebase/config';
import { logFailedRequest } from './utils/logFailedRequest';
import './styles/globals.css';

// De-dupe repeating errors within a session so a crash loop can't flood Firestore.
const seenErrorMessages = new Set();
function reportClientError(source, message) {
  const key = `${source}:${message}`;
  if (seenErrorMessages.has(key)) return;
  seenErrorMessages.add(key);
  logFailedRequest({
    type: 'client',
    source,
    message,
    path: window.location.pathname,
    userId: auth.currentUser?.uid ?? null,
  });
}

window.addEventListener('error', (event) => {
  reportClientError('window.onerror', event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  reportClientError(
    'unhandledrejection',
    String(event.reason?.message || event.reason),
  );
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
