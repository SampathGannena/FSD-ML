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
    this.memberId = null;
    this.isVideoOn = true;
    this.isAudioOn = true;
    this.isScreenSharing = false;
    this.isHandRaised = false;
    this.sessionStartTime = null;
    this.timerInterval = null;
    this.roomPassword = null;
    this.hasJoinedApi = false;
    this.isRecording = false;
    this.isHost = false;
    this.roomSettings = {
      allowChat: true,
      allowScreenShare: true,
      allowRecording: false,
      muteOnEntry: false,
      requireApproval: false,
      allowHandRaise: true,
      memberPermissionMode: 'all',
      permittedMemberIds: []
    };
    this.participants = new Map();
    this.waitingParticipants = new Map();
    this.waitingForApproval = false;
    this.intentionalDisconnect = false;
    this.isWsAuthenticated = false;
    this.wsReconnectAttempts = 0;
    this.maxWsReconnectAttempts = 6;
    this.wsReconnectTimer = null;
    this.pendingReconnectNotice = false;
    this.connectionToastTimer = null;
    this.mediaRecorder = null;
    this.recordingStream = null;
    this.recordedChunks = [];
    this.recordingStartedAt = null;
    this.recordingUploadInProgress = false;
    this.latestRecordingUrl = null;

    this.init();
  }

  async init() {
    // Get room code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    this.roomCode = (roomFromUrl ? roomFromUrl.trim().toUpperCase() : this.generateRoomCode());
    
    document.getElementById('room-code').textContent = `Room: ${this.roomCode}`;
    
    // Check authentication
    const token = this.getAuthToken();
    if (!token) {
      alert('Please login to join the video room');
      window.location.href = '../credentials/signin.html';
      return;
    }

    if (window.SubscriptionAccess) {
      const access = await window.SubscriptionAccess.ensureFeatureAccess('video_calls', {
        featureName: 'Video calls'
      });

      if (!access.allowed) {
        const isMentor = !!localStorage.getItem('mentorToken');
        window.location.href = isMentor ? 'mentorMain.html' : '../Dashboards/groups.html';
        return;
      }
    }

    // Setup event listeners
    this.setupEventListeners();
    this.updateHostControls();
    
    // Show join modal with preview
    await this.showJoinModal();
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getAuthToken() {
    return localStorage.getItem('token') || localStorage.getItem('mentorToken');
  }

  getPeerConnectionOptions() {
    const runtimeConfig = window.VIDEO_ROOM_CONFIG || {};
    const isSecure = runtimeConfig.peerSecure !== undefined
      ? !!runtimeConfig.peerSecure
      : window.location.protocol === 'https:';

    const options = {
      host: runtimeConfig.peerHost || window.location.hostname,
      path: runtimeConfig.peerPath || '/peerjs',
      secure: isSecure
    };

    const resolvedPort = runtimeConfig.peerPort || window.location.port;
    if (resolvedPort !== undefined && resolvedPort !== null && resolvedPort !== '') {
      const parsedPort = Number(resolvedPort);
      if (Number.isInteger(parsedPort) && parsedPort > 0) {
        options.port = parsedPort;
      }
    }

    return options;
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
    document.getElementById('toggle-recording').addEventListener('click', () => this.toggleRecording());
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

    const openSettingsButton = document.getElementById('open-settings-btn');
    if (openSettingsButton) {
      openSettingsButton.addEventListener('click', () => this.openRoomSettingsModal());
    }

    const closeSettingsButton = document.getElementById('close-room-settings-btn');
    if (closeSettingsButton) {
      closeSettingsButton.addEventListener('click', () => this.closeRoomSettingsModal());
    }

    const saveSettingsButton = document.getElementById('save-room-settings-btn');
    if (saveSettingsButton) {
      saveSettingsButton.addEventListener('click', () => this.saveRoomSettings());
    }

    const settingsModal = document.getElementById('room-settings-modal');
    if (settingsModal) {
      settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
          this.closeRoomSettingsModal();
        }
      });
    }

    document.querySelectorAll('input[name="member-permission-mode"]').forEach(radio => {
      radio.addEventListener('change', () => this.renderMemberPermissionList());
    });

    const participantsList = document.getElementById('participants-list');
    if (participantsList) {
      participantsList.addEventListener('click', (event) => {
        const button = event.target.closest('.participant-action-btn');
        if (!button) {
          return;
        }

        const action = button.dataset.action;
        const targetUserId = button.dataset.targetUserId;
        if (action && targetUserId) {
          this.sendModerationAction(action, targetUserId);
        }
      });
    }

    const waitingList = document.getElementById('waiting-room-list');
    if (waitingList) {
      waitingList.addEventListener('click', (event) => {
        const button = event.target.closest('.waiting-action-btn');
        if (!button) {
          return;
        }

        const decision = button.dataset.decision;
        const targetUserId = button.dataset.targetUserId;
        if (decision && targetUserId) {
          this.sendWaitingRoomDecision(targetUserId, decision);
        }
      });
    }

    const waitingLeaveButton = document.getElementById('waiting-leave-btn');
    if (waitingLeaveButton) {
      waitingLeaveButton.addEventListener('click', () => this.leaveRoom());
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
  }

  async joinRoom() {
    const displayName = (document.getElementById('display-name').value || 'Anonymous').trim() || 'Anonymous';
    const joinWithVideo = document.getElementById('join-with-video').checked;
    const joinWithAudio = document.getElementById('join-with-audio').checked;
    this.displayName = displayName;
    this.intentionalDisconnect = false;

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
      this.peer = new Peer(this.getPeerConnectionOptions());

      this.peer.on('open', async (id) => {
        this.userId = id;
        console.log('Connected to PeerJS with ID:', id);

        const joined = await this.joinRoomViaApi(id, displayName);
        if (!joined) {
          this.cleanupAfterJoinFailure();
          document.getElementById('loading-overlay').style.display = 'none';
          document.getElementById('join-modal').style.display = 'flex';
          return;
        }

        this.connectWebSocket();
      });

      this.peer.on('call', (call) => {
        call.answer(this.localStream);
        this.handleIncomingCall(call);
      });

      this.peer.on('disconnected', () => {
        if (!this.intentionalDisconnect && this.peer) {
          try {
            this.peer.reconnect();
          } catch (err) {
            console.error('Peer reconnect failed:', err);
          }
        }
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
      });

    } catch (err) {
      console.error('Failed to join room:', err);
      alert('Failed to access camera/microphone. Please check permissions.');
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('join-modal').style.display = 'flex';
    }
  }

  cleanupAfterJoinFailure() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  async joinRoomViaApi(peerId, displayName) {
    const token = this.getAuthToken();
    if (!token) {
      alert('Please login to join the video room');
      return false;
    }

    const joinRequest = async () => {
      const body = {
        peerId,
        displayName
      };

      if (this.roomPassword) {
        body.password = this.roomPassword;
      }

      return fetch(`${window.location.origin}/api/video-rooms/${encodeURIComponent(this.roomCode)}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    };

    let response = await joinRequest();

    if (response.status === 401 && !this.roomPassword) {
      const password = window.prompt('This room is password protected. Enter room password:');
      if (!password) {
        return false;
      }

      this.roomPassword = password.trim();
      response = await joinRequest();
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      alert(payload?.message || 'Failed to join room');
      return false;
    }

    this.isHost = !!payload?.room?.isHost;
    this.memberId = payload?.room?.memberId || this.memberId;
    this.waitingForApproval = !!payload?.waitingForApproval;
    this.updateHostControls();

    if (payload?.room?.settings) {
      this.applyRoomSettings(payload.room.settings);
    }

    if (this.isHost) {
      this.setWaitingParticipants(payload?.room?.waitingParticipants || []);
    }

    if (this.waitingForApproval) {
      this.showWaitingApprovalModal(payload?.message || 'Waiting for host approval');
    } else {
      this.hideWaitingApprovalModal();
    }

    this.hasJoinedApi = true;
    return true;
  }

  connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
    const wasReconnecting = this.wsReconnectAttempts > 0;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isWsAuthenticated = false;
      this.wsReconnectAttempts = 0;
      if (this.wsReconnectTimer) {
        clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = null;
      }

      if (wasReconnecting) {
        this.pendingReconnectNotice = true;
        this.setConnectionBanner('reconnected', 'Connection restored. Rejoining room...');
      }

      const token = this.getAuthToken();
      
      // Authenticate
      this.ws.send(JSON.stringify({
        type: 'authenticate_video_room',
        token: token,
        roomCode: this.roomCode
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isWsAuthenticated = false;
      if (!this.intentionalDisconnect) {
        this.setConnectionBanner('reconnecting', 'Reconnecting...');
        this.scheduleWebSocketReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  scheduleWebSocketReconnect() {
    if (this.intentionalDisconnect || this.wsReconnectTimer) {
      return;
    }

    if (this.wsReconnectAttempts >= this.maxWsReconnectAttempts) {
      console.error('Max websocket reconnect attempts reached.');
      this.setConnectionBanner('error', 'Connection lost. Please refresh to rejoin the room.');
      this.showConnectionToast('error', 'Connection lost', 2600);
      return;
    }

    this.wsReconnectAttempts += 1;
    const delayMs = Math.min(1000 * (2 ** (this.wsReconnectAttempts - 1)), 12000);
    this.setConnectionBanner('reconnecting', `Reconnecting... (${this.wsReconnectAttempts}/${this.maxWsReconnectAttempts})`);
    if (this.wsReconnectAttempts === 1) {
      this.showConnectionToast('reconnecting', 'Reconnecting...', 1800);
    }

    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      if (this.intentionalDisconnect) {
        return;
      }

      const token = this.getAuthToken();
      if (!token || !this.hasJoinedApi) {
        return;
      }

      this.connectWebSocket();
    }, delayMs);
  }

  retryConnectionNow() {
    if (this.intentionalDisconnect) {
      return;
    }

    const token = this.getAuthToken();
    if (!token || !this.hasJoinedApi) {
      this.setConnectionBanner('error', 'Cannot retry right now. Please rejoin the room.');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.setConnectionBanner('reconnected', 'Connection is already active.');
      this.showConnectionToast('reconnected', 'Already connected', 1400);
      return;
    }

    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }

    this.wsReconnectAttempts = 0;
    this.setConnectionBanner('reconnecting', 'Reconnecting...');
    this.showConnectionToast('reconnecting', 'Retrying connection...', 1400);
    this.connectWebSocket();
  }

  setConnectionBanner(state, message) {
    const banner = document.getElementById('connection-status-banner');
    if (!banner) return;

    const icons = {
      reconnecting: 'fa-arrows-rotate',
      reconnected: 'fa-circle-check',
      error: 'fa-triangle-exclamation'
    };

    const shouldShowRetry = state === 'error';
    banner.className = `connection-status-banner visible ${state}`;
    banner.innerHTML = `
      <i class="fas ${icons[state] || 'fa-circle-info'}"></i>
      <span>${message}</span>
      ${shouldShowRetry ? '<button type="button" class="connection-retry-btn" id="connection-retry-btn">Tap to retry now</button>' : ''}
    `;

    if (shouldShowRetry) {
      const retryButton = banner.querySelector('#connection-retry-btn');
      if (retryButton) {
        retryButton.addEventListener('click', () => this.retryConnectionNow());
      }
    }
  }

  hideConnectionBanner() {
    const banner = document.getElementById('connection-status-banner');
    if (!banner) return;

    banner.classList.remove('visible', 'reconnecting', 'reconnected', 'error');
    banner.textContent = '';
  }

  showConnectionToast(state, message, durationMs = 2000) {
    const toast = document.getElementById('connection-status-toast');
    if (!toast) return;

    const icons = {
      reconnecting: 'fa-arrows-rotate fa-spin',
      reconnected: 'fa-circle-check',
      error: 'fa-triangle-exclamation'
    };

    if (this.connectionToastTimer) {
      clearTimeout(this.connectionToastTimer);
      this.connectionToastTimer = null;
    }

    toast.className = `connection-status-toast visible ${state}`;
    toast.innerHTML = `<i class="fas ${icons[state] || 'fa-circle-info'}"></i><span>${message}</span>`;

    this.connectionToastTimer = setTimeout(() => {
      toast.classList.remove('visible', 'reconnecting', 'reconnected', 'error');
      toast.textContent = '';
      this.connectionToastTimer = null;
    }, durationMs);
  }

  hasMemberInteractionPermission() {
    if (this.isHost) {
      return true;
    }

    if (this.roomSettings.memberPermissionMode !== 'selected') {
      return true;
    }

    if (!this.memberId) {
      return false;
    }

    const permittedMemberIds = Array.isArray(this.roomSettings.permittedMemberIds)
      ? this.roomSettings.permittedMemberIds.map(id => id.toString())
      : [];

    return permittedMemberIds.includes(this.memberId.toString());
  }

  updateHostControls() {
    const settingsButton = document.getElementById('open-settings-btn');
    if (settingsButton) {
      settingsButton.style.display = this.isHost ? 'inline-flex' : 'none';
    }

    const waitingPanel = document.getElementById('waiting-room-panel');
    if (waitingPanel && !this.isHost) {
      waitingPanel.style.display = 'none';
    }

    this.renderWaitingRoomList();
  }

  showWaitingApprovalModal(message) {
    const modal = document.getElementById('waiting-approval-modal');
    const messageNode = document.getElementById('waiting-approval-message');
    if (messageNode) {
      messageNode.textContent = message || 'Your request to join this room is pending approval.';
    }

    if (modal) {
      modal.style.display = 'flex';
    }
  }

  hideWaitingApprovalModal() {
    const modal = document.getElementById('waiting-approval-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  setWaitingParticipants(waitingParticipants) {
    this.waitingParticipants.clear();

    (waitingParticipants || []).forEach(participant => {
      const participantId = participant?.userId || participant?.peerId;
      if (!participantId) {
        return;
      }

      this.waitingParticipants.set(participantId.toString(), {
        ...participant,
        userId: participant.userId ? participant.userId.toString() : participantId.toString()
      });
    });

    this.renderWaitingRoomList();
  }

  renderWaitingRoomList() {
    const waitingPanel = document.getElementById('waiting-room-panel');
    const waitingList = document.getElementById('waiting-room-list');
    if (!waitingPanel || !waitingList) {
      return;
    }

    if (!this.isHost) {
      waitingPanel.style.display = 'none';
      waitingList.innerHTML = '';
      return;
    }

    waitingPanel.style.display = 'block';

    if (this.waitingParticipants.size === 0) {
      waitingList.innerHTML = '<div class="waiting-room-item"><span class="name">No one is waiting right now.</span></div>';
      return;
    }

    const waitingRows = Array.from(this.waitingParticipants.values()).map(participant => {
      const participantId = (participant.userId || '').toString();
      const displayName = participant.name || participant.displayName || 'Participant';
      return `
        <div class="waiting-room-item" id="waiting-${participantId}">
          <span class="name">${displayName}</span>
          <div class="waiting-room-actions">
            <button class="waiting-action-btn approve" data-decision="approve" data-target-user-id="${participantId}">Approve</button>
            <button class="waiting-action-btn reject" data-decision="reject" data-target-user-id="${participantId}">Reject</button>
          </div>
        </div>
      `;
    });

    waitingList.innerHTML = waitingRows.join('');
  }

  sendWaitingRoomDecision(targetUserId, decision) {
    if (!this.isHost || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'waiting_room_decision',
      roomCode: this.roomCode,
      targetUserId,
      decision
    }));
  }

  sendModerationAction(action, targetUserId) {
    if (!this.isHost || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'moderation_action',
      roomCode: this.roomCode,
      action,
      targetUserId
    }));
  }

  openRoomSettingsModal() {
    if (!this.isHost) {
      return;
    }

    const modal = document.getElementById('room-settings-modal');
    if (!modal) {
      return;
    }

    const allowChatInput = document.getElementById('setting-allow-chat');
    const allowScreenShareInput = document.getElementById('setting-allow-screen-share');
    const allowHandRaiseInput = document.getElementById('setting-allow-hand-raise');
    const requireApprovalInput = document.getElementById('setting-require-approval');
    const allowRecordingInput = document.getElementById('setting-allow-recording');

    if (allowChatInput) allowChatInput.checked = !!this.roomSettings.allowChat;
    if (allowScreenShareInput) allowScreenShareInput.checked = !!this.roomSettings.allowScreenShare;
    if (allowHandRaiseInput) allowHandRaiseInput.checked = !!this.roomSettings.allowHandRaise;
    if (requireApprovalInput) requireApprovalInput.checked = !!this.roomSettings.requireApproval;
    if (allowRecordingInput) allowRecordingInput.checked = !!this.roomSettings.allowRecording;

    const mode = this.roomSettings.memberPermissionMode === 'selected' ? 'selected' : 'all';
    const modeInput = document.querySelector(`input[name="member-permission-mode"][value="${mode}"]`);
    if (modeInput) {
      modeInput.checked = true;
    }

    this.renderMemberPermissionList();
    modal.style.display = 'flex';
  }

  closeRoomSettingsModal() {
    const modal = document.getElementById('room-settings-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  renderMemberPermissionList() {
    const list = document.getElementById('settings-member-permissions-list');
    const wrap = document.getElementById('settings-member-permissions-wrap');
    if (!list || !wrap) {
      return;
    }

    const selectedModeInput = document.querySelector('input[name="member-permission-mode"]:checked');
    const mode = selectedModeInput?.value === 'selected' ? 'selected' : 'all';
    wrap.style.display = mode === 'selected' ? 'block' : 'none';

    if (mode !== 'selected') {
      return;
    }

    const selectedIds = new Set(
      Array.isArray(this.roomSettings.permittedMemberIds)
        ? this.roomSettings.permittedMemberIds.map(id => id.toString())
        : []
    );

    const memberRows = Array.from(this.participants.values())
      .filter(participant => {
        const participantId = participant.userId || participant.peerId;
        return participantId && participantId !== this.memberId;
      })
      .map(participant => {
        const participantId = (participant.userId || participant.peerId).toString();
        const isChecked = selectedIds.has(participantId) ? 'checked' : '';
        const name = participant.displayName || participant.name || 'Participant';
        return `
          <label class="member-permission-row">
            <input type="checkbox" class="member-permission-checkbox" value="${participantId}" ${isChecked}>
            <span>${name}</span>
          </label>
        `;
      });

    list.innerHTML = memberRows.length
      ? memberRows.join('')
      : '<p class="member-permission-empty">No members available yet.</p>';
  }

  collectRoomSettingsPayload() {
    const allowChat = !!document.getElementById('setting-allow-chat')?.checked;
    const allowScreenShare = !!document.getElementById('setting-allow-screen-share')?.checked;
    const allowHandRaise = !!document.getElementById('setting-allow-hand-raise')?.checked;
    const requireApproval = !!document.getElementById('setting-require-approval')?.checked;
    const allowRecording = !!document.getElementById('setting-allow-recording')?.checked;

    const selectedModeInput = document.querySelector('input[name="member-permission-mode"]:checked');
    const memberPermissionMode = selectedModeInput?.value === 'selected' ? 'selected' : 'all';

    const permittedMemberIds = memberPermissionMode === 'selected'
      ? Array.from(document.querySelectorAll('.member-permission-checkbox:checked')).map(input => input.value)
      : [];

    return {
      allowChat,
      allowScreenShare,
      allowHandRaise,
      requireApproval,
      allowRecording,
      memberPermissionMode,
      permittedMemberIds
    };
  }

  saveRoomSettings() {
    if (!this.isHost) {
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      alert('Connection is not available right now. Please retry in a moment.');
      return;
    }

    const settings = this.collectRoomSettingsPayload();

    this.ws.send(JSON.stringify({
      type: 'room_settings_update',
      roomCode: this.roomCode,
      settings
    }));

    this.closeRoomSettingsModal();
  }

  applyRoomSettings(settings) {
    this.roomSettings = {
      ...this.roomSettings,
      ...(settings || {}),
      memberPermissionMode: settings?.memberPermissionMode === 'selected' ? 'selected' : 'all',
      permittedMemberIds: Array.isArray(settings?.permittedMemberIds)
        ? settings.permittedMemberIds.map(id => id.toString())
        : []
    };

    const hasMemberPermission = this.hasMemberInteractionPermission();

    const chatInput = document.getElementById('chat-input');
    const chatButton = document.getElementById('send-chat-btn');
    const screenButton = document.getElementById('toggle-screen');
    const handButton = document.getElementById('raise-hand');
    const recordingButton = document.getElementById('toggle-recording');

    if (chatInput) {
      chatInput.disabled = !(this.roomSettings.allowChat && hasMemberPermission);
      if (!this.roomSettings.allowChat) {
        chatInput.placeholder = 'Chat is disabled by host settings';
      } else if (!hasMemberPermission) {
        chatInput.placeholder = 'Host restricted your interaction permissions';
      } else {
        chatInput.placeholder = 'Type a message...';
      }
    }

    if (chatButton) {
      chatButton.disabled = !(this.roomSettings.allowChat && hasMemberPermission);
    }

    if (screenButton) {
      const canUseScreenShare = this.roomSettings.allowScreenShare && hasMemberPermission;
      screenButton.disabled = !canUseScreenShare;
      screenButton.classList.toggle('disabled', !canUseScreenShare);
    }

    if (handButton) {
      const canUseHandRaise = this.roomSettings.allowHandRaise && hasMemberPermission;
      handButton.disabled = !canUseHandRaise;
      handButton.classList.toggle('disabled', !canUseHandRaise);
    }

    if (recordingButton) {
      const canControlRecording = this.isHost && this.roomSettings.allowRecording;
      const isSettingsDisabledForHost = this.isHost && !this.roomSettings.allowRecording;

      // Keep the host/settings-disabled state hoverable so the tooltip can explain why recording is unavailable.
      recordingButton.disabled = !canControlRecording && !isSettingsDisabledForHost;
      recordingButton.classList.toggle('disabled', !canControlRecording);

      if (isSettingsDisabledForHost) {
        recordingButton.title = 'Recording disabled by room settings';
      } else if (!this.isHost) {
        recordingButton.title = 'Only host can control recording';
      } else {
        recordingButton.title = this.isRecording ? 'Stop recording' : 'Toggle recording';
      }
    }

    if (!this.roomSettings.allowScreenShare && this.isScreenSharing) {
      this.stopScreenShare();
    }

    if (!hasMemberPermission && this.isScreenSharing) {
      this.stopScreenShare();
    }

    if (!this.roomSettings.allowHandRaise && this.isHandRaised) {
      this.isHandRaised = false;
      this.updateControlButtons();
    }

    if (!hasMemberPermission && this.isHandRaised) {
      this.isHandRaised = false;
      this.updateControlButtons();
    }

    if (this.isHost) {
      this.renderMemberPermissionList();
    }

    if (this.roomSettings.muteOnEntry && this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack && audioTrack.enabled) {
        audioTrack.enabled = false;
        this.isAudioOn = false;
        this.updateControlButtons();
        this.sendParticipantUpdate();
      }
    }
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'authentication_success':
        this.isWsAuthenticated = true;
        if (!this.hasJoinedApi || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          break;
        }

        this.ws.send(JSON.stringify({
          type: 'join_video_room',
          roomCode: this.roomCode,
          peerId: this.userId
        }));
        break;

      case 'authentication_error':
        this.intentionalDisconnect = true;
        this.setConnectionBanner('error', data.message || 'Authentication failed for video room access.');
        this.showConnectionToast('error', 'Reconnection failed', 2200);
        alert(data.message || 'Authentication failed for video room access.');
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }
        window.location.href = localStorage.getItem('mentorToken')
          ? 'mentorMain.html'
          : '../Dashboards/groups.html';
        break;

      case 'room_joined':
        document.getElementById('loading-overlay').style.display = 'none';
        this.waitingForApproval = false;
        this.hideWaitingApprovalModal();
        this.hideConnectionBanner();
        if (this.pendingReconnectNotice) {
          this.showConnectionToast('reconnected', 'Reconnected', 1800);
          this.pendingReconnectNotice = false;
        }
        this.updateHostControls();
        this.applyRoomSettings(data.roomSettings);
        this.setWaitingParticipants(data.waitingParticipants || []);
        if (!this.sessionStartTime) {
          this.startTimer();
        }
        console.log('Joined room with participants:', data.participants);
        this.participants.clear();
        const participantsList = document.getElementById('participants-list');
        if (participantsList) {
          participantsList.innerHTML = '';
        }

        data.participants.forEach(participant => {
          this.addParticipantToUI(participant);
          if (participant.peerId && participant.peerId !== this.userId && !this.connections.has(participant.peerId)) {
            this.callPeer(participant.peerId, participant.userId);
          }
        });
        break;

      case 'waiting_room_pending':
        this.waitingForApproval = true;
        document.getElementById('loading-overlay').style.display = 'none';
        this.showWaitingApprovalModal(data.message || 'Waiting for host approval.');
        break;

      case 'waiting_room_approved':
        this.waitingForApproval = false;
        this.hideWaitingApprovalModal();
        this.showConnectionToast('reconnected', 'Host approved your request', 1600);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'join_video_room',
            roomCode: this.roomCode,
            peerId: this.userId
          }));
        }
        break;

      case 'waiting_room_rejected':
        this.waitingForApproval = false;
        this.hideWaitingApprovalModal();
        alert(data.message || 'Host declined your request to join this room.');
        this.leaveRoomViaApi().finally(() => {
          const isMentor = localStorage.getItem('mentorToken');
          window.location.href = isMentor ? 'mentorMain.html' : '../Dashboards/groups.html';
        });
        break;

      case 'waiting_room_queue':
        if (this.isHost) {
          this.setWaitingParticipants(data.waitingParticipants || []);
        }
        break;

      case 'waiting_room_decision_ack':
        if (this.isHost && data?.targetUserId) {
          this.waitingParticipants.delete(data.targetUserId.toString());
          this.renderWaitingRoomList();
        }
        break;

      case 'room_settings_updated':
        this.applyRoomSettings(data.roomSettings || {});
        this.showConnectionToast('reconnected', 'Room settings updated', 1400);
        break;

      case 'participant_joined':
        console.log('Participant joined:', data.participant);
        this.addParticipantToUI(data.participant);
        if (data.participant?.peerId && data.participant.peerId !== this.userId && !this.connections.has(data.participant.peerId)) {
          this.callPeer(data.participant.peerId, data.participant.userId);
        }
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

      case 'screen_share_update':
        this.updateParticipantStatus({
          participantId: data.participantId,
          connectionInfo: {
            isScreenSharing: data.isSharing
          }
        });
        break;

      case 'recording_update':
        this.isRecording = !!data.isRecording;
        this.updateControlButtons();
        this.handleRecordingStateChange(this.isRecording);
        this.showConnectionToast('reconnected', this.isRecording ? 'Recording started' : 'Recording stopped', 1400);
        break;

      case 'moderation_action':
        this.applyModerationAction(data);
        break;

      case 'moderation_action_ack':
        this.showConnectionToast('reconnected', 'Moderation action applied', 1200);
        break;

      case 'error':
        console.error('Room error:', data.message);
        break;
    }
  }

  callPeer(peerId, participantId) {
    if (!this.peer || !this.localStream) return;
    if (this.connections.has(peerId)) return;

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
    if (!this.hasMemberInteractionPermission()) {
      alert('Host has restricted your room interaction permissions.');
      return;
    }

    if (!this.roomSettings.allowScreenShare) {
      alert('Screen sharing is disabled for this room.');
      return;
    }

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
        this.sendParticipantUpdate();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'screen_share',
            roomCode: this.roomCode,
            isSharing: true
          }));
        }

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
    this.sendParticipantUpdate();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'screen_share',
        roomCode: this.roomCode,
        isSharing: false
      }));
    }
  }

  toggleRaiseHand() {
    if (!this.hasMemberInteractionPermission()) {
      alert('Host has restricted your room interaction permissions.');
      return;
    }

    if (!this.roomSettings.allowHandRaise) {
      alert('Raise hand is disabled for this room.');
      return;
    }

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

    if (!this.roomSettings.allowChat) {
      alert('Chat is disabled for this room.');
      return;
    }

    if (!this.hasMemberInteractionPermission()) {
      alert('Host has restricted your room interaction permissions.');
      return;
    }
    
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
    const recordingBtn = document.getElementById('toggle-recording');

    videoBtn.classList.toggle('off', !this.isVideoOn);
    videoBtn.querySelector('i').className = this.isVideoOn ? 'fas fa-video' : 'fas fa-video-slash';

    audioBtn.classList.toggle('off', !this.isAudioOn);
    audioBtn.querySelector('i').className = this.isAudioOn ? 'fas fa-microphone' : 'fas fa-microphone-slash';

    screenBtn.classList.toggle('active', this.isScreenSharing);
    handBtn.classList.toggle('active', this.isHandRaised);

    if (recordingBtn) {
      recordingBtn.classList.toggle('recording', this.isRecording);
      recordingBtn.classList.toggle('active', this.isRecording);

      const icon = recordingBtn.querySelector('i');
      if (icon) {
        icon.className = this.isRecording ? 'fas fa-stop-circle' : 'fas fa-record-vinyl';
      }

      const label = recordingBtn.querySelector('span');
      if (label) {
        label.textContent = this.isRecording ? 'Stop Rec' : 'Record';
      }
    }
  }

  toggleRecording() {
    if (!this.isHost) {
      alert('Only host can control recording.');
      return;
    }

    if (!this.roomSettings.allowRecording) {
      alert('Recording is disabled for this room.');
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      alert('Connection is not available right now.');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'recording_update',
      roomCode: this.roomCode,
      isRecording: !this.isRecording
    }));
  }

  applyModerationAction(data) {
    const action = (data?.action || '').toString().toLowerCase();
    if (!action) {
      return;
    }

    if (action === 'kick') {
      alert(data.message || 'Host removed you from the room.');
      this.leaveRoomViaApi().finally(() => {
        const isMentor = localStorage.getItem('mentorToken');
        window.location.href = isMentor ? 'mentorMain.html' : '../Dashboards/groups.html';
      });
      return;
    }

    if (!this.localStream) {
      return;
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    const videoTrack = this.localStream.getVideoTracks()[0];

    if (action === 'mute_audio' && audioTrack) {
      audioTrack.enabled = false;
      this.isAudioOn = false;
    }

    if (action === 'unmute_audio' && audioTrack) {
      audioTrack.enabled = true;
      this.isAudioOn = true;
    }

    if (action === 'mute_video' && videoTrack) {
      videoTrack.enabled = false;
      this.isVideoOn = false;
    }

    if (action === 'unmute_video' && videoTrack) {
      videoTrack.enabled = true;
      this.isVideoOn = true;
    }

    this.updateControlButtons();
    this.sendParticipantUpdate();
  }

  async handleRecordingStateChange(isRecording) {
    if (!this.isHost) {
      return;
    }

    if (isRecording) {
      this.startRecordingCapture();
      return;
    }

    await this.stopRecordingCapture();
  }

  startRecordingCapture() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      this.showConnectionToast('error', 'Recording is not supported in this browser', 2200);
      return;
    }

    if (!this.localStream) {
      return;
    }

    const sourceTracks = [
      ...this.localStream.getVideoTracks(),
      ...this.localStream.getAudioTracks()
    ];

    if (sourceTracks.length === 0) {
      return;
    }

    const clonedTracks = sourceTracks.map(track => track.clone());
    this.recordingStream = new MediaStream(clonedTracks);

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];

    const preferredMimeType = mimeTypes.find(mimeType => {
      try {
        return MediaRecorder.isTypeSupported(mimeType);
      } catch (err) {
        return false;
      }
    }) || '';

    const recorder = preferredMimeType
      ? new MediaRecorder(this.recordingStream, { mimeType: preferredMimeType })
      : new MediaRecorder(this.recordingStream);

    this.mediaRecorder = recorder;
    this.recordedChunks = [];
    this.recordingStartedAt = new Date();

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const chunks = [...this.recordedChunks];
      const startedAt = this.recordingStartedAt;
      const endedAt = new Date();
      const recorderMimeType = recorder.mimeType || 'video/webm';

      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.recordingStartedAt = null;

      if (this.recordingStream) {
        this.recordingStream.getTracks().forEach(track => track.stop());
        this.recordingStream = null;
      }

      await this.uploadRecordingFile(chunks, recorderMimeType, startedAt, endedAt);
    };

    recorder.start(1000);
  }

  async stopRecordingCapture() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      return;
    }

    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
  }

  async uploadRecordingFile(chunks, mimeType, startedAt, endedAt) {
    if (this.recordingUploadInProgress) {
      return;
    }

    if (!chunks || chunks.length === 0) {
      return;
    }

    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    if (!blob.size) {
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      return;
    }

    this.recordingUploadInProgress = true;
    try {
      const extension = (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      const fileName = `room-${this.roomCode}-${Date.now()}.${extension}`;
      const formData = new FormData();
      formData.append('recording', blob, fileName);
      if (startedAt) {
        formData.append('startedAt', startedAt.toISOString());
      }
      if (endedAt) {
        formData.append('endedAt', endedAt.toISOString());
      }

      const response = await fetch(`${window.location.origin}/api/video-rooms/${encodeURIComponent(this.roomCode)}/recordings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        this.showConnectionToast('error', payload?.message || 'Recording upload failed', 2200);
        return;
      }

      this.latestRecordingUrl = payload.recordingUrl || null;
      this.showConnectionToast('reconnected', 'Recording saved', 1600);
    } catch (error) {
      console.error('Failed to upload recording:', error);
      this.showConnectionToast('error', 'Recording upload failed', 2200);
    } finally {
      this.recordingUploadInProgress = false;
    }
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

  getParticipantStatusIcons(connectionInfo = {}) {
    return `
      ${connectionInfo.isVideoOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash text-muted"></i>'}
      ${connectionInfo.isAudioOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash text-muted"></i>'}
    `;
  }

  getParticipantModerationActions(participantId, connectionInfo = {}) {
    if (!this.isHost || participantId === this.memberId) {
      return '';
    }

    const audioAction = connectionInfo.isAudioOn ? 'mute_audio' : 'unmute_audio';
    const audioLabel = connectionInfo.isAudioOn ? 'Mute Mic' : 'Unmute Mic';
    const videoAction = connectionInfo.isVideoOn ? 'mute_video' : 'unmute_video';
    const videoLabel = connectionInfo.isVideoOn ? 'Hide Video' : 'Unhide Video';

    return `
      <div class="participant-actions">
        <button class="participant-action-btn" data-action="${audioAction}" data-target-user-id="${participantId}">${audioLabel}</button>
        <button class="participant-action-btn" data-action="${videoAction}" data-target-user-id="${participantId}">${videoLabel}</button>
        <button class="participant-action-btn kick" data-action="kick" data-target-user-id="${participantId}">Remove</button>
      </div>
    `;
  }

  addParticipantToUI(participant) {
    const list = document.getElementById('participants-list');
    const participantKey = participant.userId || participant.peerId;
    if (!participantKey) return;

    this.participants.set(participantKey, {
      ...(this.participants.get(participantKey) || {}),
      ...participant,
      userId: participant.userId || participantKey
    });

    let item = document.getElementById(`participant-${participantKey}`);
    if (!item) {
      item = document.createElement('div');
      item.className = 'participant-item';
      item.id = `participant-${participantKey}`;
      list.appendChild(item);
    }

    const participantData = this.participants.get(participantKey) || participant;
    const participantName = participantData.displayName || participantData.name || 'Participant';
    const statusIcons = this.getParticipantStatusIcons(participantData.connectionInfo || {});
    const moderationActions = this.getParticipantModerationActions(participantKey, participantData.connectionInfo || {});

    item.dataset.peerId = participantData.peerId || '';
    item.innerHTML = `
      <div class="participant-main">
        <div class="participant-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="participant-info">
          <span class="name">${participantName}</span>
          <div class="status-icons">${statusIcons}</div>
        </div>
      </div>
      ${moderationActions}
    `;
    item.classList.toggle('hand-raised', !!participantData.connectionInfo?.isHandRaised);

    if (this.isHost) {
      this.renderMemberPermissionList();
    }
  }

  removeParticipant(participantId) {
    let item = document.getElementById(`participant-${participantId}`);
    if (!item) {
      item = document.querySelector(`.participant-item[data-peer-id="${participantId}"]`);
    }

    const peerId = item?.dataset.peerId || participantId;
    this.participants.delete(participantId);
    if (peerId && peerId !== participantId) {
      this.participants.delete(peerId);
    }
    if (item) item.remove();

    this.removeRemoteVideo(participantId);
    if (peerId !== participantId) {
      this.removeRemoteVideo(peerId);
    }
    
    const connection = this.connections.get(participantId) || this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(participantId);
      if (peerId !== participantId) {
        this.connections.delete(peerId);
      }
    }

    if (this.isHost) {
      this.renderMemberPermissionList();
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
    const existingParticipant = this.participants.get(data.participantId);
    if (existingParticipant && data.connectionInfo) {
      this.participants.set(data.participantId, {
        ...existingParticipant,
        connectionInfo: {
          ...(existingParticipant.connectionInfo || {}),
          ...data.connectionInfo
        }
      });
    }

    const updatedParticipant = this.participants.get(data.participantId);
    if (updatedParticipant) {
      this.addParticipantToUI(updatedParticipant);
    }

    const participantItem = document.getElementById(`participant-${data.participantId}`);
    if (participantItem && data.connectionInfo && data.connectionInfo.isHandRaised !== undefined) {
      participantItem.classList.toggle('hand-raised', !!data.connectionInfo.isHandRaised);
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

  async leaveRoom() {
    if (!confirm('Are you sure you want to leave the room?')) return;
    this.intentionalDisconnect = true;
    this.pendingReconnectNotice = false;
    this.hideConnectionBanner();

    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }

    if (this.connectionToastTimer) {
      clearTimeout(this.connectionToastTimer);
      this.connectionToastTimer = null;
    }

    await this.stopRecordingCapture();

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

    await this.leaveRoomViaApi();

    // Redirect back
    const isMentor = localStorage.getItem('mentorToken');
    window.location.href = isMentor ? 'mentorMain.html' : '../Dashboards/groups.html';
  }

  async leaveRoomViaApi() {
    if (!this.hasJoinedApi) {
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      return;
    }

    try {
      await fetch(`${window.location.origin}/api/video-rooms/${encodeURIComponent(this.roomCode)}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error('Failed to leave room via API:', err);
    }
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new VideoRoom();
});
