const mongoose = require('mongoose');

const learnerActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventKey: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180
  },
  details: {
    type: String,
    trim: true,
    maxlength: 600
  },
  sourceType: {
    type: String,
    trim: true,
    maxlength: 40
  },
  sourceId: {
    type: String,
    trim: true,
    maxlength: 100
  },
  occurredAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

learnerActivitySchema.index({ userId: 1, eventKey: 1 }, { unique: true });
learnerActivitySchema.index({ userId: 1, occurredAt: -1 });

module.exports = mongoose.model('LearnerActivity', learnerActivitySchema);