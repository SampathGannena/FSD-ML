const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const { signup, signin, logout } = require('../controllers/authController');
const { forgotPassword } = require('../controllers/authController');
const {resetPassword} = require('../controllers/authController')
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');
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

// Get personalized progress analytics for current learner
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const Goal = require('../models/Goal');
    const Session = require('../models/Session');
    const StudySession = require('../models/StudySession');

    const allowedRanges = new Set([7, 30, 90, 365]);
    const parsedRange = Number.parseInt(req.query?.range, 10);
    const rangeDays = allowedRanges.has(parsedRange) ? parsedRange : 7;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (rangeDays - 1));

    const [tasks, goals, mentorSessions, studySessions] = await Promise.all([
      Task.find({ menteeId: req.user._id })
        .select('title status progressPercentage category completedDate dueDate createdAt updatedAt')
        .lean(),
      Goal.find({ menteeId: req.user._id })
        .select('title status progressPercentage category achievedDate createdAt updatedAt')
        .lean(),
      Session.find({
        menteeId: req.user._id,
        scheduledDate: { $gte: startDate, $lte: endDate }
      })
        .select('title status scheduledDate createdAt updatedAt')
        .lean(),
      StudySession.find({
        $and: [
          {
            $or: [
              { organizer: req.user._id },
              { 'participants.user': req.user._id }
            ]
          },
          { sessionDate: { $gte: startDate, $lte: endDate } }
        ]
      })
        .select('title status subject sessionDate createdAt updatedAt')
        .lean()
    ]);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed' || Number(task.progressPercentage) >= 100).length;
    const activeGoals = goals.filter(goal => goal.status === 'active').length;
    const mentorSessionCount = mentorSessions.filter(session => ['completed', 'ongoing'].includes(session.status)).length;

    const labels = [];
    const dayKeys = [];
    const dayScores = {};
    const sessionCounts = {};

    for (let i = 0; i < rangeDays; i += 1) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);

      const key = toDayKey(day);
      dayKeys.push(key);
      labels.push(day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      dayScores[key] = 0;
      sessionCounts[key] = 0;
    }

    tasks.forEach(task => {
      if (task.completedDate) {
        const key = toDayKey(task.completedDate);
        if (dayScores[key] !== undefined) {
          dayScores[key] += 12;
        }
      }
    });

    goals.forEach(goal => {
      if (goal.achievedDate) {
        const key = toDayKey(goal.achievedDate);
        if (dayScores[key] !== undefined) {
          dayScores[key] += 18;
        }
      }
    });

    mentorSessions.forEach(session => {
      const key = toDayKey(session.scheduledDate);
      if (dayScores[key] !== undefined) {
        if (session.status === 'completed') {
          dayScores[key] += 10;
        } else if (session.status === 'ongoing') {
          dayScores[key] += 6;
        }
      }
      if (sessionCounts[key] !== undefined && ['scheduled', 'ongoing', 'completed'].includes(session.status)) {
        sessionCounts[key] += 1;
      }
    });

    studySessions.forEach(session => {
      const key = toDayKey(session.sessionDate);
      if (dayScores[key] !== undefined) {
        if (session.status === 'completed') {
          dayScores[key] += 8;
        } else if (session.status === 'in-progress') {
          dayScores[key] += 4;
        }
      }
      if (sessionCounts[key] !== undefined && ['scheduled', 'in-progress', 'completed'].includes(session.status)) {
        sessionCounts[key] += 1;
      }
    });

    const progressTrendData = dayKeys.map(key => Math.min(100, dayScores[key]));
    const studySessionData = dayKeys.map(key => sessionCounts[key]);

    const taskDistribution = {
      completed: tasks.filter(task => task.status === 'completed' || Number(task.progressPercentage) >= 100).length,
      inProgress: tasks.filter(task => ['in-progress', 'overdue'].includes(task.status) || (Number(task.progressPercentage) > 0 && Number(task.progressPercentage) < 100)).length,
      pending: tasks.filter(task => ['pending', 'cancelled'].includes(task.status) || Number(task.progressPercentage) === 0).length
    };

    const subjectScores = {};
    tasks.forEach(task => {
      const label = formatCategory(task.category);
      subjectScores[label] = (subjectScores[label] || 0) + (Number(task.progressPercentage) || 0);
    });
    goals.forEach(goal => {
      const label = formatCategory(goal.category);
      const score = goal.status === 'achieved' ? 100 : (Number(goal.progressPercentage) || 0);
      subjectScores[label] = (subjectScores[label] || 0) + score;
    });
    studySessions.forEach(session => {
      const label = formatCategory(session.subject);
      const score = session.status === 'completed' ? 100 : session.status === 'in-progress' ? 60 : 30;
      subjectScores[label] = (subjectScores[label] || 0) + score;
    });

    const topSubjects = Object.entries(subjectScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const subjectLabels = topSubjects.length
      ? topSubjects.map(([label]) => label)
      : ['Tasks', 'Goals', 'Mentor Sessions', 'Study Sessions', 'Consistency'];
    const subjectData = topSubjects.length
      ? topSubjects.map(([, score]) => Math.min(100, Math.round(score / Math.max(1, rangeDays / 7))))
      : [0, 0, 0, 0, 0];

    const recentActivities = [];

    tasks.forEach(task => {
      if (task.completedDate) {
        recentActivities.push({
          type: 'task_completed',
          title: `Completed task: ${task.title}`,
          timestamp: task.completedDate
        });
      }
    });

    goals.forEach(goal => {
      if (goal.achievedDate) {
        recentActivities.push({
          type: 'goal_achieved',
          title: `Achieved goal: ${goal.title}`,
          timestamp: goal.achievedDate
        });
      }
    });

    mentorSessions.forEach(session => {
      if (session.status === 'completed') {
        recentActivities.push({
          type: 'mentor_session',
          title: `Completed mentorship session: ${session.title}`,
          timestamp: session.scheduledDate
        });
      }
    });

    studySessions.forEach(session => {
      if (['completed', 'in-progress'].includes(session.status)) {
        recentActivities.push({
          type: 'study_session',
          title: `${session.status === 'completed' ? 'Completed' : 'Attended'} study session: ${session.title}`,
          timestamp: session.sessionDate
        });
      }
    });

    recentActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      totalTasks,
      completedTasks,
      activeGoals,
      mentorSessions: mentorSessionCount,
      progressTrend: {
        labels,
        data: progressTrendData
      },
      taskDistribution,
      studySessions: {
        labels,
        data: studySessionData
      },
      subjectPerformance: {
        labels: subjectLabels,
        data: subjectData
      },
      recentActivities: recentActivities.slice(0, 10)
    });
  } catch (error) {
    console.error('Error loading learner progress:', error);
    res.status(500).json({ success: false, error: 'Failed to load learner progress' });
  }
});

function toDayKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function formatCategory(value) {
  if (!value) {
    return 'General';
  }
  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

function buildFallbackDoubtDraft(text) {
  const raw = String(text || '').trim();
  const normalized = raw.toLowerCase();

  let category = 'other';
  if (/bug|error|exception|api|code|node|react|javascript|python|sql/.test(normalized)) {
    category = 'technical';
  } else if (/understand|concept|theory|why|how does/.test(normalized)) {
    category = 'conceptual';
  } else if (/project|architecture|design|deploy|deployment|integrat/.test(normalized)) {
    category = 'project';
  } else if (/career|interview|resume|job|internship/.test(normalized)) {
    category = 'career';
  }

  let priority = 'medium';
  if (/urgent|asap|immediately|production down|critical/.test(normalized)) {
    priority = 'urgent';
  } else if (/important|blocked|stuck|deadline|failing/.test(normalized)) {
    priority = 'high';
  } else if (/minor|whenever|low priority|later/.test(normalized)) {
    priority = 'low';
  }

  const subject = raw
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim() || 'Need help with a learning issue';

  return {
    category,
    subject,
    question: raw || 'Please help me understand and resolve this issue.',
    priority
  };
}

router.post('/doubts/submit', authMiddleware, async (req, res) => {
  try {
    const Doubt = require('../models/Doubt');
    const Mentor = require('../models/Mentor');

    const mentorId = req.body?.mentorId || null;
    const category = String(req.body?.category || '').trim().toLowerCase();
    const subject = String(req.body?.subject || '').trim();
    const question = String(req.body?.question || '').trim();
    const priority = String(req.body?.priority || 'medium').trim().toLowerCase();

    if (!category || !subject || !question) {
      return res.status(400).json({
        success: false,
        error: 'Category, subject, and question are required'
      });
    }

    const allowedCategories = ['technical', 'conceptual', 'project', 'career', 'other'];
    const allowedPriorities = ['low', 'medium', 'high', 'urgent'];

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ success: false, error: 'Invalid category value' });
    }

    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({ success: false, error: 'Invalid priority value' });
    }

    let mentorName = '';
    let resolvedMentorId = null;
    if (mentorId) {
      const mentor = await Mentor.findById(mentorId).select('fullname name email');
      if (!mentor) {
        return res.status(404).json({ success: false, error: 'Selected mentor not found' });
      }
      resolvedMentorId = mentor._id;
      mentorName = mentor.fullname || mentor.name || mentor.email || '';
    }

    const doubt = await Doubt.create({
      studentId: req.user._id,
      studentName: req.user.fullname || req.user.name || 'Learner',
      studentEmail: req.user.email || '',
      mentorId: resolvedMentorId,
      mentorName,
      category,
      subject,
      question,
      priority,
      status: 'open',
      isPublic: true
    });

    return res.status(201).json({
      success: true,
      message: 'Doubt submitted successfully',
      doubt
    });
  } catch (error) {
    console.error('Error submitting learner doubt:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit doubt' });
  }
});

router.get('/doubts', authMiddleware, async (req, res) => {
  try {
    const Doubt = require('../models/Doubt');

    const doubts = await Doubt.find({ studentId: req.user._id })
      .sort({ createdAt: -1 })
      .select('mentorId mentorName category subject question priority status comments createdAt updatedAt');

    const normalized = doubts.map(item => ({
      _id: item._id,
      mentorId: item.mentorId,
      mentorName: item.mentorName || '',
      category: item.category,
      subject: item.subject,
      question: item.question,
      priority: item.priority,
      status: item.status,
      answers: Array.isArray(item.comments) ? item.comments.length : 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return res.json({
      success: true,
      doubts: normalized,
      count: normalized.length
    });
  } catch (error) {
    console.error('Error fetching learner doubts:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch doubts' });
  }
});

router.post('/ai-chat/draft-doubt', authMiddleware, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required to draft a doubt' });
    }

    const draft = buildFallbackDoubtDraft(text);
    return res.json({ success: true, draft });
  } catch (error) {
    console.error('AI draft doubt error:', error);
    return res.status(500).json({ success: false, error: 'Failed to draft doubt' });
  }
});

// AI chat endpoints for LearnerBot
const DEFAULT_LEARNER_GREETING = "Hi there! I'm LearnerBot. Ask me anything about your study groups or learning resources!";

router.get('/ai-chat/threads', authMiddleware, async (req, res) => {
  try {
    const threads = await Conversation.find({
      userId: req.user._id,
      channel: 'learnerbot'
    })
      .sort({ isPinned: -1, lastActiveAt: -1, updatedAt: -1 })
      .select('threadId title summary lastActiveAt updatedAt messages isPinned');

    return res.json({
      success: true,
      threads: threads.map(thread => serializeThread(thread))
    });
  } catch (error) {
    console.error('AI threads error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load chat threads' });
  }
});

router.post('/ai-chat/threads', authMiddleware, async (req, res) => {
  try {
    const title = sanitizeThreadTitle(req.body?.title || 'New Chat');
    const threadId = String(req.body?.threadId || randomUUID());
    const conversation = await Conversation.findOneAndUpdate(
      { userId: req.user._id, threadId },
      {
        $setOnInsert: {
          userId: req.user._id,
          threadId,
          channel: 'learnerbot',
          title,
          summary: '',
          messages: [{ role: 'assistant', content: DEFAULT_LEARNER_GREETING, createdAt: new Date() }],
          lastActiveAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      thread: serializeThread(conversation)
    });
  } catch (error) {
    console.error('AI create thread error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create chat thread' });
  }
});

router.patch('/ai-chat/threads/:threadId', authMiddleware, async (req, res) => {
  try {
    const threadId = String(req.params?.threadId || '').trim();
    const title = sanitizeThreadTitle(req.body?.title);

    if (!threadId) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { userId: req.user._id, threadId, channel: 'learnerbot' },
      { $set: { title, lastActiveAt: new Date() } },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    return res.json({
      success: true,
      message: 'Thread renamed successfully',
      thread: serializeThread(conversation)
    });
  } catch (error) {
    console.error('AI rename thread error:', error);
    return res.status(500).json({ success: false, error: 'Failed to rename thread' });
  }
});

router.delete('/ai-chat/threads/:threadId', authMiddleware, async (req, res) => {
  try {
    const threadId = String(req.params?.threadId || '').trim();
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }

    const deleted = await Conversation.findOneAndDelete({
      userId: req.user._id,
      threadId,
      channel: 'learnerbot'
    });

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    return res.json({
      success: true,
      message: 'Thread deleted successfully',
      threadId
    });
  } catch (error) {
    console.error('AI delete thread error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete thread' });
  }
});

router.get('/ai-chat/history', authMiddleware, async (req, res) => {
  try {
    const conversation = await getOrCreateConversation(req.user._id, req.query?.threadId);
    return res.json({
      success: true,
      thread: serializeThread(conversation),
      messages: conversation.messages,
      count: conversation.messages.length,
      summary: conversation.summary || ''
    });
  } catch (error) {
    console.error('AI chat history error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load chat history' });
  }
});

router.delete('/ai-chat/history', authMiddleware, async (req, res) => {
  try {
    const conversation = await getOrCreateConversation(req.user._id, req.query?.threadId);
    conversation.messages = [{ role: 'assistant', content: DEFAULT_LEARNER_GREETING, createdAt: new Date() }];
    conversation.summary = '';
    conversation.summaryUpdatedAt = new Date();
    conversation.lastActiveAt = new Date();
    conversation.title = 'New Chat';
    await conversation.save();

    return res.json({
      success: true,
      message: 'Chat history cleared',
      thread: serializeThread(conversation),
      messages: conversation.messages
    });
  } catch (error) {
    console.error('AI clear history error:', error);
    return res.status(500).json({ success: false, error: 'Failed to clear chat history' });
  }
});

router.get('/ai-chat/export', authMiddleware, async (req, res) => {
  try {
    const conversation = await getOrCreateConversation(req.user._id, req.query?.threadId);
    const exportText = buildExportText(conversation, req.user);

    return res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      thread: serializeThread(conversation),
      user: {
        id: req.user?._id,
        fullname: req.user?.fullname || 'Learner',
        email: req.user?.email || ''
      },
      messages: conversation.messages,
      summary: conversation.summary || '',
      exportText
    });
  } catch (error) {
    console.error('AI export history error:', error);
    return res.status(500).json({ success: false, error: 'Failed to export chat history' });
  }
});

router.post('/ai-chat', authMiddleware, async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const threadId = String(req.body?.threadId || '').trim();

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const conversation = await getOrCreateConversation(req.user._id, threadId);
    const userProfile = {
      name: req.user?.fullname || 'Learner',
      email: req.user?.email || ''
    };

    if (!conversation.title || conversation.title === 'New Chat') {
      conversation.title = deriveConversationTitle(message);
    }

    const providerOrder = getProviderOrder(req.user, req.body?.provider);
    const modelMessages = buildModelMessages(conversation, message, userProfile);

    const errors = [];
    for (const provider of providerOrder) {
      try {
        let reply = null;

        if (provider === 'groq') {
          reply = await generateWithGroq(modelMessages, userProfile);
        } else if (provider === 'openai') {
          reply = await generateWithOpenAI(modelMessages, userProfile);
        } else if (provider === 'gemini') {
          reply = await generateWithGemini(modelMessages, userProfile);
        }

        if (reply) {
          appendConversationMessage(conversation, 'user', message);
          appendConversationMessage(conversation, 'assistant', reply);
          await maybeSummarizeConversation(conversation, provider, userProfile);
          conversation.lastActiveAt = new Date();
          await conversation.save();

          return res.json({
            success: true,
            provider,
            thread: serializeThread(conversation),
            reply,
            timestamp: new Date().toISOString(),
            messageCount: conversation.messages.length,
            summary: conversation.summary || ''
          });
        }
      } catch (providerError) {
        errors.push(`${provider}: ${providerError.message}`);
      }
    }

    return res.status(503).json({
      success: false,
      error: 'AI service is unavailable',
      details: errors.length ? errors : ['No configured provider key found']
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process AI chat request' });
  }
});

function sanitizeThreadTitle(title) {
  return String(title || 'New Chat').trim().replace(/\s+/g, ' ').slice(0, 48) || 'New Chat';
}

function serializeThread(thread) {
  return {
    threadId: thread.threadId,
    title: thread.title || 'New Chat',
    summary: thread.summary || '',
    lastActiveAt: thread.lastActiveAt,
    updatedAt: thread.updatedAt,
    messageCount: Array.isArray(thread.messages) ? thread.messages.length : 0,
    isPinned: Boolean(thread.isPinned)
  };
}

function getThreadIdFallback(threadId) {
  return threadId || 'default';
}

async function getOrCreateConversation(userId, threadId) {
  const resolvedThreadId = getThreadIdFallback(threadId);
  const conversation = await Conversation.findOneAndUpdate(
    { userId, threadId: resolvedThreadId, channel: 'learnerbot' },
    {
      $setOnInsert: {
        userId,
        threadId: resolvedThreadId,
        channel: 'learnerbot',
        title: 'New Chat',
        summary: '',
        messages: [{ role: 'assistant', content: DEFAULT_LEARNER_GREETING, createdAt: new Date() }],
        lastActiveAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  return conversation;
}

function buildExportText(conversation, user) {
  const lines = [];
  lines.push(`LearnerBot Export`);
  lines.push(`Thread: ${conversation.title || 'New Chat'}`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`User: ${user?.fullname || 'Learner'} (${user?.email || 'no-email'})`);
  if (conversation.summary) {
    lines.push('');
    lines.push('Summary:');
    lines.push(conversation.summary);
  }
  lines.push('');
  lines.push('Messages:');

  conversation.messages.forEach(message => {
    const speaker = message.role === 'assistant' ? 'LearnerBot' : (user?.fullname || 'You');
    const stamp = new Date(message.createdAt || Date.now()).toISOString();
    lines.push(`[${stamp}] ${speaker}: ${message.content}`);
  });

  return lines.join('\n');
}

function normalizeChatHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '').trim().slice(0, 1400)
    }))
    .filter(item => item.content);
}

function estimateTokenCount(text) {
  if (!text) {
    return 0;
  }

  return Math.ceil(String(text).length / 4);
}

function getProviderOrder(user, requestedProvider) {
  const explicit = String(requestedProvider || '').toLowerCase();
  if (explicit && explicit !== 'auto') {
    return [explicit];
  }

  const plan = String(user?.subscription?.plan || 'starter').toLowerCase();
  const envPreference = String(process.env.AI_PROVIDER || 'auto').toLowerCase();

  if (plan === 'starter' || plan === 'trial') {
    return ['groq', 'openai', 'gemini'];
  }

  if (envPreference !== 'auto') {
    return [envPreference];
  }

  return ['openai', 'gemini', 'groq'];
}

function appendConversationMessage(conversation, role, content) {
  conversation.messages.push({
    role,
    content: String(content || '').trim().slice(0, 4000),
    createdAt: new Date()
  });
}

function buildModelMessages(conversation, latestUserMessage, userProfile) {
  const systemParts = [
    'You are LearnerBot for StudyFinder.',
    'Be concise, friendly, practical, and student-focused.',
    'Use prior conversation context for continuity and personalization.',
    `Learner name: ${userProfile.name}.`,
    'Focus on study groups, mentors, doubts, productivity, and progress support.',
    'If uncertain, ask one clarifying question instead of inventing facts.'
  ];

  if (conversation.summary) {
    systemParts.push(`Conversation summary so far: ${conversation.summary}`);
  }

  const summaryTokens = estimateTokenCount(conversation.summary || '');
  const latest = {
    role: 'user',
    content: String(latestUserMessage || '').trim().slice(0, 1400)
  };

  const budget = Math.max(500, Number(process.env.AI_CONTEXT_TOKEN_BUDGET || 1800) - 200 - summaryTokens);
  const history = normalizeChatHistory(conversation.messages);
  const selected = [latest];
  let used = estimateTokenCount(latest.content);

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    const cost = estimateTokenCount(item.content);
    if (used + cost > budget) {
      break;
    }

    selected.unshift(item);
    used += cost;
  }

  return [
    { role: 'system', content: systemParts.join(' ') },
    ...selected
  ];
}

function buildSummaryPrompt(conversation, userProfile) {
  const recent = normalizeChatHistory(conversation.messages).slice(-12);
  const transcript = recent.map(item => `${item.role.toUpperCase()}: ${item.content}`).join('\n');

  return [
    'Summarize the conversation for future memory in 4-6 bullet points.',
    'Keep only durable facts, preferences, goals, and open questions.',
    'Do not mention system prompts or token limits.',
    `Learner name: ${userProfile.name}.`,
    conversation.summary ? `Existing summary: ${conversation.summary}` : '',
    'Recent messages:',
    transcript
  ].filter(Boolean).join('\n');
}

async function maybeSummarizeConversation(conversation, provider, userProfile) {
  const summaryTrigger = Number(process.env.AI_SUMMARY_TRIGGER_TOKENS || 2500);
  const summaryResetMessages = Number(process.env.AI_SUMMARY_KEEP_MESSAGES || 8);
  const approxTokens = conversation.messages.reduce((total, item) => total + estimateTokenCount(item.content), 0);

  if (approxTokens < summaryTrigger || conversation.messages.length <= summaryResetMessages) {
    return;
  }

  const olderMessages = conversation.messages.slice(0, Math.max(0, conversation.messages.length - summaryResetMessages));
  const newerMessages = conversation.messages.slice(-summaryResetMessages);
  const existingSummary = conversation.summary || '';

  try {
    const summary = await generateSummaryWithProvider(provider, buildSummaryPrompt({
      summary: existingSummary,
      messages: olderMessages,
      title: conversation.title
    }, userProfile));

    conversation.summary = mergeSummary(existingSummary, summary);
    conversation.summaryUpdatedAt = new Date();
    conversation.messages = newerMessages;
  } catch (error) {
    console.error('Conversation summarization failed:', error.message);
    conversation.summary = mergeSummary(existingSummary, buildHeuristicSummary(olderMessages));
    conversation.summaryUpdatedAt = new Date();
    conversation.messages = newerMessages;
  }
}

function mergeSummary(existingSummary, newSummary) {
  const parts = [existingSummary, newSummary].filter(Boolean).map(text => String(text).trim());
  return parts.join('\n').slice(0, 6000);
}

function buildHeuristicSummary(messages) {
  const highlights = [];
  messages.slice(-10).forEach(message => {
    const label = message.role === 'assistant' ? 'Bot' : 'User';
    highlights.push(`${label}: ${message.content.slice(0, 140)}`);
  });

  return `Earlier context:\n${highlights.join('\n')}`.slice(0, 2500);
}

function buildSystemPrompt(userProfile) {
  return [
    'You are LearnerBot for StudyFinder.',
    'Be concise, friendly, and practical for students.',
    'Use the recent conversation context to keep continuity and personalization.',
    `Current learner name: ${userProfile.name}.`,
    'Focus on study groups, mentors, doubts, productivity, and progress support.',
    'If uncertain, ask a clarifying question instead of inventing facts.'
  ].join(' ');
}

async function generateWithOpenAI(conversation, userProfile) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 350,
      messages: [
        { role: 'system', content: buildSystemPrompt(userProfile) },
        ...conversation
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody.slice(0, 240)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenAI returned empty response');
  }
  return text;
}

async function generateWithGroq(conversation, userProfile) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const model = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 350,
      messages: [
        { role: 'system', content: buildSystemPrompt(userProfile) },
        ...conversation
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${errorBody.slice(0, 240)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Groq returned empty response');
  }
  return text;
}

async function generateSummaryWithProvider(provider, summaryPrompt) {
  const summaryMessages = [
    { role: 'system', content: 'You are a concise conversation summarizer for a study assistant.' },
    { role: 'user', content: summaryPrompt }
  ];

  if (provider === 'groq' && process.env.GROQ_API_KEY) {
    return generateCompactChatCompletion('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, process.env.GROQ_MODEL || 'llama-3.1-70b-versatile', summaryMessages);
  }

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return generateCompactChatCompletion('https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL || 'gpt-4o-mini', summaryMessages);
  }

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return generateGeminiSummary(summaryPrompt);
  }

  throw new Error('No summarization provider available');
}

async function generateCompactChatCompletion(endpoint, apiKey, model, messages) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 220,
      messages
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Summary request failed (${response.status}): ${errorBody.slice(0, 240)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Summary returned empty response');
  }
  return text;
}

async function generateGeminiSummary(summaryPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 220
      },
      contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini summary failed (${response.status}): ${errorBody.slice(0, 240)}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(part => part.text || '').join('').trim();
  if (!text) {
    throw new Error('Gemini summary returned empty response');
  }
  return text;
}

async function generateWithGemini(conversation, userProfile) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemMessage = conversation.find(item => item.role === 'system');
  const dialogueMessages = conversation.filter(item => item.role !== 'system');

  const contents = dialogueMessages.map(item => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }]
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemMessage?.content || buildSystemPrompt(userProfile) }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 350
      },
      contents
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody.slice(0, 240)}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(part => part.text || '').join('').trim();
  if (!text) {
    throw new Error('Gemini returned empty response');
  }
  return text;
}


module.exports = router;

