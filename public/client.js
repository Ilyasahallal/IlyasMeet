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
  
  // Événements
  joinBtn.addEventListener('click', joinRoom);
  hangupBtn.addEventListener('click', hangUp);
  muteBtn.addEventListener('click', toggleMute);
  videoBtn.addEventListener('click', toggleVideo);
  
  // Initialisation de Socket.io
  socket = io();
  
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
  async function joinRoom() {
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