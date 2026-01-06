
const mongoose = require('mongoose');

// Member activity schema for tracking user activity within a group
const memberActivitySchema = new mongoose.Schema({
  action: { 
    type: String, 
    enum: ['joined', 'left', 'message', 'file_upload', 'session_created', 'session_joined'],
    required: true 
  },
  description: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// Group member schema with status tracking
const groupMemberSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  name: { type: String, required: true },
  email: { type: String },
  avatar: { type: String },
  role: { 
    type: String, 
    enum: ['admin', 'moderator', 'member'], 
    default: 'member' 
  },
  status: { 
    type: String, 
    enum: ['online', 'offline', 'away'], 
    default: 'offline' 
  },
  joinedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  lastSeen: { type: Date },
  messageCount: { type: Number, default: 0 },
  activity: [memberActivitySchema]
});

// Main Group schema
const GroupSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  status: { 
    type: String, 
    enum: ['active', 'pending', 'inactive', 'archived'], 
    default: 'active' 
  },
  category: { 
    type: String,
    default: 'General'
  },
  // Group creator/owner
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  // All group members with their details
  members: [groupMemberSchema],
  // Group settings
  settings: {
    isPublic: { type: Boolean, default: true },
    allowInvites: { type: Boolean, default: true },
    maxMembers: { type: Number, default: 50 },
    requireApproval: { type: Boolean, default: false }
  },
  // Statistics
  stats: {
    totalMessages: { type: Number, default: 0 },
    totalFiles: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 }
  },
  // Recent activity feed
  recentActivity: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    action: String,
    description: String,
    timestamp: { type: Date, default: Date.now }
  }],
  // Group progress tracking
  progress: {
    percentage: { type: Number, default: 0 },
    milestones: [{
      title: String,
      status: { type: String, enum: ['completed', 'current', 'upcoming'], default: 'upcoming' },
      completedAt: Date
    }]
  }
}, { 
  timestamps: true 
});

// Virtual for active members count
GroupSchema.virtual('activeMembers').get(function() {
  if (!this.members || !Array.isArray(this.members)) return 0;
  return this.members.filter(m => m.status === 'online' || m.status === 'away').length;
});

// Virtual for total members count
GroupSchema.virtual('totalMembers').get(function() {
  if (!this.members || !Array.isArray(this.members)) return 0;
  return this.members.length;
});

// Method to add a member to the group
GroupSchema.methods.addMember = async function(userId, name, email, role = 'member') {
  // Check if already a member
  const existingMember = this.members.find(m => m.userId.toString() === userId.toString());
  if (existingMember) {
    return { success: false, message: 'User is already a member' };
  }

  // Check max members
  if (this.members.length >= this.settings.maxMembers) {
    return { success: false, message: 'Group has reached maximum members' };
  }

  this.members.push({
    userId,
    name,
    email,
    role,
    status: 'online',
    joinedAt: new Date(),
    lastActive: new Date(),
    activity: [{
      action: 'joined',
      description: `${name} joined the group`,
      timestamp: new Date()
    }]
  });

  // Add to recent activity
  this.recentActivity.unshift({
    userId,
    userName: name,
    action: 'joined',
    description: `${name} joined the group`,
    timestamp: new Date()
  });

  // Keep only last 50 activities
  if (this.recentActivity.length > 50) {
    this.recentActivity = this.recentActivity.slice(0, 50);
  }

  await this.save();
  return { success: true, message: 'Member added successfully' };
};

// Method to remove a member
GroupSchema.methods.removeMember = async function(userId) {
  const memberIndex = this.members.findIndex(m => m.userId.toString() === userId.toString());
  if (memberIndex === -1) {
    return { success: false, message: 'User is not a member' };
  }

  const member = this.members[memberIndex];
  this.members.splice(memberIndex, 1);

  // Add to recent activity
  this.recentActivity.unshift({
    userId,
    userName: member.name,
    action: 'left',
    description: `${member.name} left the group`,
    timestamp: new Date()
  });

  await this.save();
  return { success: true, message: 'Member removed successfully' };
};

// Method to update member status
GroupSchema.methods.updateMemberStatus = async function(userId, status) {
  const member = this.members.find(m => m.userId.toString() === userId.toString());
  if (member) {
    member.status = status;
    member.lastActive = new Date();
    if (status === 'offline') {
      member.lastSeen = new Date();
    }
    await this.save();
    return true;
  }
  return false;
};

// Method to record activity
GroupSchema.methods.recordActivity = async function(userId, userName, action, description) {
  // Update member's activity
  const member = this.members.find(m => m.userId.toString() === userId.toString());
  if (member) {
    member.activity.unshift({ action, description, timestamp: new Date() });
    member.lastActive = new Date();
    
    if (action === 'message') {
      member.messageCount += 1;
      this.stats.totalMessages += 1;
    } else if (action === 'file_upload') {
      this.stats.totalFiles += 1;
    } else if (action === 'session_created') {
      this.stats.totalSessions += 1;
    }

    // Keep only last 20 activities per member
    if (member.activity.length > 20) {
      member.activity = member.activity.slice(0, 20);
    }
  }

  // Add to group's recent activity
  this.recentActivity.unshift({
    userId,
    userName,
    action,
    description,
    timestamp: new Date()
  });

  // Keep only last 50 activities
  if (this.recentActivity.length > 50) {
    this.recentActivity = this.recentActivity.slice(0, 50);
  }

  await this.save();
};

// Static method to get group with populated member data
GroupSchema.statics.getGroupWithMembers = async function(groupName) {
  return this.findOne({ name: groupName })
    .populate('members.userId', 'fullname email avatar lastActive')
    .populate('createdBy', 'fullname email');
};

// Ensure virtuals are included in JSON
GroupSchema.set('toJSON', { virtuals: true });
GroupSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Group', GroupSchema);