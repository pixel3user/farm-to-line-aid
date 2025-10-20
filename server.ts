import express from 'express';
import path from 'path';
import http from 'http';
import app from './functions/src/app';

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = http.createServer(app as any);
server.listen(PORT, () => {
  console.log(`Farm2Market AI server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});
