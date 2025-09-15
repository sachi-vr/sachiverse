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
  maxHttpBufferSize: 100 * 1024 * 1024, // 100MB
});

const port = process.env.PORT || (useHttps ? 3001 : 3000);

// Serve static files from the client's dist directory
app.use(express.static(path.join(__dirname, '../../client/dist')));
// Serve static files from the public directory for VRMs
app.use('/mydata', express.static(path.join(__dirname, '../mydata')));

// vrm-upload
app.post('/vrm-upload/:socketId', express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  const socketId = req.params.socketId;
  if (!io.sockets.sockets.has(socketId)) {
    console.error('Received vrm-upload from non-existent socket:', socketId);
    res.status(404).send({ status: 'error', message: 'Socket not found' });
    return;
  }
  console.log('Received vrm-upload from', socketId);
  const vrmFile = req.body;
  const vrmDir = path.join(__dirname, '../mydata/vrms');
  if (!fs.existsSync(vrmDir)) {
    fs.mkdirSync(vrmDir, { recursive: true });
  }
  const vrmFilePath = path.join(__dirname, `../mydata/vrms/${socketId}.vrm`);
  fs.writeFile(vrmFilePath, vrmFile, (err) => {
    if (err) {
      console.error('Error saving VRM file:', err);
      res.status(500).send({ status: 'error', message: 'Failed to save VRM file' });
      return;
    }
    console.log('VRM file saved:', vrmFilePath);
    res.send({ status: 'success' });
  });
});

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

  // アイテムの状態変更イベントのハンドリング
  socket.on('itemStateChange', (data) => {
    console.log('Received itemStateChange:', data);
    socket.broadcast.emit('itemStateChange', data);
  });

  socket.on('drawline', (data) => {
    console.log('Received drawline', socket.id, 'ip:', ip);
    socket.broadcast.emit('drawline', data);
  });
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}, protocol: ${useHttps ? 'https' : 'http'}`);
});