import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { setUpdateState, bindUpdateSW } from './updatePrompt';

// registerType: 'prompt' → registerSW returns an updateSW() function.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    setUpdateState({ ready: true });
  },
  onOfflineReady() {
    console.info('TakeoutReader is ready to work offline.');
  },
});

if (typeof updateSW === 'function') {
  bindUpdateSW(updateSW as (reloadPage?: boolean) => Promise<void>);
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);