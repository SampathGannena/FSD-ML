const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const Mentor = require('../models/Mentor');
const File = require('../models/File');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware');
const combinedAuthMiddleware = require('../middleware/combinedAuthMiddleware');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all groups - no auth required for discovery
router.get('/all', async (req, res) => {
  try {
    const groups = await Group.find()
      .select('name description category status tags members createdAt updatedAt')
      .sort({ createdAt: -1 });
    
    const groupsWithDetails = groups.map(group => ({
      name: group.name,
      description: group.description,
      category: group.category || 'General',
      status: group.status || 'active',
      tags: group.tags || [],
      members: group.members,
      memberCount: group.members.length,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    res.json({
      success: true,
      groups: groupsWithDetails,
      total: groupsWithDetails.length
    });
  } catch (error) {
    console.error('Error fetching all groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch groups'
    });
  }
});

// Join a group
router.post('/:groupName/join', async (req, res) => {
  try {
    const { groupName } = req.params;
    const { name, email, role } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Find the group
    let group = await Group.findOne({ name: groupName });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user/mentor already a member
    const isMember = group.members.some(m => m.email === email);
    if (isMember) {
      return res.json({ 
        success: true,
        message: 'Already a member of this group',
        group: {
          name: group.name,
          members: group.members.length
        }
      });
    }

    // Try to find the user in User or Mentor collection
    let userId = null;
    const user = await User.findOne({ email });
    const mentor = await Mentor.findOne({ email });
    
    if (user) {
      userId = user._id;
      // Add group to user's groups array
      if (!user.groups.includes(groupName)) {
        user.groups.push(groupName);
        await user.save();
      }
    } else if (mentor) {
      userId = mentor._id;
      // Add group to mentor's groups array
      if (!mentor.groups) mentor.groups = [];
      if (!mentor.groups.includes(groupName)) {
        mentor.groups.push(groupName);
        await mentor.save();
      }
    }

    // Add member to group
    await group.addMember(userId, name, email, role || 'member');

    res.json({
      success: true,
      message: `Successfully joined ${groupName}`,
      group: {
        name: group.name,
        members: group.members.length,
        status: group.status
      }
    });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join group'
    });
  }
});

// Get group statistics - now uses enhanced Group model
router.get('/:groupName/stats', combinedAuthMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    
    // Get group from enhanced model
    const group = await Group.findOne({ name: groupName });
    
    if (group) {
      // Use stats from enhanced Group model
      const membersCount = group.members.length;
      const onlineCount = group.members.filter(m => m.status === 'online' || m.status === 'away').length;
      
      // Combine group's stored stats with live data from Message/File collections
      const messageCount = await Message.countDocuments({ group: groupName });
      const filesCount = await File.countDocuments({ group: groupName });
      
      // Update group stats if they differ (sync with actual counts)
      if (group.stats.totalMessages !== messageCount || group.stats.totalFiles !== filesCount) {
        group.stats.totalMessages = messageCount;
        group.stats.totalFiles = filesCount;
        await group.save();
      }
      
      // Get recent activity from group's stored activity
      let recentActivity = group.recentActivity.slice(0, 5).map(a => ({
        type: a.action,
        user: a.userName,
        action: a.action,
        details: a.description,
        timestamp: a.timestamp
      }));
      
      // If no stored activity, fall back to fetching from Message/File collections
      if (recentActivity.length === 0) {
        const recentMessages = await Message.find({ group: groupName })
          .sort({ timestamp: -1 })
          .limit(5)
          .select('sender message timestamp');
        
        const recentFiles = await File.find({ group: groupName })
          .sort({ uploadedAt: -1 })
          .limit(3)
          .select('originalname uploadedAt uploadedBy');
        
        recentMessages.forEach(msg => {
          recentActivity.push({
            type: 'message',
            user: msg.sender,
            action: 'sent a message',
            details: msg.message.substring(0, 50) + (msg.message.length > 50 ? '...' : ''),
            timestamp: msg.timestamp
          });
        });
        
        recentFiles.forEach(file => {
          recentActivity.push({
            type: 'file',
            user: file.uploadedBy || 'Member',
            action: 'uploaded a file',
            details: file.originalname,
            timestamp: file.uploadedAt
          });
        });
        
        recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        recentActivity = recentActivity.slice(0, 5);
      }
      
      // Get member details
      const members = group.members.map(m => ({
        id: m.userId,
        name: m.name,
        avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`,
        role: m.role,
        status: m.status,
        lastActive: m.lastActive,
        messageCount: m.messageCount
      }));
      
      res.json({
        success: true,
        stats: {
          members: membersCount,
          onlineNow: onlineCount,
          messages: messageCount,
          filesShared: filesCount,
          sessions: group.stats.totalSessions
        },
        members: members,
        recentActivity: recentActivity,
        progress: group.progress
      });
      
    } else {
      // Fallback: Group not in enhanced model yet, use legacy method
      const membersCount = await User.countDocuments({ 
        groups: { $in: [groupName] } 
      });
      
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const onlineCount = await User.countDocuments({ 
        groups: { $in: [groupName] },
        lastActive: { $gte: thirtyMinutesAgo }
      });
      
      const messageCount = await Message.countDocuments({ group: groupName });
      const filesCount = await File.countDocuments({ group: groupName });
      
      const recentMessages = await Message.find({ group: groupName })
        .sort({ timestamp: -1 })
        .limit(5)
        .select('sender message timestamp');
      
      const recentActivity = recentMessages.map(msg => ({
        type: 'message',
        user: msg.sender,
        action: 'sent a message',
        details: msg.message.substring(0, 50) + (msg.message.length > 50 ? '...' : ''),
        timestamp: msg.timestamp
      }));
      
      res.json({
        success: true,
        stats: {
          members: membersCount,
          onlineNow: onlineCount,
          messages: messageCount,
          filesShared: filesCount,
          sessions: 0
        },
        members: [],
        recentActivity: recentActivity,
        progress: { percentage: 0, milestones: [] }
      });
    }
    
  } catch (error) {
    console.error('Error fetching group stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update member status
router.put('/:groupName/member-status', combinedAuthMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const { status } = req.body;
    const userId = req.user._id;
    
    const group = await Group.findOne({ name: groupName });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    const updated = await group.updateMemberStatus(userId, status);
    res.json({ success: updated });
  } catch (error) {
    console.error('Error updating member status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get group members
router.get('/:groupName/members', combinedAuthMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    
    const group = await Group.findOne({ name: groupName });
    if (!group) {
      // Fallback to User collection
      const users = await User.find({ groups: { $in: [groupName] } })
        .select('fullname email lastActive');
      
      return res.json({
        success: true,
        members: users.map(u => ({
          id: u._id,
          name: u.fullname,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.fullname}`,
          status: u.lastActive && (Date.now() - new Date(u.lastActive).getTime()) < 30 * 60 * 1000 ? 'online' : 'offline'
        })),
        total: users.length,
        online: users.filter(u => u.lastActive && (Date.now() - new Date(u.lastActive).getTime()) < 30 * 60 * 1000).length
      });
    }
    
    res.json({
      success: true,
      members: group.members.map(m => ({
        id: m.userId,
        name: m.name,
        email: m.email,
        avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        lastActive: m.lastActive,
        messageCount: m.messageCount
      })),
      total: group.members.length,
      online: group.members.filter(m => m.status === 'online').length
    });
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get group messages
router.get('/:groupName/messages', combinedAuthMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;
    
    const messages = await Message.find({ group: groupName })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(limit)
      .select('senderName message timestamp fileUrl fileName fileSize reactions replies');
    
    res.json({
      success: true,
      messages: messages.map(msg => ({
        _id: msg._id,
        sender: msg.senderName,
        text: msg.message,
        timestamp: msg.timestamp,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        reactions: msg.reactions || [],
        replies: msg.replies || []
      })),
      total: messages.length,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Post a message to group
router.post('/:groupName/messages', combinedAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { groupName } = req.params;
    const { text, sender } = req.body;
    const file = req.file;
    
    console.log('Received message request:', { groupName, text, sender, hasFile: !!file });
    
    if (!text && !file) {
      return res.status(400).json({ success: false, message: 'Message or file required' });
    }
    
    const messageData = {
      group: groupName,
      senderName: sender || req.user.fullname,
      senderEmail: req.user.email,
      message: text || '',
      timestamp: new Date()
    };
    
    if (file) {
      messageData.fileUrl = `/uploads/${file.filename}`;
      messageData.fileName = file.originalname;
      messageData.fileSize = file.size;
    }
    
    const message = await Message.create(messageData);
    console.log('Message created:', message._id);
    
    // Update group's last activity
    const group = await Group.findOne({ name: groupName });
    if (group) {
      await group.recordActivity(
        req.user._id,
        req.user.fullname || sender,
        file ? 'file_upload' : 'message',
        file ? `Uploaded ${file.originalname}` : text.substring(0, 100)
      );
    }
    
    res.json({
      success: true,
      message: {
        _id: message._id,
        sender: message.senderName,
        text: message.message,
        timestamp: message.timestamp,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize
      }
    });
  } catch (error) {
    console.error('Error posting message:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

module.exports = router;
