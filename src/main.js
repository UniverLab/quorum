import { register, start } from './router.js';
import { renderHome } from './pages/home.js';
import { renderRoom } from './pages/room.js';
import './style.css';

const root = document.getElementById('app');

register('/', () => renderHome(root));
register('/room/:id', (id) => renderRoom(root, id));

start();
