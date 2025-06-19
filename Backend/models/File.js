const mongoose = require('mongoose');
const FileSchema = new mongoose.Schema({
  group: String,
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('File', FileSchema);