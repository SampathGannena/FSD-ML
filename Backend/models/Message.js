const mongoose = require('mongoose');

// Reaction schema for message reactions
const reactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  userName: { type: String },
  emoji: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Reply schema for threaded messages
const replySchema = new mongoose.Schema({
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  senderName: { type: String, required: true },
  senderAvatar: { type: String },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  // Reference to the group
  group: { 
    type: String, 
    required: true,
    index: true 
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  
  // Sender information - linked to User model
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
    // Not required - will use senderName for anonymous messages
  },
  senderName: { 
    type: String, 
    required: true,
    default: 'Anonymous'
  },
  senderEmail: { 
    type: String 
  },
  senderAvatar: { 
    type: String,
    default: '' 
  },
  senderRole: {
    type: String,
    enum: ['admin', 'moderator', 'member'],
    default: 'member'
  },
  
  // Message content
  message: { 
    type: String, 
    required: true 
  },
  
  // Message type
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'system', 'announcement', 'poll', 'poll_vote'],
    default: 'text'
  },
  
  // Poll data (for poll messages)
  poll: {
    id: String,
    question: String,
    options: [{
      id: Number,
      text: String,
      votes: [{
        oderId: String,
        voterName: String,
        votedAt: Date
      }],
      voteCount: { type: Number, default: 0 }
    }],
    allowMultiple: { type: Boolean, default: false },
    anonymous: { type: Boolean, default: false },
    createdBy: String,
    createdById: String,
    endsAt: Date,
    totalVotes: { type: Number, default: 0 }
  },
  
  // For file/image messages
  attachment: {
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    url: String
  },
  
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  
  // Read receipts - which members have read this message
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    readAt: { type: Date, default: Date.now }
  }],
  
  // Reactions to the message
  reactions: [reactionSchema],
  
  // Replies/thread
  replies: [replySchema],
  
  // Edit history
  isEdited: { type: Boolean, default: false },
  editHistory: [{
    previousMessage: String,
    editedAt: { type: Date, default: Date.now }
  }],
  
  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Pinned message
  isPinned: { type: Boolean, default: false },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pinnedAt: { type: Date },
  
  // Timestamp
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster queries
MessageSchema.index({ group: 1, timestamp: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ groupId: 1, timestamp: -1 });

// Virtual for formatted time
MessageSchema.virtual('formattedTime').get(function() {
  return this.timestamp.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
});

// Virtual for formatted date
MessageSchema.virtual('formattedDate').get(function() {
  return this.timestamp.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
});

// Method to add a reaction
MessageSchema.methods.addReaction = async function(userId, userName, emoji) {
  // Check if user already reacted with this emoji
  const existingReaction = this.reactions.find(
    r => r.userId.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (existingReaction) {
    // Remove reaction if already exists (toggle)
    this.reactions = this.reactions.filter(
      r => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
    );
  } else {
    this.reactions.push({ userId, userName, emoji });
  }
  
  await this.save();
  return this;
};

// Method to add a reply
MessageSchema.methods.addReply = async function(senderId, senderName, senderAvatar, message) {
  this.replies.push({
    senderId,
    senderName,
    senderAvatar,
    message
  });
  
  await this.save();
  return this;
};

// Method to mark as read
MessageSchema.methods.markAsRead = async function(userId, userName) {
  const alreadyRead = this.readBy.find(
    r => r.userId.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.readBy.push({ userId, userName, readAt: new Date() });
    
    // Update status if all group members have read
    if (this.status !== 'read') {
      this.status = 'read';
    }
    
    await this.save();
  }
  
  return this;
};

// Method to edit message
MessageSchema.methods.editMessage = async function(newMessage) {
  this.editHistory.push({
    previousMessage: this.message,
    editedAt: new Date()
  });
  
  this.message = newMessage;
  this.isEdited = true;
  
  await this.save();
  return this;
};

// Method to soft delete
MessageSchema.methods.softDelete = async function(deletedByUserId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedByUserId;
  
  await this.save();
  return this;
};

// Method to pin/unpin message
MessageSchema.methods.togglePin = async function(userId) {
  this.isPinned = !this.isPinned;
  if (this.isPinned) {
    this.pinnedBy = userId;
    this.pinnedAt = new Date();
  } else {
    this.pinnedBy = null;
    this.pinnedAt = null;
  }
  
  await this.save();
  return this;
};

// Static method to get messages for a group with pagination
MessageSchema.statics.getGroupMessages = async function(groupName, options = {}) {
  const { page = 1, limit = 50, includeDeleted = false } = options;
  
  const query = { group: groupName };
  if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }
  
  const messages = await this.find(query)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('senderId', 'fullname email avatar')
    .lean();
  
  return messages.reverse(); // Return in chronological order
};

// Static method to get pinned messages
MessageSchema.statics.getPinnedMessages = async function(groupName) {
  return this.find({ 
    group: groupName, 
    isPinned: true,
    isDeleted: { $ne: true }
  })
    .sort({ pinnedAt: -1 })
    .populate('senderId', 'fullname email avatar');
};

// Static method to search messages
MessageSchema.statics.searchMessages = async function(groupName, searchTerm) {
  return this.find({
    group: groupName,
    message: { $regex: searchTerm, $options: 'i' },
    isDeleted: { $ne: true }
  })
    .sort({ timestamp: -1 })
    .limit(50)
    .populate('senderId', 'fullname email avatar');
};

// Static method to get message count per member
MessageSchema.statics.getMemberMessageCounts = async function(groupName) {
  return this.aggregate([
    { $match: { group: groupName, isDeleted: { $ne: true } } },
    { $group: { 
      _id: '$senderId',
      senderName: { $first: '$senderName' },
      messageCount: { $sum: 1 },
      lastMessage: { $max: '$timestamp' }
    }},
    { $sort: { messageCount: -1 } }
  ]);
};

// Ensure virtuals are included in JSON
MessageSchema.set('toJSON', { virtuals: true });
MessageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Message', MessageSchema);