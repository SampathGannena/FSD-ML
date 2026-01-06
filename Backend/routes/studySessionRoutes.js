const express = require('express');
const router = express.Router();
const StudySession = require('../models/StudySession');
const Group = require('../models/Group');
const User = require('../models/User');
const Mentor = require('../models/Mentor');
const authMiddleware = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');

// @route   GET /api/sessions/debug-all
// @desc    Debug endpoint to check all sessions without auth
// @access  Public (temporary for debugging)
router.get('/debug-all', async (req, res) => {
  try {
    const allSessions = await StudySession.find({});
    const allGroups = await Group.find({});
    
    res.json({
      success: true,
      totalSessions: allSessions.length,
      totalGroups: allGroups.length,
      sessions: allSessions.map(s => ({
        id: s._id,
        title: s.title,
        group: s.group,
        date: s.sessionDate,
        time: s.startTime
      })),
      groups: allGroups.map(g => ({
        id: g._id,
        name: g.name
      }))
    });
  } catch (error) {
    console.error('Debug all sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware to authenticate all session routes (except debug-all above)
router.use(authMiddleware);

// @route   GET /api/sessions/debug
// @desc    Debug endpoint to check sessions
// @access  Private
router.get('/debug', async (req, res) => {
  try {
    const totalSessions = await StudySession.countDocuments();
    const recentSessions = await StudySession.find().limit(5).sort({ createdAt: -1 });
    
    console.log('=== DEBUG SESSIONS ===');
    console.log('Total sessions in database:', totalSessions);
    console.log('Recent sessions:', recentSessions.map(s => ({ 
      id: s._id, 
      title: s.title, 
      group: s.group,
      date: s.sessionDate 
    })));
    
    // Check DS-Advanced specifically
    const dsGroup = await Group.findOne({ name: 'DS-Advanced' });
    const dsSessions = dsGroup ? await StudySession.find({ group: dsGroup._id }) : [];
    
    console.log('DS-Advanced group:', dsGroup ? dsGroup._id : 'Not found');
    console.log('DS-Advanced sessions:', dsSessions.length);
    
    res.json({
      success: true,
      totalSessions,
      dsAdvancedSessions: dsSessions.length,
      dsAdvancedDetails: dsSessions.map(s => ({
        id: s._id,
        title: s.title,
        date: s.sessionDate,
        time: s.startTime
      })),
      recentSessions: recentSessions.map(s => ({
        id: s._id,
        title: s.title,
        group: s.group,
        sessionDate: s.sessionDate,
        startTime: s.startTime
      }))
    });
  } catch (error) {
    console.error('Debug sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
});

// @route   POST /api/sessions/create
// @desc    Create a new study session
// @access  Private
router.post('/create', [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be under 200 characters'),
  body('subject').isIn(['mathematics', 'programming', 'data-science', 'machine-learning', 'web-development', 'algorithms', 'databases', 'other']).withMessage('Invalid subject'),
  body('date').isISO8601().toDate().withMessage('Valid date is required'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required (HH:MM format)'),
  body('duration').isFloat({ min: 0.5, max: 8 }).withMessage('Duration must be between 0.5 and 8 hours'),
  body('type').isIn(['group', 'mentor', 'presentation']).withMessage('Invalid session type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      title,
      description,
      groupId,
      subject,
      level,
      date,
      startTime,
      duration,
      type,
      isRecurring,
      recurringFrequency,
      recurringCount,
      preferredMentor,
      mentorRequirements,
      expertiseNeeded,
      settings,
      participants
    } = req.body;

    // Validate session date/time is in the future
    const sessionDateTime = new Date(`${date}T${startTime}:00`);
    if (sessionDateTime <= new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session must be scheduled for a future date and time' 
      });
    }

    // Verify group membership (skip if no groupId provided)
    let resolvedGroupId = null;
    if (groupId && groupId !== 'null' && groupId !== 'undefined') {
      console.log('Looking for group with identifier:', groupId);
      let group;
      
      // Check if groupId is a valid ObjectId (24 character hex string)
      if (groupId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('Searching by ObjectId...');
        group = await Group.findById(groupId);
      } else {
        console.log('Searching by group name...');
        group = await Group.findOne({ name: groupId });
        
        // If not found by name, try finding any group with similar name
        if (!group) {
          console.log('Exact name not found, trying case-insensitive search...');
          group = await Group.findOne({ name: { $regex: `^${groupId}$`, $options: 'i' } });
        }
        
        // If still not found, let's see what groups exist
        if (!group) {
          const allGroups = await Group.find({}, 'name');
          console.log('Available groups in database:', allGroups.map(g => g.name));
        }
      }
      
      console.log('Group found:', group ? { id: group._id, name: group.name } : 'None');
      
      if (!group) {
        return res.status(404).json({ 
          success: false, 
          message: `Group not found: "${groupId}". Please ensure the group exists.` 
        });
      }
      
      // Check if user is a member of the group (skip for now to test)
      console.log('Group membership check - Group members:', group.members?.length || 0);
      console.log('User ID:', req.user.id);
      
      /*
      const isMember = group.members && group.members.some(member => 
        member.user && member.user.toString() === req.user.id
      );
      
      if (!isMember && group.createdBy && group.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'You must be a member of the group to create sessions' 
        });
      }
      */
      
      // Use the actual group ObjectId for the session
      resolvedGroupId = group._id;
      console.log('Resolved group ID:', resolvedGroupId);
    }

    // Calculate end time from start time and duration
    const calculateEndTime = (startTime, duration) => {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + (duration * 60);
      const endHours = Math.floor(endMinutes / 60) % 24;
      const endMins = endMinutes % 60;
      return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    };

    // Create session object
    const sessionData = {
      title,
      description,
      organizer: req.user.id,
      group: resolvedGroupId, // This will be null for personal sessions
      subject,
      level: level || 'intermediate',
      sessionDate: new Date(date),
      startTime,
      endTime: calculateEndTime(startTime, duration), // Calculate end time
      duration: parseFloat(duration),
      type,
      mentorRequested: type === 'mentor',
      preferredMentor: type === 'mentor' ? preferredMentor : null,
      mentorRequirements: type === 'mentor' ? mentorRequirements : null,
      expertiseNeeded: type === 'mentor' ? expertiseNeeded : [],
      participants: participants.map(email => ({
        email: email,
        name: email.split('@')[0] // Extract name from email for now
      })),
      settings: settings || {
        record: true,
        chat: true,
        screenShare: true,
        whiteboard: false,
        breakoutRooms: false,
        reminders: true
      }
    };

    // Handle recurring sessions
    if (isRecurring && recurringFrequency && recurringCount > 1) {
      sessionData.isRecurring = true;
      sessionData.recurringPattern = {
        frequency: recurringFrequency,
        count: parseInt(recurringCount),
        currentSession: 1
      };
    }

    console.log('=== CREATING SESSION ===');
    console.log('Resolved group ID:', resolvedGroupId);
    console.log('Session data to create:', JSON.stringify(sessionData, null, 2));
    
    const session = new StudySession(sessionData);
    console.log('Session object created, attempting to save...');
    await session.save();
    console.log('Session saved successfully:', session._id);

    // Create recurring sessions if needed
    const allSessions = [session];
    if (isRecurring && recurringCount > 1) {
      const recurringSession = await createRecurringSessions(session, recurringFrequency, recurringCount - 1);
      allSessions.push(...recurringSession);
    }

    // Add activity log
    session.addActivity('created', `Session "${title}" created`, req.user.id);
    await session.save();

    // If mentor was requested, notify mentors
    if (type === 'mentor') {
      await notifyMentorsOfNewRequest(session);
    }

    // Send invitations to participants
    if (participants.length > 0) {
      await sendSessionInvitations(session, participants);
    }

    res.status(201).json({
      success: true,
      message: 'Study session created successfully',
      session: await session.populate([
        { path: 'organizer', select: 'name email avatar' },
        { path: 'group', select: 'name description' }
      ])
    });

  } catch (error) {
    console.error('=== SESSION CREATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('User:', req.user ? req.user.id : 'No user');
    console.error('================================');
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/sessions/upcoming
// @desc    Get upcoming sessions for the user
// @access  Private
router.get('/upcoming', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sessions = await StudySession.findUpcoming(req.user.id, limit);
    
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/sessions/group/:groupId
// @desc    Get sessions for a specific group
// @access  Private
router.get('/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { status = 'all' } = req.query;
    
    console.log('Fetching sessions for group:', groupId);
    
    // Find group by ID or name
    let group;
    if (groupId.match(/^[0-9a-fA-F]{24}$/)) {
      group = await Group.findById(groupId);
    } else {
      group = await Group.findOne({ name: groupId });
    }
    
    if (!group) {
      console.log('Group not found:', groupId);
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    console.log('Group found:', { id: group._id, name: group.name });
    
    // Skip membership check for now to test
    /*
    const isMember = group.members.some(member => 
      member.user && member.user.toString() === req.user.id
    ) || group.createdBy.toString() === req.user.id;
    
    if (!isMember) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }
    */

    let query = { group: group._id };
    if (status !== 'all') {
      query.status = status;
    }

    console.log('Query for sessions:', JSON.stringify(query, null, 2));
    console.log('Group ObjectId:', group._id);

    const sessions = await StudySession.find(query)
      .populate('organizer', 'name email avatar')
      .populate('assignedMentor', 'name email specializations')
      .populate('participants.user', 'name email avatar')
      .sort({ sessionDate: 1, startTime: 1 });

    console.log('Sessions found:', sessions.length);
    if (sessions.length > 0) {
      console.log('All sessions:');
      sessions.forEach((session, index) => {
        console.log(`Session ${index + 1}:`, {
          id: session._id,
          title: session.title,
          date: session.sessionDate,
          time: session.startTime
        });
      });
      console.log('First session details:', JSON.stringify(sessions[0], null, 2));
    }

    console.log('Returning sessions to frontend:', sessions.length);
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Get group sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/sessions/mentor-requests
// @desc    Get pending mentor requests (for mentors)
// @access  Private
router.get('/mentor-requests', async (req, res) => {
  try {
    // Check if user is a mentor
    const mentor = await Mentor.findOne({ user: req.user.id });
    if (!mentor) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Mentor account required.' 
      });
    }

    const sessions = await StudySession.find({
      mentorRequested: true,
      'mentorResponse.status': 'pending',
      status: 'scheduled',
      sessionDate: { $gte: new Date() },
      $or: [
        { preferredMentor: mentor._id },
        { preferredMentor: null }
      ]
    })
    .populate('organizer', 'name email avatar')
    .populate('group', 'name description')
    .populate('participants.user', 'name email avatar')
    .sort({ sessionDate: 1, startTime: 1 });

    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Get mentor requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   POST /api/sessions/:sessionId/respond-mentor
// @desc    Respond to mentor request (accept/decline)
// @access  Private (Mentors only)
router.post('/:sessionId/respond-mentor', [
  body('response').isIn(['accepted', 'declined']).withMessage('Response must be accepted or declined'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be under 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { sessionId } = req.params;
    const { response, message } = req.body;

    // Check if user is a mentor
    const mentor = await Mentor.findOne({ user: req.user.id });
    if (!mentor) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Mentor account required.' 
      });
    }

    const session = await StudySession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (!session.mentorRequested) {
      return res.status(400).json({ 
        success: false, 
        message: 'This session does not require a mentor' 
      });
    }

    if (session.mentorResponse.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'This request has already been responded to' 
      });
    }

    // Update mentor response
    session.mentorResponse = {
      status: response,
      respondedAt: new Date(),
      response: message
    };

    if (response === 'accepted') {
      session.assignedMentor = mentor._id;
      session.addActivity('mentor_assigned', `Mentor ${mentor.name} accepted the request`, req.user.id);
    } else {
      session.addActivity('mentor_declined', `Mentor ${mentor.name} declined the request`, req.user.id);
    }

    await session.save();

    // Notify session organizer
    await notifyOrganizerOfMentorResponse(session, response, message);

    res.json({
      success: true,
      message: `Mentor request ${response} successfully`,
      session: await session.populate([
        { path: 'organizer', select: 'name email avatar' },
        { path: 'group', select: 'name description' },
        { path: 'assignedMentor', select: 'name email specializations' }
      ])
    });

  } catch (error) {
    console.error('Mentor response error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   PUT /api/sessions/:sessionId
// @desc    Update a study session
// @access  Private (Organizer only)
router.put('/:sessionId', [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('date').optional().isISO8601().toDate(),
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('duration').optional().isFloat({ min: 0.5, max: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { sessionId } = req.params;
    const session = await StudySession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Check if user is the organizer
    if (session.organizer.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the session organizer can update this session' 
      });
    }

    // Update fields
    const allowedUpdates = ['title', 'description', 'date', 'startTime', 'duration', 'settings'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'date') {
          updates.sessionDate = new Date(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    Object.assign(session, updates);
    session.addActivity('updated', 'Session details updated', req.user.id);
    await session.save();

    res.json({
      success: true,
      message: 'Session updated successfully',
      session: await session.populate([
        { path: 'organizer', select: 'name email avatar' },
        { path: 'group', select: 'name description' },
        { path: 'assignedMentor', select: 'name email specializations' }
      ])
    });

  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   DELETE /api/sessions/:sessionId
// @desc    Cancel a study session
// @access  Private (Organizer only)
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await StudySession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Check if user is the organizer
    if (session.organizer.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the session organizer can cancel this session' 
      });
    }

    session.status = 'cancelled';
    session.addActivity('cancelled', 'Session cancelled', req.user.id);
    await session.save();

    // Notify all participants
    await notifyParticipantsOfCancellation(session);

    res.json({
      success: true,
      message: 'Session cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   POST /api/sessions/:sessionId/join
// @desc    Join a session
// @access  Private
router.post('/:sessionId/join', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await StudySession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot join this session' 
      });
    }

    // Update session status if this is the first person joining
    if (session.status === 'scheduled') {
      session.status = 'in-progress';
    }

    // Add join activity
    session.addActivity('participant_joined', `User joined session`, req.user.id);
    await session.save();

    res.json({
      success: true,
      message: 'Joined session successfully',
      roomId: session.roomId,
      roomPassword: session.roomPassword
    });

  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper functions
async function createRecurringSessions(originalSession, frequency, count) {
  const sessions = [];
  let currentDate = new Date(originalSession.sessionDate);
  
  for (let i = 1; i <= count; i++) {
    // Calculate next date based on frequency
    switch (frequency) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }

    const newSessionData = {
      ...originalSession.toObject(),
      _id: undefined,
      sessionDate: new Date(currentDate),
      parentSession: originalSession._id,
      recurringPattern: {
        ...originalSession.recurringPattern,
        currentSession: i + 1
      }
    };

    const newSession = new StudySession(newSessionData);
    await newSession.save();
    sessions.push(newSession);

    // Add to parent's child sessions
    originalSession.childSessions.push(newSession._id);
  }

  await originalSession.save();
  return sessions;
}

async function notifyMentorsOfNewRequest(session) {
  // Implementation for notifying mentors
  console.log(`Notifying mentors about new session request: ${session.title}`);
}

async function sendSessionInvitations(session, participants) {
  // Implementation for sending email invitations
  console.log(`Sending invitations for session: ${session.title} to ${participants.length} participants`);
}

async function notifyOrganizerOfMentorResponse(session, response, message) {
  // Implementation for notifying organizer
  console.log(`Notifying organizer about mentor response: ${response}`);
}

async function notifyParticipantsOfCancellation(session) {
  // Implementation for notifying participants of cancellation
  console.log(`Notifying participants about session cancellation: ${session.title}`);
}

module.exports = router;
