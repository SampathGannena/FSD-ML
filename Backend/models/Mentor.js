const mongoose = require('mongoose');

const mentorSchema = new mongoose.Schema({
  domainId: { type: String, required: true },
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetToken: String,
  resetTokenExpiry: Date,
  subscription: {
    plan: { type: String, enum: ['starter', 'premium', 'enterprise'], default: 'starter' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    status: { type: String, enum: ['active', 'trial', 'paused', 'cancelled'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  groups: [{ type: String }], // Array of group names the mentor has joined
});

module.exports = mongoose.model('Mentor', mentorSchema);
