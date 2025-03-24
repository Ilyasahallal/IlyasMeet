const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');

const app = express();

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};

const server = https.createServer(options, app);
const io = socketIo(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté:', socket.id);

  // Rejoindre une salle
  socket.on('join', (roomId) => {
    const roomClients = io.sockets.adapter.rooms.get(roomId) || { size: 0 };
    const numberOfClients = roomClients.size;

    if (numberOfClients === 0) {
      console.log(`Création de la salle ${roomId} et attente du participant`);
      socket.join(roomId);
      socket.emit('room_created', roomId);
    } else if (numberOfClients === 1) {
      console.log(`Le participant rejoint la salle ${roomId}`);
      socket.join(roomId);
      socket.emit('room_joined', roomId);
      socket.to(roomId).emit('ready', socket.id);
    } else {
      console.log(`La salle ${roomId} est pleine`);
      socket.emit('full_room', roomId);
    }
  });

  // Retransmettre les messages de signalisation
  socket.on('offer', (roomId, description) => {
    socket.to(roomId).emit('offer', description, socket.id);
  });

  socket.on('answer', (roomId, description) => {
    socket.to(roomId).emit('answer', description);
  });

  socket.on('ice_candidate', (roomId, candidate) => {
    socket.to(roomId).emit('ice_candidate', candidate, socket.id);
  });

  // Nouveau gestionnaire de messages de chat
  socket.on('chat_message', (roomId, message) => {
    // Relayer le message à tous les autres participants de la salle
    socket.to(roomId).emit('chat_message', message);
  });

  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur HTTPS démarré sur le port ${PORT}`);
});