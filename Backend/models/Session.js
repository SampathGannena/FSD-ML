const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    required: true,
    index: true
  },
  menteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  menteeName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['one-on-one', 'group', 'workshop', 'code-review', 'career-guidance', 'project-discussion', 'other'],
    default: 'one-on-one'
  },
  mode: {
    type: String,
    enum: ['video-call', 'audio-call', 'chat', 'in-person', 'screen-share'],
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    default: 60
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'rescheduled', 'no-show'],
    default: 'scheduled',
    index: true
  },
  meetingLink: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  agenda: [{
    item: String,
    completed: {
      type: Boolean,
      default: false
    }
  }],
  notes: {
    type: String
  },
  outcomes: {
    type: String
  },
  resources: [{
    name: String,
    url: String,
    type: String // 'link', 'document', 'video', 'code'
  }],
  feedback: {
    mentorFeedback: String,
    menteeFeedback: String,
    mentorRating: {
      type: Number,
      min: 0,
      max: 5
    },
    menteeRating: {
      type: Number,
      min: 0,
      max: 5
    },
    mentorComment: String,
    menteeComment: String,
    submittedAt: Date
  },
  reminders: {
    mentorReminded: {
      type: Boolean,
      default: false
    },
    menteeReminded: {
      type: Boolean,
      default: false
    },
    reminderSentAt: Date
  },
  actualStartTime: Date,
  actualEndTime: Date,
  recordingUrl: String,
  tags: [String]
}, {
  timestamps: true
});

// Indexes for efficient queries
sessionSchema.index({ mentorId: 1, scheduledDate: 1 });
sessionSchema.index({ menteeId: 1, scheduledDate: 1 });
sessionSchema.index({ status: 1, scheduledDate: 1 });

// Virtual for actual duration
sessionSchema.virtual('actualDuration').get(function() {
  if (this.actualStartTime && this.actualEndTime) {
    return Math.round((this.actualEndTime - this.actualStartTime) / (1000 * 60));
  }
  return null;
});

// Virtual for session end time
sessionSchema.virtual('scheduledEndTime').get(function() {
  if (this.scheduledDate && this.duration) {
    return new Date(this.scheduledDate.getTime() + (this.duration * 60 * 1000));
  }
  return null;
});

// Methods
sessionSchema.methods.startSession = function() {
  this.status = 'ongoing';
  this.actualStartTime = new Date();
  return this.save();
};

sessionSchema.methods.endSession = function(outcomes, mentorFeedback) {
  this.status = 'completed';
  this.actualEndTime = new Date();
  if (outcomes) this.outcomes = outcomes;
  if (mentorFeedback) this.feedback.mentorFeedback = mentorFeedback;
  return this.save();
};

sessionSchema.methods.cancelSession = function(reason) {
  this.status = 'cancelled';
  if (reason) this.notes = (this.notes || '') + '\nCancellation reason: ' + reason;
  return this.save();
};

sessionSchema.methods.rescheduleSession = function(newDate, newDuration) {
  this.status = 'rescheduled';
  this.scheduledDate = newDate;
  if (newDuration) this.duration = newDuration;
  return this.save();
};

sessionSchema.methods.markAsNoShow = function() {
  this.status = 'no-show';
  this.actualEndTime = new Date();
  return this.save();
};

// Static method to get upcoming sessions
sessionSchema.statics.getUpcomingSessions = function(mentorId) {
  const now = new Date();
  return this.find({
    mentorId,
    scheduledDate: { $gte: now },
    status: { $in: ['scheduled', 'rescheduled'] }
  }).sort({ scheduledDate: 1 });
};

// Static method to get session statistics
sessionSchema.statics.getSessionStats = function(mentorId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        mentorId: mongoose.Types.ObjectId(mentorId),
        scheduledDate: {
          $gte: startDate || new Date(0),
          $lte: endDate || new Date()
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        avgRating: { $avg: '$feedback.menteeRating' }
      }
    }
  ]);
};

// Pre-save middleware to auto-cancel past scheduled sessions
sessionSchema.pre('save', function(next) {
  if (this.status === 'scheduled' && this.scheduledDate < new Date()) {
    const timeDiff = new Date() - this.scheduledDate;
    // If more than 2 hours past scheduled time, mark as no-show
    if (timeDiff > 2 * 60 * 60 * 1000) {
      this.status = 'no-show';
    }
  }
  next();
});

sessionSchema.set('toJSON', { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Session', sessionSchema);
