const mongoose = require('mongoose');

const doubtSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor'
  },
  mentorName: {
    type: String
  },
  category: {
    type: String,
    enum: ['technical', 'conceptual', 'project', 'career', 'other'],
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'answered', 'closed'],
    default: 'open'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  answer: {
    type: String
  },
  answeredAt: {
    type: Date
  },
  answeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor'
  },
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId
    },
    userName: {
      type: String
    },
    userType: {
      type: String,
      enum: ['student', 'mentor']
    },
    comment: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

// Index for faster queries
doubtSchema.index({ studentId: 1 });
doubtSchema.index({ mentorId: 1 });
doubtSchema.index({ status: 1 });
doubtSchema.index({ isPublic: 1 });

// Method to add comment
doubtSchema.methods.addComment = async function(userId, userName, userType, comment) {
  this.comments.push({
    userId: userId,
    userName: userName,
    userType: userType,
    comment: comment,
    timestamp: new Date()
  });
  return await this.save();
};

// Method to mark as answered
doubtSchema.methods.markAsAnswered = async function(answer, answeredBy, mentorName) {
  this.status = 'answered';
  this.answer = answer;
  this.answeredAt = new Date();
  this.answeredBy = answeredBy;
  this.mentorName = mentorName;
  return await this.save();
};

module.exports = mongoose.model('Doubt', doubtSchema);
