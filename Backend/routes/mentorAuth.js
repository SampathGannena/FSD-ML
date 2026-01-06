const express = require('express');
const router = express.Router();
const mentorAuth = require('../controllers/mentorAuth');
const mentorAuthMiddleware = require('../middleware/mentorAuthMiddleware');
const StudySession = require('../models/StudySession');
const User = require('../models/User');

router.post('/signup', mentorAuth.signup);
router.post('/signin', mentorAuth.mentorSignin);
router.post('/forgot-password', mentorAuth.forgotPassword);
router.post("/reset-password", mentorAuth.resetPassword);

// Get mentor profile
router.get('/profile', mentorAuthMiddleware, async (req, res) => {
  try {
    const MentorshipRequest = require('../models/MentorshipRequest');
    const Session = require('../models/Session');
    const mentor = req.mentor;
    
    // Get mentor statistics - count from new Session model
    const sessionsCount = await Session.countDocuments({ 
      mentorId: mentor._id,
      status: 'completed'
    });
    
    // Also count old StudySession for backward compatibility
    const oldSessionsCount = await StudySession.countDocuments({ 
      mentorId: mentor._id,
      status: 'completed'
    });
    
    // Count pending mentorship requests (not StudySession)
    const pendingRequests = await MentorshipRequest.countDocuments({
      mentorId: mentor._id,
      status: 'pending'
    });
    
    // Get accepted mentees count
    const acceptedMentees = await MentorshipRequest.countDocuments({
      mentorId: mentor._id,
      status: 'accepted'
    });
    
    // Get groups the mentor has joined (from Mentor model)
    const mentorGroups = mentor.groups || [];
    
    res.json({
      profile: {
        id: mentor._id,
        fullname: mentor.fullname,
        email: mentor.email,
        domainId: mentor.domainId,
        groups: mentorGroups
      },
      stats: {
        menteesGuided: acceptedMentees,
        sessionsCompleted: sessionsCount + oldSessionsCount,
        pendingRequests: pendingRequests,
        groupsMentoring: mentorGroups.length
      },
      groups: mentorGroups
    });
  } catch (err) {
    console.error('Error fetching mentor profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get mentor dashboard stats
router.get('/dashboard-stats', mentorAuthMiddleware, async (req, res) => {
  try {
    const mentor = req.mentor;
    
    // Get sessions by status
    const completedSessions = await StudySession.countDocuments({ 
      mentorId: mentor._id, 
      status: 'completed' 
    });
    
    const upcomingSessions = await StudySession.countDocuments({ 
      mentorId: mentor._id, 
      status: 'scheduled',
      scheduledTime: { $gte: new Date() }
    });
    
    const pendingRequests = await StudySession.countDocuments({ 
      mentorId: mentor._id, 
      status: 'pending' 
    });
    
    // Get unique mentees
    const menteeIds = await StudySession.distinct('userId', { mentorId: mentor._id });
    
    // Get recent activity (last 5 sessions)
    const recentSessions = await StudySession.find({ mentorId: mentor._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'fullname email');
    
    res.json({
      stats: {
        totalMentees: menteeIds.length,
        completedSessions,
        upcomingSessions,
        pendingRequests
      },
      recentActivity: recentSessions.map(session => ({
        id: session._id,
        studentName: session.userId?.fullname || 'Unknown Student',
        groupName: session.groupName,
        status: session.status,
        scheduledTime: session.scheduledTime,
        createdAt: session.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get mentees list
router.get('/mentees', mentorAuthMiddleware, async (req, res) => {
  try {
    const MentorshipRequest = require('../models/MentorshipRequest');
    const User = require('../models/User');
    const Session = require('../models/Session');
    const Task = require('../models/Task');
    const Goal = require('../models/Goal');
    const mentor = req.mentor;
    
    console.log('📚 Fetching mentees for mentor:', mentor._id);
    
    // Get all ACCEPTED mentorship requests for this mentor
    const acceptedRequests = await MentorshipRequest.find({ 
      mentorId: mentor._id,
      status: 'accepted'
    }).sort({ responseDate: -1 });
    
    console.log(`✅ Found ${acceptedRequests.length} accepted mentorship requests`);
    
    // Get all sessions for this mentor
    const sessions = await Session.find({ mentorId: mentor._id });
    const oldSessions = await StudySession.find({ mentorId: mentor._id });
    
    // Create mentees array with full profile data
    const menteesData = await Promise.all(acceptedRequests.map(async (request) => {
      // Fetch full user profile
      const userProfile = await User.findById(request.learnerId).select('-password -resetToken -resetTokenExpiry');
      
      if (!userProfile) {
        return null;
      }
      
      // Count sessions for this specific mentee
      const menteeSessions = sessions.filter(s => 
        s.menteeId && s.menteeId.toString() === request.learnerId.toString()
      );
      const oldMenteeSessions = oldSessions.filter(s => 
        s.userId && s.userId.toString() === request.learnerId.toString()
      );
      
      // Count tasks and goals
      const tasksCount = await Task.countDocuments({ 
        mentorId: mentor._id,
        menteeId: request.learnerId 
      });
      const completedTasks = await Task.countDocuments({ 
        mentorId: mentor._id,
        menteeId: request.learnerId,
        status: 'completed'
      });
      const goalsCount = await Goal.countDocuments({ 
        mentorId: mentor._id,
        menteeId: request.learnerId 
      });
      
      return {
        id: request.learnerId,
        name: userProfile.fullname,
        email: userProfile.email,
        avatar: userProfile.avatar,
        bio: userProfile.bio,
        streak: userProfile.streak || 0,
        lastActive: userProfile.lastActive,
        groups: userProfile.groups || [],
        badges: userProfile.badges || [],
        sessionsCount: menteeSessions.length + oldMenteeSessions.length,
        completedSessions: menteeSessions.filter(s => s.status === 'completed').length,
        tasksCount: tasksCount,
        completedTasks: completedTasks,
        goalsCount: goalsCount,
        acceptedDate: request.responseDate,
        requestDate: request.requestDate,
        createdAt: userProfile.createdAt
      };
    }));
    
    // Filter out null values (users that were deleted)
    const mentees = menteesData.filter(m => m !== null);
    
    console.log(`📊 Returning ${mentees.length} mentees`);
    
    res.json({ 
      success: true,
      mentees: mentees,
      count: mentees.length
    });
  } catch (err) {
    console.error('❌ Error fetching mentees:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch mentees',
      message: err.message 
    });
  }
});

// Get individual mentee profile
router.get('/mentees/:menteeId', mentorAuthMiddleware, async (req, res) => {
  try {
    const MentorshipRequest = require('../models/MentorshipRequest');
    const User = require('../models/User');
    const Session = require('../models/Session');
    const Task = require('../models/Task');
    const Goal = require('../models/Goal');
    const Group = require('../models/Group');
    const { menteeId } = req.params;
    
    // Verify this mentee is actually being mentored by this mentor
    const mentorship = await MentorshipRequest.findOne({
      mentorId: req.mentor._id,
      learnerId: menteeId,
      status: 'accepted'
    });
    
    if (!mentorship) {
      return res.status(403).json({ error: 'Not authorized to view this mentee profile' });
    }
    
    // Fetch full user profile
    const userProfile = await User.findById(menteeId).select('-password -resetToken -resetTokenExpiry');
    
    if (!userProfile) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    
    // Get group details if user has groups
    let groupDetails = [];
    if (userProfile.groups && userProfile.groups.length > 0) {
      groupDetails = await Group.find({ 
        name: { $in: userProfile.groups } 
      }).select('name description category status members createdAt');
      
      // Add member count to each group
      groupDetails = groupDetails.map(group => ({
        name: group.name,
        description: group.description,
        category: group.category,
        status: group.status,
        memberCount: group.members ? group.members.length : 0,
        createdAt: group.createdAt
      }));
    }
    
    // Get sessions
    const sessions = await Session.find({ 
      mentorId: req.mentor._id,
      menteeId: menteeId 
    }).sort({ scheduledDate: -1 });
    
    const oldSessions = await StudySession.find({ 
      mentorId: req.mentor._id,
      userId: menteeId 
    }).sort({ createdAt: -1 });
    
    // Get tasks
    const tasks = await Task.find({ 
      mentorId: req.mentor._id,
      menteeId: menteeId 
    }).sort({ createdAt: -1 });
    
    // Get goals
    const goals = await Goal.find({ 
      mentorId: req.mentor._id,
      menteeId: menteeId 
    }).sort({ createdAt: -1 });
    
    // Calculate stats
    const stats = {
      totalSessions: sessions.length + oldSessions.length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      upcomingSessions: sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduledDate) > new Date()).length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      overdueTasks: tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date()).length,
      totalGoals: goals.length,
      completedGoals: goals.filter(g => g.status === 'completed').length,
      averageRating: sessions.filter(s => s.feedback?.menteeRating).length > 0 
        ? (sessions.reduce((sum, s) => sum + (s.feedback?.menteeRating || 0), 0) / sessions.filter(s => s.feedback?.menteeRating).length).toFixed(1)
        : null
    };
    
    res.json({
      success: true,
      profile: {
        id: userProfile._id,
        name: userProfile.fullname,
        email: userProfile.email,
        avatar: userProfile.avatar,
        bio: userProfile.bio,
        streak: userProfile.streak || 0,
        lastActive: userProfile.lastActive,
        groups: userProfile.groups || [],
        groupDetails: groupDetails,
        badges: userProfile.badges || [],
        createdAt: userProfile.createdAt
      },
      stats,
      recentSessions: sessions.slice(0, 5),
      recentTasks: tasks.slice(0, 5),
      activeGoals: goals.filter(g => g.status !== 'completed').slice(0, 3)
    });
  } catch (error) {
    console.error('Error fetching mentee profile:', error);
    res.status(500).json({ error: 'Failed to fetch mentee profile' });
  }
});

// Get mentorship requests for this mentor
router.get('/requests', mentorAuthMiddleware, async (req, res) => {
  try {
    const MentorshipRequest = require('../models/MentorshipRequest');
    const mentor = req.mentor;
    
    console.log('📨 Fetching mentorship requests for mentor:', mentor._id);
    
    // Get all requests sent to this mentor
    const requests = await MentorshipRequest.find({ mentorId: mentor._id })
      .sort({ requestDate: -1 });
    
    console.log(`✅ Found ${requests.length} requests for this mentor`);
    
    res.json({ 
      success: true,
      requests: requests,
      count: requests.length
    });
    
  } catch (err) {
    console.error('❌ Error fetching mentorship requests:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch mentorship requests',
      message: err.message 
    });
  }
});

// Update mentorship request status (accept/decline)
router.put('/requests/:requestId', mentorAuthMiddleware, async (req, res) => {
  try {
    const MentorshipRequest = require('../models/MentorshipRequest');
    const Notification = require('../models/Notification');
    const { requestId } = req.params;
    const { status, message } = req.body;
    const mentor = req.mentor;
    
    console.log('📝 Updating request:', requestId, 'to status:', status);
    
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status. Must be "accepted" or "declined"' 
      });
    }
    
    const request = await MentorshipRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({ 
        success: false,
        error: 'Request not found' 
      });
    }
    
    // Verify the current user is the mentor
    if (request.mentorId.toString() !== mentor._id.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to update this request' 
      });
    }
    
    // Update request
    request.status = status;
    request.responseDate = new Date();
    request.responseMessage = message || '';
    await request.save();
    
    console.log('✅ Request updated successfully');
    
    // Create notification for learner
    try {
      await Notification.create({
        userId: request.learnerId,
        userModel: 'User',
        type: status === 'accepted' ? 'mentorship_accepted' : 'mentorship_declined',
        title: status === 'accepted' ? 'Mentorship Request Accepted! 🎉' : 'Mentorship Request Update',
        message: status === 'accepted' 
          ? `${request.mentorName} has accepted your mentorship request!` 
          : `${request.mentorName} is unable to accept your mentorship request at this time.`,
        relatedId: requestId,
        relatedType: 'mentorship_request'
      });
      console.log('✅ Notification created for learner');
    } catch (notifError) {
      console.log('⚠️ Could not create notification:', notifError.message);
    }
    
    res.json({ 
      success: true,
      message: `Request ${status} successfully`,
      request: request
    });
    
  } catch (err) {
    console.error('❌ Error updating mentorship request:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update request',
      message: err.message 
    });
  }
});

// Get doubts assigned to this mentor
router.get('/doubts', mentorAuthMiddleware, async (req, res) => {
  try {
    const Doubt = require('../models/Doubt');
    const mentor = req.mentor;
    
    console.log('❓ Fetching doubts for mentor:', mentor._id);
    
    // Get doubts assigned to this mentor
    const doubts = await Doubt.find({ mentorId: mentor._id })
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${doubts.length} doubts for this mentor`);
    
    res.json({ 
      success: true,
      doubts: doubts,
      count: doubts.length
    });
    
  } catch (err) {
    console.error('❌ Error fetching doubts:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch doubts',
      message: err.message 
    });
  }
});

// ============ TASK MANAGEMENT ENDPOINTS ============

// Get all tasks for a specific mentee or all mentees
router.get('/tasks', mentorAuthMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const mentor = req.mentor;
    const { menteeId, status } = req.query;
    
    let query = { mentorId: mentor._id };
    if (menteeId) query.menteeId = menteeId;
    if (status) query.status = status;
    
    const tasks = await Task.find(query).sort({ dueDate: 1, createdAt: -1 });
    
    res.json({
      success: true,
      tasks: tasks,
      count: tasks.length
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch tasks',
      message: err.message 
    });
  }
});

// Create a new task for a mentee
router.post('/tasks', mentorAuthMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const mentor = req.mentor;
    const { menteeId, menteeName, title, description, category, priority, dueDate, notes } = req.body;
    
    if (!menteeId || !title || !description || !dueDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const task = new Task({
      mentorId: mentor._id,
      menteeId,
      menteeName,
      title,
      description,
      category: category || 'assignment',
      priority: priority || 'medium',
      dueDate: new Date(dueDate),
      notes
    });
    
    await task.save();
    
    // Create notification for mentee
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: menteeId,
        userModel: 'User',
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `${mentor.fullname} assigned you a new task: "${title}"`,
        relatedId: task._id,
        relatedType: 'task'
      });
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Task created successfully',
      task: task
    });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create task',
      message: err.message
    });
  }
});

// Update task
router.put('/tasks/:taskId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const Notification = require('../models/Notification');
    const mentor = req.mentor;
    const { taskId } = req.params;
    const updates = req.body;
    
    const task = await Task.findOne({ _id: taskId, mentorId: mentor._id });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    // Track old values for notifications
    const oldProgress = task.progressPercentage;
    const oldStatus = task.status;
    
    // Update allowed fields
    ['title', 'description', 'category', 'priority', 'status', 'dueDate', 'progressPercentage', 'notes', 'feedback', 'rating'].forEach(field => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });
    
    if (updates.status === 'completed') {
      task.completedDate = new Date();
      task.progressPercentage = 100;
    }
    
    await task.save();
    
    // Send notifications for progress milestones
    try {
      const newProgress = task.progressPercentage;
      
      // Notify when task reaches 25%, 50%, 75%, or 100%
      const milestones = [25, 50, 75, 100];
      const reachedMilestone = milestones.find(m => oldProgress < m && newProgress >= m);
      
      if (reachedMilestone) {
        await Notification.create({
          userId: task.menteeId,
          userModel: 'User',
          type: 'task_assigned',
          title: `Task Progress: ${reachedMilestone}%`,
          message: `Great job! You've reached ${reachedMilestone}% on "${task.title}"${reachedMilestone === 100 ? ' 🎉' : ''}`,
          relatedId: task._id,
          relatedType: 'task',
          icon: reachedMilestone === 100 ? 'check-circle' : 'chart-line'
        });
      }
      
      // Notify when status changes to completed
      if (oldStatus !== 'completed' && task.status === 'completed') {
        await Notification.create({
          userId: task.menteeId,
          userModel: 'User',
          type: 'task_assigned',
          title: 'Task Completed! 🎉',
          message: `Congratulations! "${task.title}" has been marked as completed.${task.feedback ? ' Check your mentor\'s feedback!' : ''}`,
          relatedId: task._id,
          relatedType: 'task',
          icon: 'trophy'
        });
      }
      
      // Notify when feedback is added
      if (!task.feedback && updates.feedback && updates.feedback.trim()) {
        await Notification.create({
          userId: task.menteeId,
          userModel: 'User',
          type: 'feedback_received',
          title: 'New Feedback Received',
          message: `${mentor.fullname} provided feedback on "${task.title}"`,
          relatedId: task._id,
          relatedType: 'task',
          icon: 'comment-dots'
        });
      }
    } catch (notifError) {
      console.log('Could not create task notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Task updated successfully',
      task: task
    });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update task',
      message: err.message
    });
  }
});

// Delete task
router.delete('/tasks/:taskId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const mentor = req.mentor;
    const { taskId } = req.params;
    
    const task = await Task.findOneAndDelete({ _id: taskId, mentorId: mentor._id });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete task',
      message: err.message
    });
  }
});

// ============ GOAL MANAGEMENT ENDPOINTS ============

// Get all goals for a specific mentee or all mentees
router.get('/goals', mentorAuthMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const mentor = req.mentor;
    const { menteeId, status } = req.query;
    
    let query = { mentorId: mentor._id };
    if (menteeId) query.menteeId = menteeId;
    if (status) query.status = status;
    
    const goals = await Goal.find(query).sort({ targetDate: 1, createdAt: -1 });
    
    res.json({
      success: true,
      goals: goals,
      count: goals.length
    });
  } catch (err) {
    console.error('Error fetching goals:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch goals',
      message: err.message
    });
  }
});

// Create a new goal for a mentee
router.post('/goals', mentorAuthMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const mentor = req.mentor;
    const { menteeId, menteeName, title, description, category, targetDate, milestones, notes } = req.body;
    
    if (!menteeId || !title || !description || !targetDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const goal = new Goal({
      mentorId: mentor._id,
      menteeId,
      menteeName,
      title,
      description,
      category: category || 'skill-development',
      targetDate: new Date(targetDate),
      milestones: milestones || [],
      notes
    });
    
    await goal.save();
    
    // Create notification for mentee
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: menteeId,
        userModel: 'User',
        type: 'goal_assigned',
        title: 'New Goal Set',
        message: `${mentor.fullname} set a new goal for you: "${title}"`,
        relatedId: goal._id,
        relatedType: 'goal'
      });
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Goal created successfully',
      goal: goal
    });
  } catch (err) {
    console.error('Error creating goal:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create goal',
      message: err.message
    });
  }
});

// Update goal
router.put('/goals/:goalId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const Notification = require('../models/Notification');
    const mentor = req.mentor;
    const { goalId } = req.params;
    const updates = req.body;
    
    const goal = await Goal.findOne({ _id: goalId, mentorId: mentor._id });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }
    
    // Track old values for notifications
    const oldProgress = goal.progressPercentage;
    const oldStatus = goal.status;
    const oldMilestonesCount = goal.milestones ? goal.milestones.filter(m => m.completed).length : 0;
    
    // Update allowed fields
    ['title', 'description', 'category', 'status', 'targetDate', 'progressPercentage', 'notes', 'milestones'].forEach(field => {
      if (updates[field] !== undefined) {
        goal[field] = updates[field];
      }
    });
    
    if (updates.status === 'achieved') {
      goal.achievedDate = new Date();
      goal.progressPercentage = 100;
    }
    
    await goal.save();
    
    // Send notifications for progress milestones
    try {
      const newProgress = goal.progressPercentage;
      
      // Notify when goal reaches 25%, 50%, 75%, or 100%
      const milestones = [25, 50, 75, 100];
      const reachedMilestone = milestones.find(m => oldProgress < m && newProgress >= m);
      
      if (reachedMilestone) {
        await Notification.create({
          userId: goal.menteeId,
          userModel: 'User',
          type: 'goal_assigned',
          title: `Goal Progress: ${reachedMilestone}%`,
          message: `Amazing! You've reached ${reachedMilestone}% on your goal "${goal.title}"${reachedMilestone === 100 ? ' 🎯' : ''}`,
          relatedId: goal._id,
          relatedType: 'goal',
          icon: reachedMilestone === 100 ? 'trophy' : 'bullseye'
        });
      }
      
      // Notify when goal status changes to achieved
      if (oldStatus !== 'achieved' && goal.status === 'achieved') {
        await Notification.create({
          userId: goal.menteeId,
          userModel: 'User',
          type: 'goal_assigned',
          title: 'Goal Achieved! 🎯',
          message: `Congratulations! You've achieved your goal: "${goal.title}"`,
          relatedId: goal._id,
          relatedType: 'goal',
          icon: 'star'
        });
      }
      
      // Notify when milestones are completed
      if (updates.milestones) {
        const newMilestonesCount = updates.milestones.filter(m => m.completed).length;
        if (newMilestonesCount > oldMilestonesCount) {
          const completedCount = newMilestonesCount - oldMilestonesCount;
          await Notification.create({
            userId: goal.menteeId,
            userModel: 'User',
            type: 'goal_assigned',
            title: `Milestone${completedCount > 1 ? 's' : ''} Completed! ✅`,
            message: `You completed ${completedCount} milestone${completedCount > 1 ? 's' : ''} for "${goal.title}"`,
            relatedId: goal._id,
            relatedType: 'goal',
            icon: 'check-circle'
          });
        }
      }
    } catch (notifError) {
      console.log('Could not create goal notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Goal updated successfully',
      goal: goal
    });
  } catch (err) {
    console.error('Error updating goal:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update goal',
      message: err.message
    });
  }
});

// Delete goal
router.delete('/goals/:goalId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const mentor = req.mentor;
    const { goalId } = req.params;
    
    const goal = await Goal.findOneAndDelete({ _id: goalId, mentorId: mentor._id });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Goal deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting goal:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete goal',
      message: err.message
    });
  }
});

// Get progress summary for a mentee
router.get('/progress/:menteeId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const Goal = require('../models/Goal');
    const mentor = req.mentor;
    const { menteeId } = req.params;
    
    // Get all tasks for this mentee
    const tasks = await Task.find({ mentorId: mentor._id, menteeId });
    const goals = await Goal.find({ mentorId: mentor._id, menteeId });
    
    // Calculate statistics
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      overdue: tasks.filter(t => t.status === 'overdue').length,
      averageProgress: tasks.length > 0 
        ? Math.round(tasks.reduce((sum, t) => sum + t.progressPercentage, 0) / tasks.length)
        : 0
    };
    
    const goalStats = {
      total: goals.length,
      achieved: goals.filter(g => g.status === 'achieved').length,
      active: goals.filter(g => g.status === 'active').length,
      delayed: goals.filter(g => g.status === 'delayed').length,
      averageProgress: goals.length > 0
        ? Math.round(goals.reduce((sum, g) => sum + g.progressPercentage, 0) / goals.length)
        : 0
    };
    
    res.json({
      success: true,
      menteeId,
      taskStats,
      goalStats,
      recentTasks: tasks.slice(0, 5),
      recentGoals: goals.slice(0, 5)
    });
  } catch (err) {
    console.error('Error fetching progress:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress',
      message: err.message
    });
  }
});

// ============ SESSION MANAGEMENT ENDPOINTS ============

// Get all sessions for mentor
router.get('/sessions', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const { status, menteeId, startDate, endDate, upcoming, past } = req.query;
    
    let query = { mentorId: req.mentor._id };
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Filter by mentee
    if (menteeId) {
      query.menteeId = menteeId;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }
    
    // Quick filters
    const now = new Date();
    if (upcoming === 'true') {
      query.scheduledDate = { $gte: now };
      query.status = { $in: ['scheduled', 'rescheduled'] };
    } else if (past === 'true') {
      query.scheduledDate = { $lt: now };
    }
    
    const sessions = await Session.find(query)
      .sort({ scheduledDate: -1 })
      .populate('menteeId', 'fullname email')
      .lean();
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Create new session
router.post('/sessions', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const Notification = require('../models/Notification');
    const {
      menteeId,
      menteeName,
      title,
      description,
      type,
      mode,
      scheduledDate,
      duration,
      meetingLink,
      location,
      agenda,
      notes,
      tags
    } = req.body;
    
    // Validate required fields
    if (!menteeId || !title || !scheduledDate || !mode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create session
    const session = new Session({
      mentorId: req.mentor._id,
      menteeId,
      menteeName: menteeName || 'Unknown',
      title,
      description: description || '',
      type: type || 'one-on-one',
      mode,
      scheduledDate: new Date(scheduledDate),
      duration: duration || 60,
      meetingLink,
      location,
      agenda: agenda || [],
      notes,
      tags: tags || []
    });
    
    await session.save();
    
    // Create notification for mentee
    await Notification.create({
      userId: menteeId,
      userModel: 'User',
      type: 'session_scheduled',
      title: 'New Session Scheduled',
      message: `${req.mentor.fullname} has scheduled a session: "${title}" on ${new Date(scheduledDate).toLocaleString()}`,
      relatedId: session._id,
      relatedModel: 'Session'
    });
    
    res.status(201).json({
      success: true,
      message: 'Session scheduled successfully',
      session
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session
router.put('/sessions/:sessionId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const Notification = require('../models/Notification');
    const { sessionId } = req.params;
    const updates = req.body;
    
    const session = await Session.findOne({
      _id: sessionId,
      mentorId: req.mentor._id
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Handle special status updates
    if (updates.status === 'cancelled' && session.status !== 'cancelled') {
      await Notification.create({
        userId: session.menteeId,
        userModel: 'User',
        type: 'session_cancelled',
        title: 'Session Cancelled',
        message: `Your session "${session.title}" has been cancelled`,
        relatedId: session._id,
        relatedModel: 'Session'
      });
    }
    
    if (updates.scheduledDate && updates.scheduledDate !== session.scheduledDate.toISOString()) {
      updates.status = 'rescheduled';
      await Notification.create({
        userId: session.menteeId,
        userModel: 'User',
        type: 'session_rescheduled',
        title: 'Session Rescheduled',
        message: `Your session "${session.title}" has been rescheduled to ${new Date(updates.scheduledDate).toLocaleString()}`,
        relatedId: session._id,
        relatedModel: 'Session'
      });
    }
    
    // Update session
    Object.assign(session, updates);
    await session.save();
    
    res.json({
      success: true,
      message: 'Session updated successfully',
      session
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Start session
router.post('/sessions/:sessionId/start', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const { sessionId } = req.params;
    
    const session = await Session.findOne({
      _id: sessionId,
      mentorId: req.mentor._id
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await session.startSession();
    
    res.json({
      success: true,
      message: 'Session started',
      session
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End session
router.post('/sessions/:sessionId/end', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const Notification = require('../models/Notification');
    const { sessionId } = req.params;
    const { outcomes, mentorFeedback, mentorRating } = req.body;
    
    const session = await Session.findOne({
      _id: sessionId,
      mentorId: req.mentor._id
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await session.endSession(outcomes, mentorFeedback);
    
    if (mentorRating !== undefined) {
      session.feedback.mentorRating = mentorRating;
      await session.save();
    }
    
    // Notify mentee to provide feedback
    await Notification.create({
      userId: session.menteeId,
      userModel: 'User',
      type: 'session_completed',
      title: 'Session Completed',
      message: `Your session "${session.title}" has been completed. Please provide your feedback!`,
      relatedId: session._id,
      relatedModel: 'Session',
      actionUrl: `/feedback/${session._id}`
    });
    
    res.json({
      success: true,
      message: 'Session ended successfully',
      session
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Delete session
router.delete('/sessions/:sessionId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const Notification = require('../models/Notification');
    const { sessionId } = req.params;
    
    const session = await Session.findOne({
      _id: sessionId,
      mentorId: req.mentor._id
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Notify mentee if session was scheduled
    if (session.status === 'scheduled' || session.status === 'rescheduled') {
      await Notification.create({
        userId: session.menteeId,
        userModel: 'User',
        type: 'session_cancelled',
        title: 'Session Cancelled',
        message: `Your session "${session.title}" has been cancelled`,
        relatedId: session._id,
        relatedModel: 'Session'
      });
    }
    
    await Session.deleteOne({ _id: sessionId });
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Get upcoming sessions
router.get('/sessions/upcoming/all', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const sessions = await Session.getUpcomingSessions(req.mentor._id);
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching upcoming sessions:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming sessions' });
  }
});

// Get session statistics
router.get('/sessions/stats/summary', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const { startDate, endDate } = req.query;
    
    const stats = await Session.getSessionStats(
      req.mentor._id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    
    // Get total count and calculate averages
    const totalSessions = await Session.countDocuments({ mentorId: req.mentor._id });
    const completedSessions = await Session.countDocuments({ 
      mentorId: req.mentor._id, 
      status: 'completed' 
    });
    const upcomingSessions = await Session.countDocuments({
      mentorId: req.mentor._id,
      scheduledDate: { $gte: new Date() },
      status: { $in: ['scheduled', 'rescheduled'] }
    });
    const cancelledSessions = await Session.countDocuments({
      mentorId: req.mentor._id,
      status: 'cancelled'
    });
    
    // Calculate average rating
    const ratingStats = await Session.aggregate([
      {
        $match: {
          mentorId: req.mentor._id,
          'feedback.menteeRating': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$feedback.menteeRating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        total: totalSessions,
        completed: completedSessions,
        upcoming: upcomingSessions,
        cancelled: cancelledSessions,
        averageRating: ratingStats.length > 0 ? Math.round(ratingStats[0].avgRating * 10) / 10 : 0,
        totalRatings: ratingStats.length > 0 ? ratingStats[0].totalRatings : 0,
        statusBreakdown: stats
      }
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
});

// Add resource to session
router.post('/sessions/:sessionId/resources', mentorAuthMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const { sessionId } = req.params;
    const { name, url, type } = req.body;
    
    const session = await Session.findOne({
      _id: sessionId,
      mentorId: req.mentor._id
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    session.resources.push({ name, url, type });
    await session.save();
    
    res.json({
      success: true,
      message: 'Resource added successfully',
      session
    });
  } catch (error) {
    console.error('Error adding resource:', error);
    res.status(500).json({ error: 'Failed to add resource' });
  }
});

// ============ NOTIFICATION ENDPOINTS ============

// Get notifications for mentor
router.get('/notifications', mentorAuthMiddleware, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const { unreadOnly, limit = 20 } = req.query;
    
    let query = { 
      userId: req.mentor._id,
      userModel: 'Mentor'
    };
    
    if (unreadOnly === 'true') {
      query.read = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    const unreadCount = await Notification.countDocuments({
      userId: req.mentor._id,
      userModel: 'Mentor',
      read: false
    });
    
    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:notificationId/read', mentorAuthMiddleware, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const { notificationId } = req.params;
    
    const notification = await Notification.findOne({
      _id: notificationId,
      userId: req.mentor._id
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await notification.markAsRead();
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', mentorAuthMiddleware, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    
    await Notification.updateMany(
      { 
        userId: req.mentor._id,
        userModel: 'Mentor',
        read: false 
      },
      { 
        read: true,
        readAt: new Date()
      }
    );
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/notifications/:notificationId', mentorAuthMiddleware, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const { notificationId } = req.params;
    
    await Notification.deleteOne({
      _id: notificationId,
      userId: req.mentor._id
    });
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
