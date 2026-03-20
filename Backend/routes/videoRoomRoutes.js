const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const VideoRoom = require('../models/VideoRoom');
const combinedAuthMiddleware = require('../middleware/combinedAuthMiddleware');
const { requireFeature } = require('../middleware/subscriptionMiddleware');

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.webm') || '.webm';
    const safeRoomCode = normalizeRoomCode(req.params.roomCode || 'ROOM');
    cb(null, `recording-${safeRoomCode}-${Date.now()}${ext}`);
  }
});

const recordingUpload = multer({
  storage: recordingStorage,
  limits: {
    fileSize: 1024 * 1024 * 250
  }
});

function normalizeRoomCode(roomCode) {
  return (roomCode || '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

function isRoomMember(room, userId) {
  const userIdStr = userId?.toString();
  if (!userIdStr || !room) {
    return false;
  }

  const isHost = room.host && room.host.toString() === userIdStr;
  if (isHost) {
    return true;
  }

  return room.participants.some(
    participant => participant.userId && participant.userId.toString() === userIdStr
  );
}

router.use(combinedAuthMiddleware);
router.use(requireFeature('video_calls'));

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

    const hostId = req.user._id;
    const hostType = req.userType === 'mentor' ? 'Mentor' : 'User';

    const room = new VideoRoom({
      roomId: roomCode,
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
    const roomCode = normalizeRoomCode(req.params.roomCode);
    
    const room = await VideoRoom.findOne({ roomCode })
      .populate('host', 'fullname email')
      .populate('session', 'title sessionDate startTime')
      .populate('group', 'name');
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!isRoomMember(room, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Join this room to view details.'
      });
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
    const roomCode = normalizeRoomCode(req.params.roomCode);
    const { password, peerId } = req.body;

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code' });
    }

    let room = await VideoRoom.findOne({ roomCode });

    // Create a secure room record on first join so websocket membership checks can be enforced.
    if (!room) {
      const hostId = req.user._id;
      const hostType = req.userType === 'mentor' ? 'Mentor' : 'User';

      room = await VideoRoom.findOneAndUpdate(
        { roomCode },
        {
          $setOnInsert: {
            roomId: roomCode,
            roomCode,
            title: 'Study Session',
            host: hostId,
            hostType,
            settings: {}
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
    }

    if (room.status === 'ended') {
      return res.status(400).json({ success: false, message: 'This room has ended' });
    }

    // Check password if required
    if (room.password && room.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid room password' });
    }

    const userId = req.user._id;
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
    const userName = displayName || req.user.fullname || (req.userType === 'mentor' ? 'Mentor' : 'User');
    const userType = req.userType === 'mentor' ? 'Mentor' : 'User';

    // Determine role (host or participant)
    const isHost = room.host.toString() === userId.toString();
    const existingParticipant = room.participants.find(
      participant => participant.userId && participant.userId.toString() === userId.toString()
    );

    const waitingParticipants = Array.isArray(room.waitingParticipants) ? room.waitingParticipants : [];
    const waitingIndex = waitingParticipants.findIndex(
      participant => participant.userId && participant.userId.toString() === userId.toString()
    );

    if (!isHost && room.settings?.requireApproval === true && !existingParticipant) {
      if (waitingIndex === -1) {
        waitingParticipants.push({
          userId,
          userType,
          name: userName,
          peerId,
          requestedAt: new Date()
        });
      } else {
        waitingParticipants[waitingIndex].name = userName;
        waitingParticipants[waitingIndex].peerId = peerId;
        waitingParticipants[waitingIndex].requestedAt = new Date();
      }

      room.waitingParticipants = waitingParticipants;
      await room.save();

      return res.status(202).json({
        success: true,
        waitingForApproval: true,
        message: 'Waiting for host approval',
        room: {
          memberId: userId.toString(),
          roomCode: room.roomCode,
          title: room.title,
          status: room.status,
          isHost: false,
          settings: room.settings,
          participants: room.participants.map(p => ({
            userId: p.userId ? p.userId.toString() : null,
            name: p.name,
            peerId: p.peerId,
            role: p.role,
            connectionInfo: p.connectionInfo
          }))
        }
      });
    }

    // Check participant limit
    if (!existingParticipant && room.participants.length >= room.maxParticipants) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }
    
    // Add participant
    if (!existingParticipant) {
      await room.addParticipant({
        name: userName,
        peerId,
        role: isHost ? 'host' : 'participant',
        userId,
        userType
      });
    } else {
      existingParticipant.name = userName;
      existingParticipant.peerId = peerId || existingParticipant.peerId;
      await room.save();
    }

    if (waitingIndex !== -1) {
      room.waitingParticipants.splice(waitingIndex, 1);
      await room.save();
    }

    // Start room if host joins
    if (isHost && room.status === 'waiting') {
      await room.startRoom();
    }

    res.json({
      success: true,
      message: 'Joined room successfully',
      room: {
        memberId: userId.toString(),
        roomCode: room.roomCode,
        title: room.title,
        status: room.status,
        isHost,
        settings: room.settings,
        waitingParticipants: isHost
          ? (room.waitingParticipants || []).map(p => ({
              userId: p.userId ? p.userId.toString() : null,
              name: p.name,
              peerId: p.peerId,
              requestedAt: p.requestedAt
            }))
          : [],
        participants: room.participants.map(p => ({
          userId: p.userId ? p.userId.toString() : null,
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
    const roomCode = normalizeRoomCode(req.params.roomCode);
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const userId = req.user._id;
    const waitingIndex = (room.waitingParticipants || []).findIndex(
      participant => participant.userId && participant.userId.toString() === userId.toString()
    );

    if (!isRoomMember(room, userId) && waitingIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this room'
      });
    }

    if (waitingIndex !== -1) {
      room.waitingParticipants.splice(waitingIndex, 1);
      await room.save();
      return res.json({
        success: true,
        message: 'Left waiting room successfully'
      });
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
    const roomCode = normalizeRoomCode(req.params.roomCode);
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const userId = req.user._id;

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
    const roomCode = normalizeRoomCode(req.params.roomCode);
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!isRoomMember(room, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Join this room to view participants.'
      });
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
    const roomCode = normalizeRoomCode(req.params.roomCode);
    
    const room = await VideoRoom.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!isRoomMember(room, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Join this room to view chat history.'
      });
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

// @route   POST /api/video-rooms/:roomCode/recordings
// @desc    Upload a recorded video file for a room
// @access  Private (host only)
router.post('/:roomCode/recordings', recordingUpload.single('recording'), async (req, res) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);
    const room = await VideoRoom.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const userId = req.user._id;
    if (room.host.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only host can upload recordings' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No recording file uploaded' });
    }

    const recordingUrl = `/uploads/${req.file.filename}`;
    room.recordingUrl = recordingUrl;
    room.recordings = room.recordings || [];
    room.recordings.push({
      url: recordingUrl,
      uploadedBy: userId,
      uploadedByType: req.userType === 'mentor' ? 'Mentor' : 'User',
      mimeType: req.file.mimetype,
      size: req.file.size,
      startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
      endedAt: req.body.endedAt ? new Date(req.body.endedAt) : undefined,
      uploadedAt: new Date()
    });

    await room.save();

    return res.status(201).json({
      success: true,
      message: 'Recording uploaded successfully',
      recordingUrl
    });
  } catch (error) {
    console.error('Upload recording error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload recording'
    });
  }
});

module.exports = router;
