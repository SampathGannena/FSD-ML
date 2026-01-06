const express = require('express');
const router = express.Router();
const { signup, signin, logout } = require('../controllers/authController');
const { forgotPassword } = require('../controllers/authController');
const {resetPassword} = require('../controllers/authController')
const authMiddleware = require('../middleware/authMiddleware');
// const multer = require('multer');
// const upload = multer({ dest: 'uploads/' });

// router.post('/signup', signup);
router.post('/signup',signup);
router.post('/signin', signin);
router.post('/logout', authMiddleware, logout); // Protected logout route
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Session feedback endpoint for learners
router.post('/session-feedback/:sessionId', authMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const Notification = require('../models/Notification');
    const { sessionId } = req.params;
    const { menteeRating, menteeComment } = req.body;
    
    // Validate rating
    if (!menteeRating || menteeRating < 1 || menteeRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Find session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify this is the mentee's session
    if (session.menteeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to rate this session' });
    }
    
    // Check if feedback already submitted
    if (session.feedback.menteeRating) {
      return res.status(400).json({ error: 'Feedback already submitted for this session' });
    }
    
    // Update feedback
    session.feedback.menteeRating = menteeRating;
    session.feedback.menteeComment = menteeComment || '';
    session.feedback.submittedAt = new Date();
    await session.save();
    
    // Notify mentor about the feedback
    await Notification.create({
      userId: session.mentorId,
      userModel: 'Mentor',
      type: 'feedback_received',
      title: 'New Feedback Received',
      message: `${session.menteeName} rated your session "${session.title}" ${menteeRating}/5 stars`,
      relatedId: session._id,
      relatedModel: 'Session'
    });
    
    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      session
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get session details for feedback (learners)
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const Session = require('../models/Session');
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify this is the mentee's session
    if (session.menteeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to view this session' });
    }
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ============ MENTEE TASK & GOAL ENDPOINTS ============

// Get all tasks for current user
router.get('/tasks', authMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const tasks = await Task.find({ menteeId: req.user._id }).sort({ dueDate: 1 });
    
    res.json({
      success: true,
      tasks: tasks
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get all goals for current user
router.get('/goals', authMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const goals = await Goal.find({ menteeId: req.user._id }).sort({ targetDate: 1 });
    
    res.json({
      success: true,
      goals: goals
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Update task progress
router.put('/tasks/:taskId/progress', authMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const Notification = require('../models/Notification');
    const { taskId } = req.params;
    const { progressPercentage } = req.body;
    
    const task = await Task.findOne({ _id: taskId, menteeId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const oldProgress = task.progressPercentage;
    task.progressPercentage = Math.min(100, Math.max(0, progressPercentage));
    
    // Auto-update status based on progress
    if (task.progressPercentage === 100 && task.status !== 'completed') {
      task.status = 'completed';
      task.completedDate = new Date();
    } else if (task.progressPercentage > 0 && task.status === 'pending') {
      task.status = 'in-progress';
    }
    
    await task.save();
    
    // Notify mentor about progress update
    try {
      const milestones = [25, 50, 75, 100];
      const reachedMilestone = milestones.find(m => oldProgress < m && task.progressPercentage >= m);
      
      if (reachedMilestone) {
        await Notification.create({
          userId: task.mentorId,
          userModel: 'Mentor',
          type: 'task_assigned',
          title: `Task Progress Updated`,
          message: `${req.user.fullname} reached ${reachedMilestone}% on "${task.title}"`,
          relatedId: task._id,
          relatedType: 'task'
        });
      }
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Progress updated successfully',
      task
    });
  } catch (error) {
    console.error('Error updating task progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Mark task as complete
router.put('/tasks/:taskId/complete', authMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const Notification = require('../models/Notification');
    const { taskId } = req.params;
    
    const task = await Task.findOne({ _id: taskId, menteeId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    task.status = 'completed';
    task.completedDate = new Date();
    task.progressPercentage = 100;
    await task.save();
    
    // Notify mentor
    try {
      await Notification.create({
        userId: task.mentorId,
        userModel: 'Mentor',
        type: 'task_assigned',
        title: 'Task Completed',
        message: `${req.user.fullname} completed the task: "${task.title}"`,
        relatedId: task._id,
        relatedType: 'task',
        icon: 'check-circle'
      });
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Task marked as complete',
      task
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Update goal progress
router.put('/goals/:goalId/progress', authMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const Notification = require('../models/Notification');
    const { goalId } = req.params;
    const { progressPercentage } = req.body;
    
    const goal = await Goal.findOne({ _id: goalId, menteeId: req.user._id });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const oldProgress = goal.progressPercentage;
    goal.progressPercentage = Math.min(100, Math.max(0, progressPercentage));
    
    // Auto-update status
    if (goal.progressPercentage === 100 && goal.status !== 'achieved') {
      goal.status = 'achieved';
      goal.achievedDate = new Date();
    }
    
    await goal.save();
    
    // Notify mentor
    try {
      const milestones = [25, 50, 75, 100];
      const reachedMilestone = milestones.find(m => oldProgress < m && goal.progressPercentage >= m);
      
      if (reachedMilestone) {
        await Notification.create({
          userId: goal.mentorId,
          userModel: 'Mentor',
          type: 'goal_assigned',
          title: `Goal Progress Updated`,
          message: `${req.user.fullname} reached ${reachedMilestone}% on goal "${goal.title}"`,
          relatedId: goal._id,
          relatedType: 'goal'
        });
      }
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Progress updated successfully',
      goal
    });
  } catch (error) {
    console.error('Error updating goal progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Mark goal as achieved
router.put('/goals/:goalId/achieve', authMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const Notification = require('../models/Notification');
    const { goalId } = req.params;
    
    const goal = await Goal.findOne({ _id: goalId, menteeId: req.user._id });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    goal.status = 'achieved';
    goal.achievedDate = new Date();
    goal.progressPercentage = 100;
    await goal.save();
    
    // Notify mentor
    try {
      await Notification.create({
        userId: goal.mentorId,
        userModel: 'Mentor',
        type: 'goal_assigned',
        title: 'Goal Achieved! 🎯',
        message: `${req.user.fullname} achieved the goal: "${goal.title}"`,
        relatedId: goal._id,
        relatedType: 'goal',
        icon: 'trophy'
      });
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    res.json({
      success: true,
      message: 'Goal marked as achieved',
      goal
    });
  } catch (error) {
    console.error('Error achieving goal:', error);
    res.status(500).json({ error: 'Failed to achieve goal' });
  }
});

// Update goal milestones
router.put('/goals/:goalId/milestones', authMiddleware, async (req, res) => {
  try {
    const Goal = require('../models/Goal');
    const Notification = require('../models/Notification');
    const { goalId } = req.params;
    const { milestones } = req.body;
    
    const goal = await Goal.findOne({ _id: goalId, menteeId: req.user._id });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const oldCompletedCount = goal.milestones ? goal.milestones.filter(m => m.completed).length : 0;
    goal.milestones = milestones;
    
    // Auto-calculate progress based on milestones
    if (milestones && milestones.length > 0) {
      const completedCount = milestones.filter(m => m.completed).length;
      goal.progressPercentage = Math.round((completedCount / milestones.length) * 100);
      
      // Notify mentor if new milestones completed
      if (completedCount > oldCompletedCount) {
        try {
          await Notification.create({
            userId: goal.mentorId,
            userModel: 'Mentor',
            type: 'goal_assigned',
            title: 'Milestone Completed',
            message: `${req.user.fullname} completed a milestone for "${goal.title}"`,
            relatedId: goal._id,
            relatedType: 'goal',
            icon: 'flag-checkered'
          });
        } catch (notifError) {
          console.log('Could not create notification:', notifError.message);
        }
      }
    }
    
    await goal.save();
    
    res.json({
      success: true,
      message: 'Milestones updated successfully',
      goal
    });
  } catch (error) {
    console.error('Error updating milestones:', error);
    res.status(500).json({ error: 'Failed to update milestones' });
  }
});


module.exports = router;

