const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email: { type: String, unique: true },
  password: { type: String, required: true },
  resetToken: String,
  resetTokenExpiry: Date,
  avatar: { type: String }, 
  bio: { type: String },
  streak: { type: Number, default: 0 },
  lastActive: { type: Date },
  lastLogout: { type: Date }, // Track when user last logged out
  groups: [String],
  badges: [String] 
  // groups: [{
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Group'
  // }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

