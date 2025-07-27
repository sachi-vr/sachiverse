import express from 'express';
import https from 'https';
import http from 'http';
import { Server, Socket } from 'socket.io';
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

io.on('connection', (socket: Socket) => {
  const ip = socket.handshake.headers['cf-connecting-ip'] || socket.handshake.address;
  console.log('a user connected for webrtc:', socket.id, 'ip:', ip);
  console.log('Broadcasting webrtc-playerconnected to new player:', socket.id);
  socket.broadcast.emit('webrtc-playerconnected', socket.id);

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id, 'ip:', ip);
    console.log('Broadcasting playerdisconnected for:', socket.id);
    socket.broadcast.emit('playerdisconnected', socket.id);
  });

  // Listen for avatar data from clients
  socket.on('playerdata', (data) => {
    // Broadcast the avatar data to all other clients
    socket.broadcast.emit('playerdata', data);
  });

  // WebRTC シグナリングイベントのハンドリング
  socket.on('webrtc-offer', (data) => {
    console.log('Received webrtc-offer from', socket.id, 'to', data.targetSocketId);
    socket.to(data.targetSocketId).emit('webrtc-offer', { offer: data.offer, senderSocketId: socket.id });
  });

  socket.on('webrtc-answer', (data) => {
    console.log('Received webrtc-answer from', socket.id, 'to', data.targetSocketId);
    socket.to(data.targetSocketId).emit('webrtc-answer', { answer: data.answer, senderSocketId: socket.id });
  });

  socket.on('webrtc-candidate', (data) => {
    console.log('Received webrtc-candidate from', socket.id, 'to', data.targetSocketId);
    socket.to(data.targetSocketId).emit('webrtc-candidate', { candidate: data.candidate, senderSocketId: socket.id });
  });
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}, protocol: ${useHttps ? 'https' : 'http'}`);
});
