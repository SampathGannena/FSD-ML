const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    required: true
  },
  menteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  category: {
    type: String,
    enum: ['assignment', 'project', 'reading', 'practice', 'research', 'other'],
    default: 'assignment'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'overdue', 'cancelled'],
    default: 'pending'
  },
  dueDate: {
    type: Date,
    required: true
  },
  completedDate: {
    type: Date
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  notes: {
    type: String
  },
  feedback: {
    type: String
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }]
}, {
  timestamps: true
});

// Index for faster queries
taskSchema.index({ mentorId: 1, menteeId: 1 });
taskSchema.index({ status: 1, dueDate: 1 });

// Method to mark task as completed
taskSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.completedDate = new Date();
  this.progressPercentage = 100;
  return this.save();
};

// Method to update progress
taskSchema.methods.updateProgress = function(percentage) {
  this.progressPercentage = Math.min(100, Math.max(0, percentage));
  if (this.progressPercentage === 100) {
    this.status = 'completed';
    this.completedDate = new Date();
  } else if (this.progressPercentage > 0) {
    this.status = 'in-progress';
  }
  return this.save();
};

// Virtual for checking if overdue
taskSchema.virtual('isOverdue').get(function() {
  return this.status !== 'completed' && this.dueDate < new Date();
});

// Pre-save hook to check overdue status
taskSchema.pre('save', function(next) {
  if (this.status !== 'completed' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
