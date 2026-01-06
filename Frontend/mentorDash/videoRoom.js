// Video Room JavaScript
class VideoRoom {
  constructor() {
    this.peer = null;
    this.localStream = null;
    this.screenStream = null;
    this.connections = new Map();
    this.ws = null;
    this.roomCode = null;
    this.userId = null;
    this.isVideoOn = true;
    this.isAudioOn = true;
    this.isScreenSharing = false;
    this.isHandRaised = false;
    this.sessionStartTime = null;
    this.timerInterval = null;

    this.init();
  }

  async init() {
    // Get room code from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.roomCode = urlParams.get('room') || this.generateRoomCode();
    
    document.getElementById('room-code').textContent = `Room: ${this.roomCode}`;
    
    // Check authentication
    const token = localStorage.getItem('token') || localStorage.getItem('mentorToken');
    if (!token) {
      alert('Please login to join the video room');
      window.location.href = '../credentials/signin.html';
      return;
    }

    // Setup event listeners
    this.setupEventListeners();
    
    // Show join modal with preview
    await this.showJoinModal();
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async showJoinModal() {
    const modal = document.getElementById('join-modal');
    modal.style.display = 'flex';

    try {
      // Get preview stream
      const previewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const previewVideo = document.getElementById('preview-video');
      previewVideo.srcObject = previewStream;
      
      // Store for later use
      this.previewStream = previewStream;
    } catch (err) {
      console.error('Failed to get preview stream:', err);
    }
  }

  setupEventListeners() {
    // Join button
    document.getElementById('join-room-btn').addEventListener('click', () => this.joinRoom());

    // Control buttons
    document.getElementById('toggle-video').addEventListener('click', () => this.toggleVideo());
    document.getElementById('toggle-audio').addEventListener('click', () => this.toggleAudio());
    document.getElementById('toggle-screen').addEventListener('click', () => this.toggleScreenShare());
    document.getElementById('raise-hand').addEventListener('click', () => this.toggleRaiseHand());
    document.getElementById('toggle-chat').addEventListener('click', () => this.toggleSidebar('chat'));
    document.getElementById('toggle-participants').addEventListener('click', () => this.toggleSidebar('participants'));
    document.getElementById('end-call-btn').addEventListener('click', () => this.leaveRoom());
    document.getElementById('leave-btn').addEventListener('click', () => this.leaveRoom());

    // Chat
    document.getElementById('send-chat-btn').addEventListener('click', () => this.sendChatMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });

    // Copy link
    document.getElementById('copy-link-btn').addEventListener('click', () => this.copyInviteLink());

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
  }

  async joinRoom() {
    const displayName = document.getElementById('display-name').value || 'Anonymous';
    const joinWithVideo = document.getElementById('join-with-video').checked;
    const joinWithAudio = document.getElementById('join-with-audio').checked;

    // Hide modal, show loading
    document.getElementById('join-modal').style.display = 'none';
    document.getElementById('loading-overlay').style.display = 'flex';

    try {
      // Stop preview stream
      if (this.previewStream) {
        this.previewStream.getTracks().forEach(track => track.stop());
      }

      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: joinWithVideo,
        audio: joinWithAudio
      });

      this.isVideoOn = joinWithVideo;
      this.isAudioOn = joinWithAudio;
      this.updateControlButtons();

      // Display local video
      const localVideo = document.getElementById('local-video');
      localVideo.srcObject = this.localStream;

      // Initialize PeerJS
      this.peer = new Peer({
        host: 'localhost',
        port: 5000,
        path: '/peerjs'
      });

      this.peer.on('open', (id) => {
        this.userId = id;
        console.log('Connected to PeerJS with ID:', id);
        this.connectWebSocket(displayName);
      });

      this.peer.on('call', (call) => {
        call.answer(this.localStream);
        this.handleIncomingCall(call);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
      });

      // Start timer
      this.startTimer();

      // Hide loading
      document.getElementById('loading-overlay').style.display = 'none';

    } catch (err) {
      console.error('Failed to join room:', err);
      alert('Failed to access camera/microphone. Please check permissions.');
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('join-modal').style.display = 'flex';
    }
  }

  connectWebSocket(displayName) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      
      const token = localStorage.getItem('token') || localStorage.getItem('mentorToken');
      
      // Authenticate
      this.ws.send(JSON.stringify({
        type: 'authenticate_video_room',
        token: token,
        roomCode: this.roomCode
      }));

      // Join room
      setTimeout(() => {
        this.ws.send(JSON.stringify({
          type: 'join_video_room',
          roomCode: this.roomCode,
          peerId: this.userId,
          displayName: displayName
        }));
      }, 500);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'room_joined':
        console.log('Joined room with participants:', data.participants);
        data.participants.forEach(participant => {
          if (participant.peerId !== this.userId) {
            this.callPeer(participant.peerId, participant.userId);
          }
        });
        break;

      case 'participant_joined':
        console.log('Participant joined:', data.participant);
        this.addParticipantToUI(data.participant);
        break;

      case 'participant_left':
        console.log('Participant left:', data.participantId);
        this.removeParticipant(data.participantId);
        break;

      case 'chat_message':
        this.displayChatMessage(data);
        break;

      case 'hand_raised':
        this.handleHandRaised(data);
        break;

      case 'participant_updated':
        this.updateParticipantStatus(data);
        break;

      case 'error':
        console.error('Room error:', data.message);
        break;
    }
  }

  callPeer(peerId, participantId) {
    if (!this.peer || !this.localStream) return;

    const call = this.peer.call(peerId, this.localStream);
    this.handleIncomingCall(call, participantId);
  }

  handleIncomingCall(call, participantId = null) {
    call.on('stream', (remoteStream) => {
      const videoId = participantId || call.peer;
      this.addRemoteVideo(remoteStream, videoId);
    });

    call.on('close', () => {
      const videoId = participantId || call.peer;
      this.removeRemoteVideo(videoId);
    });

    this.connections.set(call.peer, call);
  }

  addRemoteVideo(stream, participantId) {
    const existingVideo = document.getElementById(`video-${participantId}`);
    if (existingVideo) {
      existingVideo.querySelector('video').srcObject = stream;
      return;
    }

    const videoGrid = document.getElementById('video-grid');
    const videoTile = document.createElement('div');
    videoTile.className = 'video-tile';
    videoTile.id = `video-${participantId}`;
    videoTile.innerHTML = `
      <video autoplay playsinline></video>
      <div class="video-overlay">
        <span class="participant-name">Participant</span>
      </div>
    `;

    videoTile.querySelector('video').srcObject = stream;
    videoGrid.appendChild(videoTile);
  }

  removeRemoteVideo(participantId) {
    const videoTile = document.getElementById(`video-${participantId}`);
    if (videoTile) {
      videoTile.remove();
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoOn = videoTrack.enabled;
        this.updateControlButtons();
        this.sendParticipantUpdate();
      }
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioOn = audioTrack.enabled;
        this.updateControlButtons();
        this.sendParticipantUpdate();
      }
    }
  }

  async toggleScreenShare() {
    if (!this.isScreenSharing) {
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        
        // Replace video track in all connections
        const screenTrack = this.screenStream.getVideoTracks()[0];
        
        this.connections.forEach((call) => {
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        // Update local video
        document.getElementById('local-video').srcObject = this.screenStream;

        screenTrack.onended = () => {
          this.stopScreenShare();
        };

        this.isScreenSharing = true;
        this.updateControlButtons();

      } catch (err) {
        console.error('Screen share failed:', err);
      }
    } else {
      this.stopScreenShare();
    }
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
    }

    // Restore camera
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      this.connections.forEach((call) => {
        const sender = call.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
    }

    document.getElementById('local-video').srcObject = this.localStream;
    this.isScreenSharing = false;
    this.updateControlButtons();
  }

  toggleRaiseHand() {
    this.isHandRaised = !this.isHandRaised;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'raise_hand',
        roomCode: this.roomCode,
        isHandRaised: this.isHandRaised
      }));
    }

    this.updateControlButtons();
  }

  toggleSidebar(tab) {
    const sidebar = document.getElementById('room-sidebar');
    sidebar.classList.toggle('active');
    if (tab) {
      this.switchTab(tab);
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-panel`);
    });
  }

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message || !this.ws) return;

    this.ws.send(JSON.stringify({
      type: 'video_room_chat',
      roomCode: this.roomCode,
      message: message,
      isPrivate: false
    }));

    // Display own message
    this.displayChatMessage({
      message: message,
      senderName: 'You',
      timestamp: new Date(),
      isOwn: true
    });

    input.value = '';
  }

  displayChatMessage(data) {
    const messagesContainer = document.getElementById('chat-messages');
    
    // Remove welcome message if exists
    const welcome = messagesContainer.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${data.isOwn ? 'own' : ''}`;
    
    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="sender">${data.senderName || 'Participant'}</span>
        <span class="time">${time}</span>
      </div>
      <div class="message-content">${data.message}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  updateControlButtons() {
    const videoBtn = document.getElementById('toggle-video');
    const audioBtn = document.getElementById('toggle-audio');
    const screenBtn = document.getElementById('toggle-screen');
    const handBtn = document.getElementById('raise-hand');

    videoBtn.classList.toggle('off', !this.isVideoOn);
    videoBtn.querySelector('i').className = this.isVideoOn ? 'fas fa-video' : 'fas fa-video-slash';

    audioBtn.classList.toggle('off', !this.isAudioOn);
    audioBtn.querySelector('i').className = this.isAudioOn ? 'fas fa-microphone' : 'fas fa-microphone-slash';

    screenBtn.classList.toggle('active', this.isScreenSharing);
    handBtn.classList.toggle('active', this.isHandRaised);
  }

  sendParticipantUpdate() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'participant_update',
        roomCode: this.roomCode,
        connectionInfo: {
          isVideoOn: this.isVideoOn,
          isAudioOn: this.isAudioOn,
          isScreenSharing: this.isScreenSharing,
          isHandRaised: this.isHandRaised
        }
      }));
    }
  }

  addParticipantToUI(participant) {
    const list = document.getElementById('participants-list');
    const existingItem = document.getElementById(`participant-${participant.peerId}`);
    if (existingItem) return;

    const item = document.createElement('div');
    item.className = 'participant-item';
    item.id = `participant-${participant.peerId}`;
    item.innerHTML = `
      <div class="participant-avatar">
        <i class="fas fa-user"></i>
      </div>
      <div class="participant-info">
        <span class="name">${participant.displayName || 'Participant'}</span>
        <div class="status-icons">
          ${participant.connectionInfo?.isVideoOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash text-muted"></i>'}
          ${participant.connectionInfo?.isAudioOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash text-muted"></i>'}
        </div>
      </div>
    `;
    list.appendChild(item);
  }

  removeParticipant(participantId) {
    const item = document.getElementById(`participant-${participantId}`);
    if (item) item.remove();
    
    this.removeRemoteVideo(participantId);
    
    const connection = this.connections.get(participantId);
    if (connection) {
      connection.close();
      this.connections.delete(participantId);
    }
  }

  handleHandRaised(data) {
    // Show notification or visual indicator
    const participantItem = document.getElementById(`participant-${data.participantId}`);
    if (participantItem) {
      if (data.isHandRaised) {
        participantItem.classList.add('hand-raised');
      } else {
        participantItem.classList.remove('hand-raised');
      }
    }
  }

  updateParticipantStatus(data) {
    const participantItem = document.getElementById(`participant-${data.participantId}`);
    if (participantItem) {
      const statusIcons = participantItem.querySelector('.status-icons');
      if (statusIcons && data.connectionInfo) {
        statusIcons.innerHTML = `
          ${data.connectionInfo.isVideoOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash text-muted"></i>'}
          ${data.connectionInfo.isAudioOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash text-muted"></i>'}
        `;
      }
    }
  }

  copyInviteLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('Invite link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  startTimer() {
    this.sessionStartTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.sessionStartTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      document.getElementById('session-timer').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
  }

  leaveRoom() {
    if (!confirm('Are you sure you want to leave the room?')) return;

    // Clean up
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
    }

    this.connections.forEach((call) => call.close());
    
    if (this.peer) this.peer.destroy();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'leave_video_room',
        roomCode: this.roomCode
      }));
      this.ws.close();
    }

    // Redirect back
    const isMentor = localStorage.getItem('mentorToken');
    window.location.href = isMentor ? 'mentorMain.html' : '../Dashboards/groups.html';
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new VideoRoom();
});
