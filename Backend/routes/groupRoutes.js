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

  console.log('📝 save-current-group called:', { groupName, userId: userId.toString() });

  if (!groupName) {
    return res.status(400).json({ error: 'Missing groupName' });
  }

  try {
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('👤 User found:', user.fullname, 'Current groups:', user.groups);

    // Find or create the group
    let group = await Group.findOne({ name: groupName });
    if (!group) {
      console.log('📦 Creating new group:', groupName);
      group = await Group.create({ 
        name: groupName,
        description: `Study group for ${groupName}`,
        createdBy: userId,
        status: 'active'
      });
    } else {
      console.log('📦 Group exists:', groupName, 'Members:', group.members.length);
    }

    // Check if user is already a member of the group
    const isMember = group.members.some(m => m.userId?.toString() === userId.toString());
    console.log('🔍 User already member?', isMember);
    
    if (!isMember) {
      // Add user as member using the model method
      await group.addMember(userId, user.fullname, user.email, group.members.length === 0 ? 'admin' : 'member');
      console.log('✅ Added user to group members');
    }

    // Also update user's groups array (for backward compatibility)
    if (!user.groups.includes(groupName)) {
      user.groups.push(groupName);
      await user.save();
      console.log('✅ Added group to user.groups array:', user.groups);
    } else {
      console.log('ℹ️  Group already in user.groups array');
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
    console.log('✅ Response sent successfully');
  } catch (err) {
    console.error('❌ Error saving group:', err);
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
