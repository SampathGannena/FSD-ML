const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
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
    enum: ['skill-development', 'career', 'academic', 'project', 'certification', 'other'],
    default: 'skill-development'
  },
  targetDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'achieved', 'delayed', 'cancelled'],
    default: 'active'
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  milestones: [{
    title: String,
    description: String,
    targetDate: Date,
    completed: {
      type: Boolean,
      default: false
    },
    completedDate: Date
  }],
  achievedDate: {
    type: Date
  },
  notes: {
    type: String
  },
  reflections: [{
    date: Date,
    content: String,
    addedBy: {
      type: String,
      enum: ['mentor', 'mentee']
    }
  }]
}, {
  timestamps: true
});

// Index for faster queries
goalSchema.index({ mentorId: 1, menteeId: 1 });
goalSchema.index({ status: 1, targetDate: 1 });

// Method to mark goal as achieved
goalSchema.methods.markAsAchieved = function() {
  this.status = 'achieved';
  this.achievedDate = new Date();
  this.progressPercentage = 100;
  return this.save();
};

// Method to update progress
goalSchema.methods.updateProgress = function(percentage) {
  this.progressPercentage = Math.min(100, Math.max(0, percentage));
  if (this.progressPercentage === 100) {
    this.status = 'achieved';
    this.achievedDate = new Date();
  }
  return this.save();
};

// Method to add milestone
goalSchema.methods.addMilestone = function(milestone) {
  this.milestones.push(milestone);
  return this.save();
};

// Method to complete milestone
goalSchema.methods.completeMilestone = function(milestoneId) {
  const milestone = this.milestones.id(milestoneId);
  if (milestone) {
    milestone.completed = true;
    milestone.completedDate = new Date();
    
    // Update overall progress based on completed milestones
    const completedCount = this.milestones.filter(m => m.completed).length;
    this.progressPercentage = Math.round((completedCount / this.milestones.length) * 100);
  }
  return this.save();
};

// Method to add reflection
goalSchema.methods.addReflection = function(content, addedBy) {
  this.reflections.push({
    date: new Date(),
    content,
    addedBy
  });
  return this.save();
};

module.exports = mongoose.model('Goal', goalSchema);
