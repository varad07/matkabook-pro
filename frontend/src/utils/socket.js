import { io } from 'socket.io-client';

// Singleton — one connection shared across all components.
// Creating socket inside a component re-connects on every render.
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default socket;
