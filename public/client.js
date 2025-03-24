// Configuration WebRTC
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Variables globales
let localStream;
let remoteStream;
let rtcPeerConnection;
let roomId;
let socket;

// Éléments DOM
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const joinBtn = document.getElementById('joinBtn');
const hangupBtn = document.getElementById('hangupBtn');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const roomInput = document.getElementById('roomId');
const statusElement = document.getElementById('status');

// Éléments de chat
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

// Événements
joinBtn.addEventListener('click', joinRoom);
hangupBtn.addEventListener('click', hangUp);
muteBtn.addEventListener('click', toggleMute);
videoBtn.addEventListener('click', toggleVideo);
sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

// Initialisation de Socket.io
socket = io();

// Fonctions précédentes restent les mêmes...

// Événements socket - Ajout du chat
socket.on('chat_message', (message) => {
  addChatMessage(message, 'remote');
});

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (message && roomId) {
    // Émettre le message via socket
    socket.emit('chat_message', roomId, message);
    
    // Afficher le message localement
    addChatMessage(message, 'local');
    
    // Réinitialiser l'input
    chatInput.value = '';
  }
}

function addChatMessage(message, type) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('chat-message', type);
  messageElement.textContent = message;
  chatMessages.appendChild(messageElement);
  
  // Faire défiler jusqu'au dernier message
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Autres fonctions précédentes restent identiques

// Gérer les événements socket
socket.on('room_created', async () => {
  updateStatus('Salle créée. En attente du participant...');
});

socket.on('room_joined', async () => {
  updateStatus('Vous avez rejoint la salle. Envoi de la demande de connexion...');
  socket.emit('ready', roomId);
});

socket.on('ready', async () => {
  if (!rtcPeerConnection) {
    await createPeerConnection();
    await sendOffer();
  }
});

socket.on('full_room', () => {
  updateStatus('La salle est pleine. Veuillez essayer une autre salle.');
});

socket.on('offer', async (description, id) => {
  if (!rtcPeerConnection) {
    await createPeerConnection();
  }
  await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(description));
  await createAndSendAnswer();
});

socket.on('answer', async (description) => {
  await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(description));
});

socket.on('ice_candidate', async (candidate) => {
  if (rtcPeerConnection) {
    await rtcPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on('user_disconnected', () => {
  updateStatus('L\'autre participant a quitté l\'appel.');
  hangUp();
});

// Fonctions
async function checkAndRequestPermissions() {
  try {
    // Forcer une demande de permission explicite
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    // Arrêter le stream immédiatement après (optionnel)
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error("Erreur de permission:", error);
    updateStatus("Permissions non accordées: " + error.message);
    return false;
  }
}
async function joinRoom() {
  const hasPermissions = await checkAndRequestPermissions();
if (!hasPermissions) {
  return; // Sortir si les permissions ne sont pas accordées
}
  roomId = roomInput.value || generateRoomId();
  roomInput.value = roomId;
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: true 
    });
    
    localVideo.srcObject = localStream;
    hangupBtn.disabled = false;
    joinBtn.disabled = true;
    
    socket.emit('join', roomId);
  } catch (error) {
    console.error('Erreur lors de l\'accès aux médias:', error);
    updateStatus('Erreur: Impossible d\'accéder à la caméra ou au microphone');
  }
}
const testMediaBtn = document.getElementById('testMediaBtn');
testMediaBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localVideo.srcObject = stream;
    updateStatus('Test réussi! Permissions accordées.');
  } catch (error) {
    console.error('Erreur test média:', error);
    updateStatus('Erreur: ' + error.message);
  }
});
async function createPeerConnection() {
  rtcPeerConnection = new RTCPeerConnection(configuration);
  
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;
  
  localStream.getTracks().forEach(track => {
    rtcPeerConnection.addTrack(track, localStream);
  });
  
  rtcPeerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };
  
  rtcPeerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice_candidate', roomId, event.candidate);
    }
  };
  
  rtcPeerConnection.onconnectionstatechange = event => {
    if (rtcPeerConnection.connectionState === 'connected') {
      updateStatus('Connexion établie!');
    }
  };
}

async function sendOffer() {
  const offer = await rtcPeerConnection.createOffer();
  await rtcPeerConnection.setLocalDescription(offer);
  socket.emit('offer', roomId, offer);
}

async function createAndSendAnswer() {
  const answer = await rtcPeerConnection.createAnswer();
  await rtcPeerConnection.setLocalDescription(answer);
  socket.emit('answer', roomId, answer);
}

function hangUp() {
  if (rtcPeerConnection) {
    rtcPeerConnection.close();
    rtcPeerConnection = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  hangupBtn.disabled = true;
  joinBtn.disabled = false;
  updateStatus('Appel terminé');
}

function toggleMute() {
  if (localStream) {
    const audioTracks = localStream.getAudioTracks();
    
    if (audioTracks.length > 0) {
      const isEnabled = !audioTracks[0].enabled;
      audioTracks[0].enabled = isEnabled;
      muteBtn.textContent = isEnabled ? 'Couper le micro' : 'Activer le micro';
    }
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    
    if (videoTracks.length > 0) {
      const isEnabled = !videoTracks[0].enabled;
      videoTracks[0].enabled = isEnabled;
      videoBtn.textContent = isEnabled ? 'Couper la vidéo' : 'Activer la vidéo';
    }
  }
}

function updateStatus(message) {
  statusElement.textContent = message;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 15);
}