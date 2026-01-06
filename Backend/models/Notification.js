const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    enum: ['User', 'Mentor'],
    default: 'User'
  },
  type: {
    type: String,
    enum: [
      'mentorship_request',
      'mentorship_accepted',
      'mentorship_declined',
      'session_scheduled',
      'session_reminder',
      'session_cancelled',
      'session_rescheduled',
      'session_completed',
      'task_assigned',
      'goal_assigned',
      'feedback_received',
      'group_invitation',
      'message',
      'file_shared',
      'doubt_answered',
      'general'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  },
  relatedType: {
    type: String,
    enum: ['mentorship_request', 'session', 'group', 'message', 'doubt', 'task', 'goal']
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  icon: {
    type: String,
    default: 'bell'
  },
  actionUrl: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

// Mark as read method
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  this.readAt = new Date();
  return await this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
