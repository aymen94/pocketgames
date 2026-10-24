import './styles/main.css';
import { App } from './app/app.js';
import { startPwa } from './services/pwa.js';
import { audio } from './services/audio.js';
import { startTheme } from './services/theme.js';
import { startButtonFeedback } from './components/feedback.js';

startTheme();
startPwa();
startButtonFeedback();
new App(document.getElementById('app'));

// browsers only allow audio after a gesture: unlock it on the first one
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });
