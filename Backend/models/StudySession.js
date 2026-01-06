const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false // Allow personal sessions without groups
  },
  subject: {
    type: String,
    required: true,
    enum: ['mathematics', 'programming', 'data-science', 'machine-learning', 'web-development', 'algorithms', 'databases', 'other']
  },
  level: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  sessionDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true // Format: "HH:MM"
  },
  endTime: {
    type: String,
    required: true // Calculated based on duration
  },
  duration: {
    type: Number,
    required: true, // Duration in hours
    min: 0.5,
    max: 8
  },
  type: {
    type: String,
    required: true,
    enum: ['group', 'mentor', 'presentation'],
    default: 'group'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  // Mentor-related fields
  mentorRequested: {
    type: Boolean,
    default: false
  },
  assignedMentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    default: null
  },
  preferredMentor: {
    type: String, // Allow string mentor names/IDs
    default: null
  },
  mentorRequirements: {
    type: String,
    maxlength: 500
  },
  expertiseNeeded: [{
    type: String,
    enum: ['debugging', 'code-review', 'architecture', 'best-practices', 'career-guidance', 'project-planning']
  }],
  mentorResponse: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    respondedAt: Date,
    response: String
  },
  // Participants
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['invited', 'confirmed', 'declined', 'attended'],
      default: 'invited'
    },
    joinedAt: Date,
    leftAt: Date
  }],
  // Recurring session settings
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly']
    },
    count: {
      type: Number,
      min: 1,
      max: 50
    },
    currentSession: {
      type: Number,
      default: 1
    }
  },
  parentSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudySession',
    default: null
  },
  childSessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudySession'
  }],
  // Session settings
  settings: {
    record: {
      type: Boolean,
      default: true
    },
    chat: {
      type: Boolean,
      default: true
    },
    screenShare: {
      type: Boolean,
      default: true
    },
    whiteboard: {
      type: Boolean,
      default: false
    },
    breakoutRooms: {
      type: Boolean,
      default: false
    },
    reminders: {
      type: Boolean,
      default: true
    }
  },
  // Session room details
  roomId: {
    type: String,
    unique: true
  },
  roomPassword: {
    type: String
  },
  // Session recording and materials
  recording: {
    url: String,
    duration: Number,
    size: Number
  },
  materials: [{
    name: String,
    url: String,
    type: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    content: String,
    lastModified: Date,
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Notifications
  reminders: [{
    type: {
      type: String,
      enum: ['24h', '1h', '15m']
    },
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date
  }],
  // Activity tracking
  activities: [{
    type: {
      type: String,
      enum: ['created', 'updated', 'started', 'ended', 'participant_joined', 'participant_left', 'mentor_assigned', 'mentor_joined', 'recording_started', 'recording_stopped']
    },
    description: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
studySessionSchema.index({ organizer: 1, sessionDate: 1 });
studySessionSchema.index({ group: 1, sessionDate: 1 });
studySessionSchema.index({ assignedMentor: 1, sessionDate: 1 });
studySessionSchema.index({ status: 1, sessionDate: 1 });
// Note: roomId already has unique:true which creates an index

// Virtual for session duration in milliseconds
studySessionSchema.virtual('durationMs').get(function() {
  return this.duration * 60 * 60 * 1000;
});

// Method to calculate end time
studySessionSchema.methods.calculateEndTime = function() {
  const startDate = new Date(`${this.sessionDate.toISOString().split('T')[0]}T${this.startTime}:00`);
  const endDate = new Date(startDate.getTime() + this.durationMs);
  this.endTime = endDate.toTimeString().slice(0, 5);
  return this.endTime;
};

// Method to generate room ID
studySessionSchema.methods.generateRoomId = function() {
  if (!this.roomId) {
    this.roomId = `session_${this._id}_${Date.now()}`;
  }
  return this.roomId;
};

// Method to add activity
studySessionSchema.methods.addActivity = function(type, description, user, metadata = null) {
  this.activities.push({
    type,
    description,
    user,
    metadata
  });
};

// Static method to find upcoming sessions
studySessionSchema.statics.findUpcoming = function(userId, limit = 10) {
  const now = new Date();
  return this.find({
    $or: [
      { organizer: userId },
      { 'participants.user': userId },
      { assignedMentor: userId }
    ],
    sessionDate: { $gte: now },
    status: { $in: ['scheduled', 'in-progress'] }
  })
  .populate('organizer', 'name email avatar')
  .populate('group', 'name')
  .populate('assignedMentor', 'name email specializations')
  .populate('participants.user', 'name email avatar')
  .sort({ sessionDate: 1, startTime: 1 })
  .limit(limit);
};

// Static method to find sessions by mentor
studySessionSchema.statics.findByMentor = function(mentorId, status = null) {
  const query = { assignedMentor: mentorId };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .populate('organizer', 'name email avatar')
    .populate('group', 'name description')
    .populate('participants.user', 'name email avatar')
    .sort({ sessionDate: 1, startTime: 1 });
};

// Pre-save middleware to calculate end time
studySessionSchema.pre('save', function(next) {
  if (this.isModified('startTime') || this.isModified('duration')) {
    this.calculateEndTime();
  }
  if (this.type === 'mentor') {
    this.mentorRequested = true;
  }
  next();
});

// Pre-save middleware to generate room ID
studySessionSchema.pre('save', function(next) {
  if (this.isNew) {
    this.generateRoomId();
  }
  next();
});

module.exports = mongoose.model('StudySession', studySessionSchema);
