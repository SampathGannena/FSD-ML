const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  peerId: { type: String },
  role: { type: String, enum: ['host', 'participant'], default: 'participant' },
  connectionInfo: {
    isVideoOn: { type: Boolean, default: true },
    isAudioOn: { type: Boolean, default: true },
    isScreenSharing: { type: Boolean, default: false },
    isHandRaised: { type: Boolean, default: false }
  },
  userId: { type: mongoose.Schema.Types.ObjectId, refPath: 'participants.userType' },
  userType: { type: String, enum: ['User', 'Mentor'], default: 'User' }
});

const chatMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderName: { type: String, required: true },
  senderType: { type: String, enum: ['host', 'participant'], default: 'participant' },
  message: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  recipientId: { type: mongoose.Schema.Types.ObjectId },
  timestamp: { type: Date, default: Date.now }
});

const videoRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'hostType',
    required: true
  },
  hostType: {
    type: String,
    enum: ['User', 'Mentor'],
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudySession'
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting'
  },
  participants: [participantSchema],
  maxParticipants: {
    type: Number,
    default: 50
  },
  settings: {
    allowChat: { type: Boolean, default: true },
    allowScreenShare: { type: Boolean, default: true },
    allowRecording: { type: Boolean, default: false },
    muteOnEntry: { type: Boolean, default: false },
    requireApproval: { type: Boolean, default: false },
    allowHandRaise: { type: Boolean, default: true }
  },
  chatMessages: [chatMessageSchema],
  isRecording: { type: Boolean, default: false },
  recordingUrl: { type: String },
  startedAt: { type: Date },
  endedAt: { type: Date },
  duration: { type: Number }, // in minutes
  password: { type: String }
}, {
  timestamps: true
});

// Generate unique room code
videoRoomSchema.statics.generateRoomCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Add participant to room
videoRoomSchema.methods.addParticipant = async function(participantData) {
  const existingParticipant = this.participants.find(
    p => p.userId && p.userId.toString() === participantData.userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push(participantData);
    await this.save();
  }
  return this;
};

// Remove participant from room
videoRoomSchema.methods.removeParticipant = async function(userId) {
  this.participants = this.participants.filter(
    p => !p.userId || p.userId.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Update participant connection info
videoRoomSchema.methods.updateParticipantConnection = async function(userId, connectionInfo) {
  const participant = this.participants.find(
    p => p.userId && p.userId.toString() === userId.toString()
  );
  
  if (participant) {
    participant.connectionInfo = { ...participant.connectionInfo, ...connectionInfo };
    await this.save();
  }
  return this;
};

// Add chat message
videoRoomSchema.methods.addChatMessage = async function(messageData) {
  this.chatMessages.push(messageData);
  await this.save();
  return this;
};

// Start room
videoRoomSchema.methods.startRoom = async function() {
  this.status = 'active';
  this.startedAt = new Date();
  await this.save();
  return this;
};

// End room
videoRoomSchema.methods.endRoom = async function() {
  this.status = 'ended';
  this.endedAt = new Date();
  if (this.startedAt) {
    this.duration = Math.round((this.endedAt - this.startedAt) / 60000); // minutes
  }
  await this.save();
  return this;
};

module.exports = mongoose.model('VideoRoom', videoRoomSchema);
