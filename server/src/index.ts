import express from 'express';
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';

const app = express();

// HTTPS環境変数で制御
const useHttps = process.env.HTTPS === 'true';
const server = useHttps
  ? https.createServer(
      {
        key: fs.readFileSync(path.join(__dirname, '../../client/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '../../client/cert.pem')),
      },
      app
    )
  : http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || (useHttps ? 3001 : 3000);

// Serve static files from the client's dist directory
app.use(express.static(path.join(__dirname, '../../client/dist')));

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  // Listen for avatar data from clients
  socket.on('playerdata', (data) => {
    // Broadcast the avatar data to all other clients
    socket.broadcast.emit('playerdata', data);
  });
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}, protocol: ${useHttps ? 'https' : 'http'}`);
});
