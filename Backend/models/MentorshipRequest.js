const mongoose = require('mongoose');

const mentorshipRequestSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    required: true
  },
  mentorName: {
    type: String,
    required: true
  },
  mentorEmail: {
    type: String,
    required: true
  },
  learnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  learnerName: {
    type: String,
    required: true
  },
  learnerEmail: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'cancelled'],
    default: 'pending'
  },
  message: {
    type: String,
    default: ''
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  responseDate: {
    type: Date
  },
  responseMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
mentorshipRequestSchema.index({ mentorId: 1, learnerId: 1 });
mentorshipRequestSchema.index({ status: 1 });

module.exports = mongoose.model('MentorshipRequest', mentorshipRequestSchema);