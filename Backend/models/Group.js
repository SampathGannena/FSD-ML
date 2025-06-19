
const mongoose = require('mongoose');
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true}
});
module.exports = mongoose.model('Group', GroupSchema);