import { httpServer } from './app.js';

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 [TrekMap Server] Running with Socket.io Real-time on http://localhost:${PORT}`);
});
