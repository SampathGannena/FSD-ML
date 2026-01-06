const express = require('express');
const router = express.Router();
const VideoRoom = require('../models/VideoRoom');
const authMiddleware = require('../middleware/authMiddleware');
const mentorAuthMiddleware = require('../middleware/mentorAuthMiddleware');

// @route   POST /api/video-rooms/create
// @desc    Create a new video room
// @access  Private (User or Mentor)
router.post('/create', async (req, res) => {
  try {
    const { title, description, sessionId, groupId, settings, password } = req.body;
    
    // Generate unique room code
    let roomCode;
    let isUnique = false;
    while (!isUnique) {
      roomCode = VideoRoom.generateRoomCode();
      const existing = await VideoRoom.findOne({ roomCode });
      if (!existing) isUnique = true;
    }

    // Determine host type and ID based on token
    let hostId, hostType;
    
    // Try to get user from auth middleware
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Try user auth first
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      hostId = decoded.userId || decoded.id;
      hostType = decoded.role === 'mentor' ? 'Mentor' : 'User';
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const room = new VideoRoom({
      roomCode,
      title: title || 'Video Room',
      description,
      host: hostId,
      hostType,
      session: sessionId || null,
      group: groupId || null,
      settings: settings || {},
      password: password || null
    });

    await room.save();

    res.status(201).json({
      success: true,
      message: 'Video room created successfully',
      room: {
        roomCode: room.roomCode,
        title: room.title,
        status: room.status,
        settings: room.settings
      }
    });

  } catch (error) {
    console.error('Create video room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create video room'
    });
  }
});

// @route   GET /api/video-rooms/:roomCode
// @desc    Get video room details
// @access  Public (but may require password)
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    const room = await VideoRoom.findOne({ roomCode })
      .populate('host', 'fullname email')
      .populate('session', 'title sessionDate startTime')
      .populate('group', 'name');
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Don't send password or chat messages in basic info
    const roomInfo = {
      roomCode: room.roomCode,
      title: room.title,
      description: room.description,
      host: room.host,
      status: room.status,
      participantCount: room.participants.length,
      maxParticipants: room.maxParticipants,
      settings: room.settings,
      hasPassword: !!room.password,
      startedAt: room.startedAt,
      session: room.session,
      group: room.group
    };

    res.json({ success: true, room: roomInfo });

  } catch (error) {
    console.error('Get video room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video room'
    });
  }
});

// @route   POST /api/video-rooms/:roomCode/join
// @desc    Join a video room
// @access  Private
router.post('/:roomCode/join', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { password, peerId } = req.body;
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ success: false, message: 'This room has ended' });
    }

    // Check password if required
    if (room.password && room.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid room password' });
    }

    // Check participant limit
    if (room.participants.length >= room.maxParticipants) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }

    // Get user info from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let userId, userName, userType;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId || decoded.id;
      userType = decoded.role === 'mentor' ? 'Mentor' : 'User';
      
      // Get user name
      if (userType === 'Mentor') {
        const Mentor = require('../models/Mentor');
        const mentor = await Mentor.findById(userId);
        userName = mentor ? mentor.fullname : 'Mentor';
      } else {
        const User = require('../models/User');
        const user = await User.findById(userId);
        userName = user ? user.fullname : 'User';
      }
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Determine role (host or participant)
    const isHost = room.host.toString() === userId.toString();
    
    // Add participant
    await room.addParticipant({
      name: userName,
      peerId,
      role: isHost ? 'host' : 'participant',
      userId,
      userType
    });

    // Start room if host joins
    if (isHost && room.status === 'waiting') {
      await room.startRoom();
    }

    res.json({
      success: true,
      message: 'Joined room successfully',
      room: {
        roomCode: room.roomCode,
        title: room.title,
        status: room.status,
        isHost,
        settings: room.settings,
        participants: room.participants.map(p => ({
          name: p.name,
          peerId: p.peerId,
          role: p.role,
          connectionInfo: p.connectionInfo
        }))
      }
    });

  } catch (error) {
    console.error('Join video room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join video room'
    });
  }
});

// @route   POST /api/video-rooms/:roomCode/leave
// @desc    Leave a video room
// @access  Private
router.post('/:roomCode/leave', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Get user from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let userId;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId || decoded.id;
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Check if user is the host
    const isHost = room.host.toString() === userId.toString();

    // Remove participant
    await room.removeParticipant(userId);

    // End room if host leaves
    if (isHost) {
      await room.endRoom();
    }

    res.json({
      success: true,
      message: isHost ? 'Room ended' : 'Left room successfully'
    });

  } catch (error) {
    console.error('Leave video room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave video room'
    });
  }
});

// @route   POST /api/video-rooms/:roomCode/end
// @desc    End a video room (host only)
// @access  Private
router.post('/:roomCode/end', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Get user from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let userId;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId || decoded.id;
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Only host can end the room
    if (room.host.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only host can end the room' });
    }

    await room.endRoom();

    res.json({
      success: true,
      message: 'Room ended successfully',
      duration: room.duration
    });

  } catch (error) {
    console.error('End video room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end video room'
    });
  }
});

// @route   GET /api/video-rooms/:roomCode/participants
// @desc    Get room participants
// @access  Private
router.get('/:roomCode/participants', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.json({
      success: true,
      participants: room.participants.map(p => ({
        name: p.name,
        peerId: p.peerId,
        role: p.role,
        connectionInfo: p.connectionInfo,
        joinedAt: p.joinedAt
      }))
    });

  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get participants'
    });
  }
});

// @route   GET /api/video-rooms/:roomCode/chat
// @desc    Get room chat messages
// @access  Private
router.get('/:roomCode/chat', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.json({
      success: true,
      messages: room.chatMessages
    });

  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat messages'
    });
  }
});

module.exports = router;
