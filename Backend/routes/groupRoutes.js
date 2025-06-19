// routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const Group = require('../models/groupModel');
const authMiddleware = require('../middleware/authMiddleware');

// Save selected group for authenticated user
router.post('/save-current-group', authMiddleware, async (req, res) => {
  const { groupName } = req.body;
  const user = req.user;

  if (!groupName) {
    return res.status(400).json({ error: 'Missing groupName' });
  }

  try {
    let group = await Group.findOne({ name: groupName });
    if (!group) {
      group = await Group.create({ name: groupName });
    }

    if (!user.groups.includes(group._id)) {
      user.groups.push(group._id);
      await user.save();
    }

    res.json({ message: `Group ${groupName} saved successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
