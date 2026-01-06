// routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// Save selected group for authenticated user
router.post('/save-current-group', authMiddleware, async (req, res) => {
  const { groupName } = req.body;
  const userId = req.user._id;

  if (!groupName) {
    return res.status(400).json({ error: 'Missing groupName' });
  }

  try {
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create the group
    let group = await Group.findOne({ name: groupName });
    if (!group) {
      group = await Group.create({ 
        name: groupName,
        description: `Study group for ${groupName}`,
        createdBy: userId,
        status: 'active'
      });
    }

    // Check if user is already a member of the group
    const isMember = group.members.some(m => m.userId?.toString() === userId.toString());
    
    if (!isMember) {
      // Add user as member using the model method
      await group.addMember(userId, user.fullname, user.email, group.members.length === 0 ? 'admin' : 'member');
    }

    // Also update user's groups array (for backward compatibility)
    if (!user.groups.includes(groupName)) {
      user.groups.push(groupName);
      await user.save();
    }

    // Update member status to online
    await group.updateMemberStatus(userId, 'online');

    res.json({ 
      message: `Group ${groupName} saved successfully.`,
      group: {
        name: group.name,
        members: group.members.length,
        status: group.status,
        isAdmin: group.members.find(m => m.userId?.toString() === userId.toString())?.role === 'admin'
      }
    });
  } catch (err) {
    console.error('Error saving group:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current group details
router.get('/current-group/:groupName', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({ name: groupName });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const currentMember = group.members.find(m => m.userId?.toString() === userId.toString());

    res.json({
      success: true,
      group: {
        name: group.name,
        description: group.description,
        status: group.status,
        category: group.category,
        members: group.members.map(m => ({
          id: m.userId,
          name: m.name,
          avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`,
          role: m.role,
          status: m.status,
          lastActive: m.lastActive
        })),
        totalMembers: group.members.length,
        activeMembers: group.members.filter(m => m.status === 'online' || m.status === 'away').length,
        stats: group.stats,
        recentActivity: group.recentActivity.slice(0, 10),
        progress: group.progress,
        isMember: !!currentMember,
        userRole: currentMember?.role || null,
        isAdmin: currentMember?.role === 'admin'
      }
    });
  } catch (err) {
    console.error('Error fetching group:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
