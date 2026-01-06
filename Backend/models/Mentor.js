const mongoose = require('mongoose');

const mentorSchema = new mongoose.Schema({
  domainId: { type: String, required: true },
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetToken: String,
  resetTokenExpiry: Date,
  groups: [{ type: String }], // Array of group names the mentor has joined
});

module.exports = mongoose.model('Mentor', mentorSchema);
