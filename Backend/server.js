const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const fs = require('fs');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profile');
const mentorAuthRoutes = require('./routes/mentorAuth');
const groupRoutes = require('./routes/groupRoutes');
const groupStatsRoutes = require('./routes/groupStatsRoutes');
const videoRoomRoutes = require('./routes/videoRoomRoutes');
const studySessionRoutes = require('./routes/studySessionRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const cors = require('cors');
const path = require('path');
const Group = require('./models/Group');
const WebSocket = require('ws');
const Message = require('./models/Message');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const File = require('./models/File'); // This saves files to the 'uploads' folder
const { PeerServer } = require('peer');
const securityConfig = require('./config/security');

dotenv.config();
const app = express();

// Apply security middleware
securityConfig(app);

// Serve static files from the entire Frontend folder
app.use(express.static(path.join(__dirname, '../Frontend')));

// Serve static files from the Frontend/landing folder (for backward compatibility)
app.use('/landing', express.static(path.join(__dirname, '../Frontend/landing')));

// Serve static files from the Frontend/mentorDash folder
app.use('/mentorDash', express.static(path.join(__dirname, '../Frontend/mentorDash')));

// Serve static files from the Frontend/credentials folder
app.use('/credentials', express.static(path.join(__dirname, '../Frontend/credentials')));

// Serve static files from the Frontend/Dashboards folder
app.use('/Dashboards', express.static(path.join(__dirname, '../Frontend/Dashboards')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route for landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/landing/land.html'));
});
app.use(bodyParser.json());

// Configure CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://your-frontend-domain.com']
    : ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5500'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle Chrome DevTools well-known endpoint to suppress CSP warning
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.json({});
});

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log(err));

app.use('/api/auth', authRoutes);
app.use('/api/mentor', mentorAuthRoutes);
app.use('/api', profileRoutes);
app.use('/api/video-rooms', videoRoomRoutes);
app.use('/api/sessions', studySessionRoutes);
app.use('/api/groups', groupStatsRoutes);

// ============ MENTOR AVAILABILITY ENDPOINTS ============

const Mentor = require('./models/Mentor');
const MentorshipRequest = require('./models/MentorshipRequest');
const Notification = require('./models/Notification');

// GET /api/auth/mentors/available - Fetch all available mentors for learners
app.get('/api/auth/mentors/available', authMiddleware, async (req, res) => {
  try {
    console.log('📚 Fetching available mentors...');
    
    // Fetch all mentors from database
    const mentors = await Mentor.find({}, '-password -resetToken -resetTokenExpiry');
    
    console.log(`✅ Found ${mentors.length} mentors in database`);
    
    // Map mentors to frontend format
    const mentorsList = mentors.map(mentor => ({
      id: mentor._id,
      name: mentor.fullname,
      email: mentor.email,
      domain: mentor.domainId,
      specialization: getDomainName(mentor.domainId),
      rating: 4.5, // Default rating (can be enhanced later)
      sessionsCompleted: 0, // Can be calculated from StudySession model
      availability: 'Available',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.fullname}`
    }));
    
    res.json({ 
      success: true,
      mentors: mentorsList,
      count: mentorsList.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching mentors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch mentors',
      message: error.message 
    });
  }
});

// Helper function to get domain name from domain ID
function getDomainName(domainId) {
  const domains = {
    'web-development': 'Web Development',
    'mobile-development': 'Mobile Development',
    'data-science': 'Data Science',
    'machine-learning': 'Machine Learning',
    'cloud-computing': 'Cloud Computing',
    'cybersecurity': 'Cybersecurity',
    'devops': 'DevOps',
    'blockchain': 'Blockchain',
    'game-development': 'Game Development',
    'ui-ux-design': 'UI/UX Design',
    'software-engineering': 'Software Engineering',
    'database': 'Database Management',
    'networking': 'Networking',
    'ai': 'Artificial Intelligence',
    'iot': 'Internet of Things'
  };
  return domains[domainId] || domainId || 'General';
}

// POST /api/auth/mentorship/request - Request mentorship from a mentor
app.post('/api/auth/mentorship/request', authMiddleware, async (req, res) => {
  try {
    console.log('📨 Mentorship request received');
    console.log('User:', req.user);
    console.log('Body:', req.body);
    
    const { mentorId } = req.body;
    const learnerId = req.user._id || req.user.userId;
    
    if (!mentorId) {
      return res.status(400).json({ 
        success: false,
        error: 'Mentor ID is required' 
      });
    }
    
    // Get learner info
    const learner = await User.findById(learnerId);
    if (!learner) {
      return res.status(404).json({ 
        success: false,
        error: 'Learner not found' 
      });
    }
    
    // Get mentor info
    const mentor = await Mentor.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }
    
    // Check if request already exists
    const existingRequest = await MentorshipRequest.findOne({
      mentorId: mentorId,
      learnerId: learnerId,
      status: { $in: ['pending', 'accepted'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({ 
        success: false,
        error: existingRequest.status === 'pending' 
          ? 'You already have a pending request with this mentor'
          : 'You are already connected with this mentor'
      });
    }
    
    // Create mentorship request
    const mentorshipRequest = await MentorshipRequest.create({
      mentorId: mentorId,
      mentorName: mentor.fullname,
      mentorEmail: mentor.email,
      learnerId: learnerId,
      learnerName: learner.fullname,
      learnerEmail: learner.email,
      message: req.body.message || `${learner.fullname} wants to connect with you as a mentee.`,
      status: 'pending'
    });
    
    // Create notification for mentor (if notifications are enabled)
    try {
      await Notification.create({
        userId: mentorId,
        type: 'mentorship_request',
        title: 'New Mentorship Request',
        message: `${learner.fullname} has requested you as their mentor`,
        relatedId: mentorshipRequest._id,
        relatedType: 'mentorship_request'
      });
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    console.log('✅ Mentorship request created successfully');
    
    res.json({ 
      success: true,
      message: `Mentorship request sent to ${mentor.fullname}`,
      request: {
        id: mentorshipRequest._id,
        mentorName: mentor.fullname,
        status: 'pending',
        requestDate: mentorshipRequest.requestDate
      }
    });
    
  } catch (error) {
    console.error('❌ Error requesting mentorship:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send mentorship request',
      message: error.message 
    });
  }
});

// GET /api/auth/mentorship/requests - Get all mentorship requests for current user
app.get('/api/auth/mentorship/requests', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const userType = req.user.userType || 'learner';
    
    let requests;
    
    if (userType === 'mentor') {
      // Get requests sent to this mentor
      requests = await MentorshipRequest.find({ mentorId: userId })
        .sort({ requestDate: -1 });
    } else {
      // Get requests sent by this learner
      requests = await MentorshipRequest.find({ learnerId: userId })
        .sort({ requestDate: -1 });
    }
    
    res.json({ 
      success: true,
      requests: requests,
      count: requests.length
    });
    
  } catch (error) {
    console.error('Error fetching mentorship requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch mentorship requests' 
    });
  }
});

// PUT /api/auth/mentorship/requests/:requestId - Accept/Decline mentorship request
app.put('/api/auth/mentorship/requests/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, message } = req.body; // status: 'accepted' or 'declined'
    
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status' 
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
    if (request.mentorId.toString() !== (req.user._id || req.user.userId).toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized' 
      });
    }
    
    // Update request
    request.status = status;
    request.responseDate = new Date();
    request.responseMessage = message || '';
    await request.save();
    
    // Create notification for learner
    try {
      await Notification.create({
        userId: request.learnerId,
        type: status === 'accepted' ? 'mentorship_accepted' : 'mentorship_declined',
        title: status === 'accepted' ? 'Mentorship Request Accepted' : 'Mentorship Request Declined',
        message: `${request.mentorName} has ${status} your mentorship request`,
        relatedId: requestId,
        relatedType: 'mentorship_request'
      });
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }
    
    res.json({ 
      success: true,
      message: `Request ${status}`,
      request: request
    });
    
  } catch (error) {
    console.error('Error updating mentorship request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update request' 
    });
  }
});

// ============ END MENTOR AVAILABILITY ENDPOINTS ============

// ============ NOTIFICATIONS ENDPOINTS ============

// GET /api/auth/notifications - Get notifications for current user
app.get('/api/auth/notifications', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    
    let query = { userId: userId };
    if (unreadOnly) {
      query.read = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
    
    const unreadCount = await Notification.countDocuments({ 
      userId: userId, 
      read: false 
    });
    
    res.json({ 
      success: true,
      notifications: notifications,
      unreadCount: unreadCount,
      total: notifications.length
    });
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch notifications' 
    });
  }
});

// PUT /api/auth/notifications/:notificationId/read - Mark notification as read
app.put('/api/auth/notifications/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id || req.user.userId;
    
    const notification = await Notification.findOne({
      _id: notificationId,
      userId: userId
    });
    
    if (!notification) {
      return res.status(404).json({ 
        success: false,
        error: 'Notification not found' 
      });
    }
    
    await notification.markAsRead();
    
    res.json({ 
      success: true,
      message: 'Notification marked as read',
      notification: notification
    });
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to mark notification as read' 
    });
  }
});

// ============ END NOTIFICATIONS ENDPOINTS ============

// ============ DOUBTS ENDPOINTS ============

const Doubt = require('./models/Doubt');

// POST /api/auth/doubts/submit - Submit a doubt
app.post('/api/auth/doubts/submit', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const user = await User.findById(userId);
    
    const { mentorId, category, subject, question, priority } = req.body;
    
    if (!category || !subject || !question) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields' 
      });
    }
    
    const doubtData = {
      studentId: userId,
      studentName: user.fullname,
      studentEmail: user.email,
      category: category,
      subject: subject,
      question: question,
      priority: priority || 'medium',
      status: 'open'
    };
    
    if (mentorId) {
      doubtData.mentorId = mentorId;
      doubtData.isPublic = false;
    } else {
      doubtData.isPublic = true;
    }
    
    const doubt = await Doubt.create(doubtData);
    
    // Create notification for mentor if assigned
    if (mentorId) {
      try {
        const mentor = await Mentor.findById(mentorId);
        await Notification.create({
          userId: mentorId,
          userModel: 'Mentor',
          type: 'doubt_answered',
          title: 'New Doubt Assigned',
          message: `${user.fullname} has assigned you a ${priority} priority doubt about ${subject}`,
          relatedId: doubt._id,
          relatedType: 'doubt'
        });
      } catch (notifError) {
        console.log('Could not create notification:', notifError.message);
      }
    }
    
    res.json({ 
      success: true,
      message: 'Doubt submitted successfully',
      doubt: doubt
    });
    
  } catch (error) {
    console.error('Error submitting doubt:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to submit doubt' 
    });
  }
});

// GET /api/auth/doubts - Get doubts for current user
app.get('/api/auth/doubts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const userType = req.user.userType || 'learner';
    
    let doubts;
    
    if (userType === 'mentor') {
      // Get doubts assigned to this mentor
      doubts = await Doubt.find({ mentorId: userId })
        .sort({ createdAt: -1 });
    } else {
      // Get doubts created by this student
      doubts = await Doubt.find({ studentId: userId })
        .sort({ createdAt: -1 });
    }
    
    res.json({ 
      success: true,
      doubts: doubts,
      count: doubts.length
    });
    
  } catch (error) {
    console.error('Error fetching doubts:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch doubts' 
    });
  }
});

// ============ END DOUBTS ENDPOINTS ============

// Specific routes for mentor dashboard pages
app.get('/mentorDash/mentorAdvancedDashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentorDash/mentorAdvancedDashboard.html'));
});

app.get('/mentorDash/mentorMain.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentorDash/mentorMain.html'));
});

app.get('/mentorDash/mentorGroupsDashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentorDash/mentorGroupsDashboard.html'));
});

app.get('/mentorDash/advancedFeaturesDemo.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentorDash/advancedFeaturesDemo.html'));
});

app.get('/mentorDash/videoRoom.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentorDash/videoRoom.html'));
});

app.get('/video-room/:roomCode', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentorDash/videoRoom.html'));
});

// Mentor authentication pages
app.get('/mentor/signin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentor/signin.html'));
});

app.get('/mentor/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentor/signup.html'));
});

app.get('/mentor/forgot.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentor/forgot.html'));
});

// Credentials pages (for regular users)
app.get('/credentials/signin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/credentials/signin.html'));
});

app.get('/credentials/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/credentials/signup.html'));
});

app.get('/mentorDash/mentorAdvancedDashboard-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/mentorDash/mentorAdvancedDashboard-test.html'));
});

app.use(express.static('public'));


app.post('/api/group-upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    console.log('=== FILE UPLOAD REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'No file');
    console.log('User:', req.user ? { 
      id: req.user._id, 
      name: req.user.fullname,
      email: req.user.email 
    } : 'No user');
    
    const group = req.body.group;
    const file = req.file;
    const user = req.user;
    
    if (!file) {
      console.log('❌ Error: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!group) {
      console.log('❌ Error: Group name is required');
      return res.status(400).json({ error: 'Group name is required' });
    }
    
    console.log('✅ Validation passed, creating file record...');
    console.log('File data to save:', {
      group: group,
      filename: file.filename,
      originalname: file.originalname,
      uploadedBy: user._id,
      uploaderName: user.fullname,
      uploaderEmail: user.email,
      fileSize: file.size,
      mimeType: file.mimetype
    });
    
    // Save file info to DB
    const savedFile = await File.create({
      group,
      filename: file.filename,
      originalname: file.originalname,
      uploadedBy: user._id,
      uploaderName: user.fullname,
      uploaderEmail: user.email,
      fileSize: file.size,
      mimeType: file.mimetype
    });
    
    console.log('✅ File saved successfully to database:', {
      id: savedFile._id,
      group: savedFile.group,
      originalname: savedFile.originalname
    });
    
    res.json({ 
      message: 'File uploaded successfully', 
      group, 
      file: file.originalname, 
      fileUrl: `/uploads/${file.filename}`,
      uploadedBy: user.fullname
    });
  } catch (err) {
    console.error('❌ File upload error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'File upload failed: ' + err.message });
  }
});

// Serve uploaded files statically

// Get files by group ID - alternative endpoint for frontend compatibility
app.get('/api/files/:groupId', async (req, res) => {
  try {
    const groupId = decodeURIComponent(req.params.groupId);
    console.log('Fetching files for group ID:', groupId);
    
    // Try to find files by group name (which is stored in the group field)
    const files = await File.find({ group: groupId });
    console.log('Found files:', files.length);
    
    if (files.length === 0) {
      // Try case-insensitive match
      const caseInsensitiveFiles = await File.find({ 
        group: { $regex: `^${groupId}$`, $options: 'i' } 
      });
      return res.json({ files: caseInsensitiveFiles });
    }
    
    res.json({ files });
  } catch (err) {
    console.error('Error fetching files by group ID:', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.get('/api/group-files/:group', async (req, res) => {
  try {
    const groupName = req.params.group;
    console.log('Fetching files for group:', `"${groupName}"`);
    console.log('Group name length:', groupName.length);
    
    // Try exact match first
    const files = await File.find({ group: groupName });
    console.log('Found files with exact match:', files.length);
    
    // If no exact match, try case-insensitive
    if (files.length === 0) {
      const caseInsensitive = await File.find({ group: { $regex: `^${groupName}$`, $options: 'i' } });
      console.log('Found files with case-insensitive match:', caseInsensitive.length);
      
      // Also try finding all files to debug
      const allFiles = await File.find({});
      console.log('Total files in database:', allFiles.length);
      allFiles.forEach(file => {
        console.log(`  - Group: "${file.group}" (length: ${file.group.length}) vs "${groupName}" (length: ${groupName.length})`);
        console.log(`    Match: ${file.group === groupName}`);
      });
      
      res.json({ files: caseInsensitive });
    } else {
      res.json({ files });
    }
  } catch (err) {
    console.error('Error fetching group files:', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

const User = require('./models/User');

// Download file endpoint - properly serves files with correct headers
app.get('/api/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    console.log('Download requested for:', filename);
    
    // Find the file in database to get original name
    const file = await File.findOne({ filename: filename });
    
    if (!file) {
      console.log('File not found in database:', filename);
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = path.join(__dirname, 'uploads', filename);
    
    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      console.log('File not found on disk:', filePath);
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Determine content type based on original filename extension
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Set headers for download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalname)}"`);
    
    // Send the file
    res.sendFile(filePath);
    console.log('File sent successfully:', file.originalname);
    
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// ============ MESSAGE API ENDPOINTS ============

// Get messages for a group with pagination
app.get('/api/messages/:groupName', async (req, res) => {
  try {
    const { groupName } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.getGroupMessages(groupName, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({ 
      success: true, 
      messages,
      page: parseInt(page),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get pinned messages for a group
app.get('/api/messages/:groupName/pinned', async (req, res) => {
  try {
    const { groupName } = req.params;
    const pinnedMessages = await Message.getPinnedMessages(groupName);
    
    res.json({ success: true, messages: pinnedMessages });
  } catch (err) {
    console.error('Error fetching pinned messages:', err);
    res.status(500).json({ error: 'Failed to fetch pinned messages' });
  }
});

// Search messages in a group
app.get('/api/messages/:groupName/search', async (req, res) => {
  try {
    const { groupName } = req.params;
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const messages = await Message.searchMessages(groupName, q);
    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error searching messages:', err);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

// Get message stats for a group (message count per member)
app.get('/api/messages/:groupName/stats', async (req, res) => {
  try {
    const { groupName } = req.params;
    const stats = await Message.getMemberMessageCounts(groupName);
    
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching message stats:', err);
    res.status(500).json({ error: 'Failed to fetch message stats' });
  }
});

// Add reaction to a message
app.post('/api/messages/:messageId/react', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;
    const userName = req.user.fullname || 'User';
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    await message.addReaction(userId, userName, emoji);
    res.json({ success: true, reactions: message.reactions });
  } catch (err) {
    console.error('Error adding reaction:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Reply to a message
app.post('/api/messages/:messageId/reply', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message: replyMessage } = req.body;
    const userId = req.user.userId;
    const userName = req.user.fullname || 'User';
    const userAvatar = req.user.avatar || '';
    
    const parentMessage = await Message.findById(messageId);
    if (!parentMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    await parentMessage.addReply(userId, userName, userAvatar, replyMessage);
    res.json({ success: true, replies: parentMessage.replies });
  } catch (err) {
    console.error('Error adding reply:', err);
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// Edit a message
app.put('/api/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message: newMessage } = req.body;
    const userId = req.user.userId;
    
    const existingMessage = await Message.findById(messageId);
    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Only sender can edit their message
    const messageSenderId = existingMessage.senderId ? existingMessage.senderId.toString() : null;
    if (!messageSenderId || messageSenderId !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this message' });
    }
    
    await existingMessage.editMessage(newMessage);
    res.json({ success: true, message: existingMessage });
  } catch (err) {
    console.error('Error editing message:', err);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete a message (soft delete)
app.delete('/api/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Only sender can delete their message
    const messageSenderId = message.senderId ? message.senderId.toString() : null;
    if (!messageSenderId || messageSenderId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    await message.softDelete(userId);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Pin/unpin a message
app.post('/api/messages/:messageId/pin', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    await message.togglePin(userId);
    res.json({ 
      success: true, 
      isPinned: message.isPinned,
      message: message.isPinned ? 'Message pinned' : 'Message unpinned'
    });
  } catch (err) {
    console.error('Error pinning message:', err);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// Mark messages as read
app.post('/api/messages/:groupName/read', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const { messageIds } = req.body;
    const userId = req.user.userId;
    const userName = req.user.fullname || 'User';
    
    // Mark multiple messages as read
    for (const messageId of messageIds) {
      const message = await Message.findById(messageId);
      if (message) {
        await message.markAsRead(userId, userName);
      }
    }
    
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// ============ END MESSAGE API ENDPOINTS ============

// POST /api/match-groups - Join a group
app.post('/api/match-groups', authMiddleware, async (req, res) => {
  try {
    const { group_name } = req.body;
    const userId = req.user._id;
    
    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create the group
    let group = await Group.findOne({ name: group_name });
    if (!group) {
      group = await Group.create({ 
        name: group_name,
        createdBy: userId,
        description: `Study group for ${group_name}`,
        status: 'active'
      });
    }

    // Add user as member using the enhanced method
    const result = await group.addMember(userId, user.fullname, user.email, group.members.length === 0 ? 'admin' : 'member');
    
    // Also update user's groups array (for backward compatibility)
    if (!user.groups.includes(group_name)) {
      user.groups.push(group_name);
    }

    // Badge logic
    let badges = user.badges || [];
    const groupCount = user.groups.length;

    if (groupCount >= 50 && !badges.includes('conqueror_group')) {
      badges.push('conqueror_group');
    } else if (groupCount >= 30 && !badges.includes('ace_elites')) {
      badges.push('ace_elites');
    } else if (groupCount >= 20 && !badges.includes('master_group')) {
      badges.push('master_group');
    } else if (groupCount >= 10 && !badges.includes('diamond_group')) {
      badges.push('diamond_group');
    } else if (groupCount >= 5 && !badges.includes('gold_group')) {
      badges.push('gold_group');
    } else if (groupCount >= 3 && !badges.includes('silver_group')) {
      badges.push('silver_group');
    } else if (groupCount >= 1 && !badges.includes('bronze_group')) {
      badges.push('bronze_group');
    }

    user.badges = badges;
    await user.save();

    res.json({ 
      message: `Successfully joined ${group_name}`,
      group: {
        name: group.name,
        members: group.members.length,
        status: group.status
      }
    });
  } catch (err) {
    console.error("Error in /api/match-groups POST:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/match-groups - Get user's groups with full details
app.get('/api/match-groups', authMiddleware, async (req, res) => {
  try {
    console.log("🔍 Fetching groups for user:", req.user._id);
    const user = await User.findById(req.user._id);
    if (!user) {
      console.log("❌ User not found:", req.user._id);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log("👤 User found:", user.fullname);
    console.log("📋 User groups:", user.groups);

    // Get full group data from Group model
    const userGroupNames = user.groups || [];
    const groups = await Group.find({ name: { $in: userGroupNames } });

    // Map groups to response format with all details
    const groupsData = groups.map(group => {
      // Find current user in members
      const currentUserMember = group.members.find(m => m.userId?.toString() === req.user._id.toString());
      
      return {
        group_name: group.name,
        description: group.description,
        status: group.status,
        category: group.category,
        members: group.members.map(m => ({
          id: m.userId,
          name: m.name,
          avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          lastActive: m.lastActive,
          messageCount: m.messageCount
        })),
        totalMembers: group.members.length,
        activeMembers: group.members.filter(m => m.status === 'online' || m.status === 'away').length,
        stats: {
          messages: group.stats.totalMessages,
          files: group.stats.totalFiles,
          sessions: group.stats.totalSessions
        },
        recentActivity: group.recentActivity.slice(0, 10).map(a => ({
          user: a.userName,
          action: a.action,
          description: a.description,
          time: a.timestamp
        })),
        progress: group.progress,
        userRole: currentUserMember?.role || 'member',
        isAdmin: currentUserMember?.role === 'admin',
        createdAt: group.createdAt
      };
    });

    // For any group names that don't exist in Group collection yet, create placeholder data
    const missingGroups = userGroupNames.filter(name => !groups.find(g => g.name === name));
    for (const groupName of missingGroups) {
      // Auto-create the group in database
      const newGroup = await Group.create({
        name: groupName,
        description: `Study group for ${groupName}`,
        status: 'active',
        createdBy: req.user._id
      });
      await newGroup.addMember(req.user._id, user.fullname, user.email, 'admin');
      
      groupsData.push({
        group_name: groupName,
        description: `Study group for ${groupName}`,
        status: 'active',
        category: 'General',
        members: [{
          id: req.user._id,
          name: user.fullname,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullname}`,
          role: 'admin',
          status: 'online'
        }],
        totalMembers: 1,
        activeMembers: 1,
        stats: { messages: 0, files: 0, sessions: 0 },
        recentActivity: [],
        progress: { percentage: 0, milestones: [] },
        userRole: 'admin',
        isAdmin: true,
        createdAt: new Date()
      });
    }

    console.log("📡 Sending response with", groupsData.length, "groups");
    res.json({ groups: groupsData });
  } catch (err) {
    console.error("❌ Error fetching user groups:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Debug endpoint to check groups in database
app.get('/api/debug-groups', async (req, res) => {
  try {
    const groups = await Group.find({}, 'name description members stats');
    console.log("Groups in database:", groups);
    res.json({ 
      groups: groups.map(g => ({ 
        group_name: g.name, 
        description: g.description,
        members: g.members?.length || 0,
        stats: g.stats
      })) 
    });
  } catch (err) {
    console.error("Error fetching debug groups:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/groups/:groupName - Get single group with full details
app.get('/api/groups/:groupName', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const group = await Group.findOne({ name: groupName });
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const currentUserMember = group.members.find(m => m.userId?.toString() === req.user._id.toString());

    res.json({
      name: group.name,
      description: group.description,
      status: group.status,
      category: group.category,
      members: group.members.map(m => ({
        id: m.userId,
        name: m.name,
        email: m.email,
        avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        lastActive: m.lastActive,
        lastSeen: m.lastSeen,
        messageCount: m.messageCount
      })),
      totalMembers: group.members.length,
      activeMembers: group.members.filter(m => m.status === 'online' || m.status === 'away').length,
      stats: group.stats,
      recentActivity: group.recentActivity,
      progress: group.progress,
      settings: group.settings,
      userRole: currentUserMember?.role || null,
      isMember: !!currentUserMember,
      isAdmin: currentUserMember?.role === 'admin',
      createdAt: group.createdAt
    });
  } catch (err) {
    console.error("Error fetching group:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/groups/:groupName/join - Join a group
app.post('/api/groups/:groupName/join', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const user = await User.findById(req.user._id);
    let group = await Group.findOne({ name: groupName });
    
    if (!group) {
      // Create group if it doesn't exist
      group = await Group.create({
        name: groupName,
        description: `Study group for ${groupName}`,
        createdBy: req.user._id
      });
    }

    const result = await group.addMember(req.user._id, user.fullname, user.email);
    
    if (result.success && !user.groups.includes(groupName)) {
      user.groups.push(groupName);
      await user.save();
    }

    res.json(result);
  } catch (err) {
    console.error("Error joining group:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/groups/:groupName/leave - Leave a group
app.post('/api/groups/:groupName/leave', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const user = await User.findById(req.user._id);
    const group = await Group.findOne({ name: groupName });
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const result = await group.removeMember(req.user._id);
    
    // Remove from user's groups array
    if (result.success) {
      user.groups = user.groups.filter(g => g !== groupName);
      await user.save();
    }

    res.json(result);
  } catch (err) {
    console.error("Error leaving group:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/groups/:groupName/status - Update member's online status
app.put('/api/groups/:groupName/status', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const { status } = req.body; // 'online', 'offline', 'away'
    
    const group = await Group.findOne({ name: groupName });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const updated = await group.updateMemberStatus(req.user._id, status);
    res.json({ success: updated });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/groups/:groupName/activity - Record an activity
app.post('/api/groups/:groupName/activity', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const { action, description } = req.body;
    const user = await User.findById(req.user._id);
    
    const group = await Group.findOne({ name: groupName });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await group.recordActivity(req.user._id, user.fullname, action, description);
    res.json({ success: true });
  } catch (err) {
    console.error("Error recording activity:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/groups/:groupName/members - Get group members
app.get('/api/groups/:groupName/members', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const group = await Group.findOne({ name: groupName });
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({
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
  } catch (err) {
    console.error("Error fetching members:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/groups/:groupName/activity - Get group activity feed
app.get('/api/groups/:groupName/activity', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    const group = await Group.findOne({ name: groupName });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({
      activity: group.recentActivity.slice(0, limit).map(a => ({
        userId: a.userId,
        user: a.userName,
        action: a.action,
        description: a.description,
        time: a.timestamp
      }))
    });
  } catch (err) {
    console.error("Error fetching activity:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// app.get('/api/match-groups', async (req, res) => {
//   try {
//     const groups = await Group.find({}, 'name');
//     // Map to { group_name: ... } for frontend compatibility
//     res.json({ groups: groups.map(g => ({ group_name: g.name })) });
//   } catch (err) {
//     console.error("Error fetching groups:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// app.post('/api/match-groups', async (req, res) => {
//   try {
//     const { group_name } = req.body;
//     console.log("Matched group received:", group_name);

//     // You can save it to DB or session if needed
//     res.json({ message: `Group ${group_name} received successfully.` });
//   } catch (err) {
//     console.error("Error in /api/match-groups:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

app.use("/api/save-current-group",groupRoutes);

// ============== Code Editor API Endpoints ==============

// Store code snippets in memory (could be extended to MongoDB)
const codeSnippets = new Map();

// Verify group membership
app.get('/api/code-editor/verify-membership/:groupName', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated', isMember: false });
    }
    
    // Find the group
    const group = await Group.findOne({ name: groupName });
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found', isMember: false });
    }
    
    // Check if user is a member
    const isMember = group.members.some(m => m.userId.toString() === userId.toString());
    
    // Get active code session info
    const hasActiveSession = codeEditorSessions.has(groupName);
    let activeCollaborators = 0;
    
    if (hasActiveSession) {
      const session = codeEditorSessions.get(groupName);
      activeCollaborators = session.collaborators.size;
    }
    
    res.json({
      success: true,
      isMember: isMember,
      groupName: group.name,
      hasActiveSession: hasActiveSession,
      activeCollaborators: activeCollaborators,
      memberCount: group.members.length
    });
  } catch (err) {
    console.error('Error verifying membership:', err);
    res.status(500).json({ error: 'Failed to verify membership', isMember: false });
  }
});

// Get active session info
app.get('/api/code-editor/session-info/:groupName', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    
    const hasActiveSession = codeEditorSessions.has(groupName);
    
    if (hasActiveSession) {
      const session = codeEditorSessions.get(groupName);
      const collaborators = Array.from(session.collaborators.values()).map(c => ({
        id: c.id,
        name: c.name,
        joinedAt: c.joinedAt
      }));
      
      res.json({
        success: true,
        hasActiveSession: true,
        collaboratorCount: collaborators.length,
        collaborators: collaborators,
        language: session.language
      });
    } else {
      res.json({
        success: true,
        hasActiveSession: false,
        collaboratorCount: 0,
        collaborators: []
      });
    }
  } catch (err) {
    console.error('Error getting session info:', err);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

// Save code for a group
app.post('/api/code-editor/save', authMiddleware, async (req, res) => {
  try {
    const { groupName, files } = req.body;
    
    if (!groupName || !files) {
      return res.status(400).json({ error: 'Group name and files are required' });
    }
    
    // Store code
    codeSnippets.set(groupName, {
      files: files,
      lastModified: new Date(),
      modifiedBy: req.user?.id || 'unknown'
    });
    
    res.json({ success: true, message: 'Code saved successfully' });
  } catch (err) {
    console.error('Error saving code:', err);
    res.status(500).json({ error: 'Failed to save code' });
  }
});

// Load code for a group
app.get('/api/code-editor/load/:groupName', authMiddleware, async (req, res) => {
  try {
    const { groupName } = req.params;
    
    const savedCode = codeSnippets.get(groupName);
    
    if (savedCode) {
      res.json({
        success: true,
        files: savedCode.files,
        lastModified: savedCode.lastModified,
        modifiedBy: savedCode.modifiedBy
      });
    } else {
      // Return default files
      res.json({
        success: true,
        files: {
          'main.js': {
            content: '// Welcome to the collaborative code editor!\nconsole.log("Hello, World!");',
            language: 'javascript'
          }
        },
        isDefault: true
      });
    }
  } catch (err) {
    console.error('Error loading code:', err);
    res.status(500).json({ error: 'Failed to load code' });
  }
});

// Execute code (supports Python, Node.js)
app.post('/api/code-editor/execute', authMiddleware, async (req, res) => {
  try {
    const { code, language, input } = req.body;
    
    if (language === 'javascript') {
      // JavaScript can be run on client side
      return res.json({ 
        message: 'JavaScript should be executed in the browser for security reasons' 
      });
    }
    
    if (language === 'python') {
      // Execute Python code
      const { spawn } = require('child_process');
      const pythonProcess = spawn('python', ['-c', code], {
        timeout: 10000 // 10 second timeout
      });
      
      // Send input to stdin if provided
      if (input) {
        pythonProcess.stdin.write(input);
        pythonProcess.stdin.end();
      } else {
        pythonProcess.stdin.end();
      }
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (exitCode) => {
        if (errorOutput) {
          return res.json({
            output: errorOutput,
            error: true,
            language: language,
            exitCode: exitCode
          });
        }
        res.json({
          output: output || 'Code executed successfully. No output.',
          error: false,
          language: language,
          exitCode: exitCode
        });
      });
      
      pythonProcess.on('error', (err) => {
        res.json({
          output: `Error: Python not found. Please install Python on your system.\n${err.message}`,
          error: true,
          language: language
        });
      });
      
      return; // Don't send response here, wait for process to complete
    }
    
    // For other languages
    res.json({
      output: `Code execution for ${language} is not available yet.\nSupported: JavaScript (browser), Python (server)`,
      error: false,
      language: language
    });
  } catch (err) {
    console.error('Error executing code:', err);
    res.status(500).json({ error: 'Failed to execute code', output: err.message });
  }
});

// ============== End Code Editor API ==============

const PORT = process.env.PORT || 5000; // Changed from 7000 to 5000 
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Configure PeerJS Server to use the existing HTTP server
const peerServer = PeerServer({
  server: server, // Use the existing HTTP server
  path: '/peerjs',
  corsOptions: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

console.log(`PeerJS server running on port ${PORT} at path /peerjs`);

// after redirect into this,not awaiting live fetched

const wss = new WebSocket.Server({ server });
const VideoRoom = require('./models/VideoRoom');
const jwt = require('jsonwebtoken');

let clients = [];
let videoRoomClients = new Map(); // Map to store room-specific connections

wss.on('connection', ws => {
  console.log('New WebSocket connection');
  clients.push(ws);
  
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async msg => {
    try {
      const data = JSON.parse(msg);
      
      // Handle different message types
      switch (data.type) {
        case 'join':
          // Original chat functionality
          const history = await Message.find({ group: data.group }).sort({ timestamp: 1 });
          ws.send(JSON.stringify({ type: 'history', messages: history }));
          break;
          
        case 'authenticate_video_room':
          await handleVideoRoomAuthentication(ws, data);
          break;
          
        case 'join_video_room':
          await handleJoinVideoRoom(ws, data);
          break;
          
        case 'leave_video_room':
          await handleLeaveVideoRoom(ws, data);
          break;
          
        case 'webrtc_signal':
          await handleWebRTCSignal(ws, data);
          break;
          
        case 'video_room_chat':
          await handleVideoRoomChat(ws, data);
          break;
          
        case 'participant_update':
          await handleParticipantUpdate(ws, data);
          break;
          
        case 'screen_share':
          await handleScreenShare(ws, data);
          break;
          
        case 'recording_update':
          await handleRecordingUpdate(ws, data);
          break;
          
        case 'raise_hand':
          await handleRaiseHand(ws, data);
          break;
          
        // Code Editor Collaboration
        case 'join_code_session':
          await handleJoinCodeSession(ws, data);
          break;
          
        case 'leave_code_session':
          await handleLeaveCodeSession(ws, data);
          break;
          
        case 'code_update':
          await handleCodeUpdate(ws, data);
          break;
          
        case 'cursor_update':
          await handleCursorUpdate(ws, data);
          break;
          
        case 'code_language_change':
          await handleLanguageChange(ws, data);
          break;
          
        case 'code_run_result':
          await handleCodeRunResult(ws, data);
          break;
          
        default:
          // Enhanced message handling with member info
          if (data.group && (data.message || data.messageType === 'poll' || data.messageType === 'poll_vote')) {
            // Get sender info from the data or token
            const senderId = data.senderId || ws.userId || null;
            const senderName = data.senderName || data.sender || 'Anonymous';
            const senderEmail = data.senderEmail || '';
            const senderAvatar = data.senderAvatar || '';
            const senderRole = data.senderRole || 'member';
            const messageType = data.messageType || 'text';
            
            // Skip system messages from being saved (like "user joined the chat")
            if (messageType === 'system') {
              // Just broadcast system messages, don't save
              clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'message',
                    group: data.group,
                    messageType: 'system',
                    message: data.message,
                    timestamp: new Date()
                  }));
                }
              });
              break;
            }
            
            // Handle poll messages
            if (messageType === 'poll') {
              const pollData = data.poll;
              
              // Save poll message to database
              const messageData = {
                group: data.group,
                senderName: senderName,
                senderEmail: senderEmail,
                senderAvatar: senderAvatar,
                senderRole: senderRole,
                message: `📊 Poll: ${pollData.question}`,
                messageType: 'poll',
                poll: pollData,
                status: 'sent'
              };
              
              if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
                messageData.senderId = senderId;
              }
              
              const saved = await Message.create(messageData);
              
              // Broadcast poll to all clients
              clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'message',
                    group: data.group,
                    messageId: saved._id,
                    senderId: senderId,
                    senderName: senderName,
                    messageType: 'poll',
                    poll: pollData,
                    timestamp: saved.timestamp
                  }));
                }
              });
              break;
            }
            
            // Handle poll vote updates
            if (messageType === 'poll_vote') {
              const pollData = data.poll;
              const pollId = data.pollId;
              
              // Update poll in database
              try {
                await Message.findOneAndUpdate(
                  { 'poll.id': pollId },
                  { 
                    poll: pollData,
                    updatedAt: new Date()
                  }
                );
              } catch (updateErr) {
                console.log('Could not update poll:', updateErr.message);
              }
              
              // Broadcast vote update to all clients
              clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'message',
                    group: data.group,
                    senderId: senderId,
                    senderName: senderName,
                    messageType: 'poll_vote',
                    pollId: pollId,
                    poll: pollData,
                    timestamp: new Date()
                  }));
                }
              });
              break;
            }
            
            // Build message object for regular messages
            const messageData = {
              group: data.group,
              groupId: data.groupId,
              senderName: senderName,
              senderEmail: senderEmail,
              senderAvatar: senderAvatar,
              senderRole: senderRole,
              message: data.message,
              messageType: messageType,
              attachment: data.attachment || null,
              status: 'sent'
            };
            
            // Only add senderId if it's a valid ObjectId
            if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
              messageData.senderId = senderId;
            }
            
            // Create enhanced message
            const saved = await Message.create(messageData);
            
            // Update group stats and activity if group exists
            try {
              const group = await Group.findOne({ name: data.group });
              if (group && senderId) {
                await group.recordActivity(
                  senderId, 
                  senderName, 
                  'message', 
                  `${senderName} sent a message`
                );
              }
            } catch (groupErr) {
              console.log('Could not update group activity:', groupErr.message);
            }
            
            // Broadcast to all clients
            clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'message',
                  group: data.group,
                  messageId: saved._id,
                  senderId: senderId,
                  senderName: senderName,
                  senderAvatar: senderAvatar,
                  senderRole: senderRole,
                  message: data.message,
                  messageType: messageType,
                  attachment: data.attachment,
                  timestamp: saved.timestamp,
                  formattedTime: saved.formattedTime
                }));
              }
            });
          }
      }
    } catch (err) {
      console.error("WebSocket error:", err);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
    
    // Clean up code session if in one
    if (ws.codeSession) {
      handleLeaveCodeSession(ws, { groupName: ws.codeSession });
    }
    
    // Remove from video room clients
    for (let [roomCode, roomClients] of videoRoomClients.entries()) {
      const updatedClients = roomClients.filter(client => client.ws !== ws);
      if (updatedClients.length === 0) {
        videoRoomClients.delete(roomCode);
      } else {
        videoRoomClients.set(roomCode, updatedClients);
        // Notify other participants that someone left
        broadcastToRoom(roomCode, {
          type: 'participant_left',
          participantId: ws.userId,
          timestamp: new Date()
        }, ws);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Video Room WebSocket Handlers
async function handleVideoRoomAuthentication(ws, data) {
  try {
    const { token, roomCode } = data;
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    ws.userId = decoded.userId;
    ws.userType = decoded.userType;
    ws.role = decoded.role;
    ws.roomCode = roomCode;
    
    ws.send(JSON.stringify({
      type: 'authentication_success',
      userId: decoded.userId,
      role: decoded.role
    }));
    
  } catch (error) {
    console.error('Authentication error:', error);
    ws.send(JSON.stringify({
      type: 'authentication_error',
      message: 'Invalid token'
    }));
  }
}

async function handleJoinVideoRoom(ws, data) {
  try {
    const { roomCode } = data;
    
    if (!ws.userId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Authentication required'
      }));
      return;
    }
    
    // Add to room clients
    if (!videoRoomClients.has(roomCode)) {
      videoRoomClients.set(roomCode, []);
    }
    
    const roomClients = videoRoomClients.get(roomCode);
    
    // Check if already in room
    const existingClient = roomClients.find(client => client.userId === ws.userId);
    if (!existingClient) {
      roomClients.push({
        ws: ws,
        userId: ws.userId,
        userType: ws.userType,
        role: ws.role,
        peerId: data.peerId,
        connectionInfo: {
          isVideoOn: true,
          isAudioOn: true,
          isScreenSharing: false,
          isHandRaised: false
        }
      });
      
      videoRoomClients.set(roomCode, roomClients);
    }
    
    // Get room info
    const room = await VideoRoom.findOne({ roomCode });
    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found'
      }));
      return;
    }
    
    // Send current participants to new joiner
    const participants = roomClients.map(client => ({
      userId: client.userId,
      peerId: client.peerId,
      role: client.role,
      connectionInfo: client.connectionInfo
    }));
    
    ws.send(JSON.stringify({
      type: 'room_joined',
      roomCode: roomCode,
      participants: participants,
      roomSettings: room.settings
    }));
    
    // Notify other participants
    broadcastToRoom(roomCode, {
      type: 'participant_joined',
      participant: {
        userId: ws.userId,
        peerId: data.peerId,
        role: ws.role,
        connectionInfo: {
          isVideoOn: true,
          isAudioOn: true,
          isScreenSharing: false,
          isHandRaised: false
        }
      }
    }, ws);
    
  } catch (error) {
    console.error('Error joining video room:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to join room'
    }));
  }
}

async function handleLeaveVideoRoom(ws, data) {
  try {
    const { roomCode } = data;
    
    const roomClients = videoRoomClients.get(roomCode);
    if (roomClients) {
      const updatedClients = roomClients.filter(client => client.userId !== ws.userId);
      
      if (updatedClients.length === 0) {
        videoRoomClients.delete(roomCode);
      } else {
        videoRoomClients.set(roomCode, updatedClients);
      }
      
      // Notify other participants
      broadcastToRoom(roomCode, {
        type: 'participant_left',
        participantId: ws.userId
      }, ws);
    }
    
    ws.send(JSON.stringify({
      type: 'room_left',
      roomCode: roomCode
    }));
    
  } catch (error) {
    console.error('Error leaving video room:', error);
  }
}

async function handleWebRTCSignal(ws, data) {
  try {
    const { roomCode, targetUserId, signal, signalType } = data;
    
    const roomClients = videoRoomClients.get(roomCode);
    if (!roomClients) return;
    
    const targetClient = roomClients.find(client => client.userId === targetUserId);
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
      targetClient.ws.send(JSON.stringify({
        type: 'webrtc_signal',
        fromUserId: ws.userId,
        signal: signal,
        signalType: signalType
      }));
    }
    
  } catch (error) {
    console.error('Error handling WebRTC signal:', error);
  }
}

async function handleVideoRoomChat(ws, data) {
  try {
    const { roomCode, message, isPrivate, targetUserId } = data;
    
    // Save message to database
    const room = await VideoRoom.findOne({ roomCode });
    if (room) {
      const participant = room.participants.find(p => 
        p.userId.toString() === ws.userId.toString()
      );
      
      if (participant) {
        await room.addChatMessage({
          senderId: ws.userId,
          senderName: participant.name,
          senderType: participant.role,
          message: message,
          isPrivate: isPrivate,
          recipientId: targetUserId
        });
      }
    }
    
    // Broadcast message
    if (isPrivate && targetUserId) {
      // Send private message to target user only
      const roomClients = videoRoomClients.get(roomCode);
      if (roomClients) {
        const targetClient = roomClients.find(client => client.userId === targetUserId);
        if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
          targetClient.ws.send(JSON.stringify({
            type: 'chat_message',
            message: message,
            senderId: ws.userId,
            senderName: participant?.name,
            isPrivate: true,
            timestamp: new Date()
          }));
        }
      }
    } else {
      // Broadcast to all room participants
      broadcastToRoom(roomCode, {
        type: 'chat_message',
        message: message,
        senderId: ws.userId,
        senderName: participant?.name,
        isPrivate: false,
        timestamp: new Date()
      });
    }
    
  } catch (error) {
    console.error('Error handling video room chat:', error);
  }
}

async function handleParticipantUpdate(ws, data) {
  try {
    const { roomCode, connectionInfo } = data;
    
    // Update participant connection info in room clients
    const roomClients = videoRoomClients.get(roomCode);
    if (roomClients) {
      const clientIndex = roomClients.findIndex(client => client.userId === ws.userId);
      if (clientIndex !== -1) {
        roomClients[clientIndex].connectionInfo = {
          ...roomClients[clientIndex].connectionInfo,
          ...connectionInfo
        };
        
        videoRoomClients.set(roomCode, roomClients);
        
        // Update database
        const room = await VideoRoom.findOne({ roomCode });
        if (room) {
          await room.updateParticipantConnection(ws.userId, connectionInfo);
        }
        
        // Notify other participants
        broadcastToRoom(roomCode, {
          type: 'participant_updated',
          participantId: ws.userId,
          connectionInfo: roomClients[clientIndex].connectionInfo
        }, ws);
      }
    }
    
  } catch (error) {
    console.error('Error handling participant update:', error);
  }
}

async function handleScreenShare(ws, data) {
  try {
    const { roomCode, isSharing } = data;
    
    // Update screen share status
    await handleParticipantUpdate(ws, {
      roomCode,
      connectionInfo: { isScreenSharing: isSharing }
    });
    
    broadcastToRoom(roomCode, {
      type: 'screen_share_update',
      participantId: ws.userId,
      isSharing: isSharing
    }, ws);
    
  } catch (error) {
    console.error('Error handling screen share:', error);
  }
}

async function handleRecordingUpdate(ws, data) {
  try {
    const { roomCode, isRecording } = data;
    
    // Only host can control recording
    if (ws.role !== 'host') {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Only host can control recording'
      }));
      return;
    }
    
    // Update database
    const room = await VideoRoom.findOne({ roomCode });
    if (room) {
      room.isRecording = isRecording;
      await room.save();
      
      // Notify all participants
      broadcastToRoom(roomCode, {
        type: 'recording_update',
        isRecording: isRecording
      });
    }
    
  } catch (error) {
    console.error('Error handling recording update:', error);
  }
}

async function handleRaiseHand(ws, data) {
  try {
    const { roomCode, isHandRaised } = data;
    
    await handleParticipantUpdate(ws, {
      roomCode,
      connectionInfo: { isHandRaised }
    });
    
    broadcastToRoom(roomCode, {
      type: 'hand_raised',
      participantId: ws.userId,
      isHandRaised: isHandRaised
    }, ws);
    
  } catch (error) {
    console.error('Error handling raise hand:', error);
  }
}

// ============== Code Editor Collaboration Handlers ==============

// Store for code editor sessions (groupName -> { code, language, collaborators })
const codeEditorSessions = new Map();

async function handleJoinCodeSession(ws, data) {
  try {
    const { groupName, userId, userName, userAvatar } = data;
    
    if (!groupName) {
      ws.send(JSON.stringify({ type: 'error', message: 'Group name is required' }));
      return;
    }
    
    if (!userId) {
      ws.send(JSON.stringify({ type: 'error', message: 'User authentication required' }));
      return;
    }
    
    // Verify group membership
    const group = await Group.findOne({ name: groupName });
    
    if (!group) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        errorType: 'GROUP_NOT_FOUND',
        message: 'Group not found' 
      }));
      return;
    }
    
    // Check if user is a member of the group
    const isMember = group.members.some(m => m.userId.toString() === userId.toString());
    
    if (!isMember) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        errorType: 'NOT_A_MEMBER',
        message: 'You are not a member of this group. Please join the group first.' 
      }));
      return;
    }
    
    // Initialize session if doesn't exist (first member creates the session)
    const isNewSession = !codeEditorSessions.has(groupName);
    
    if (isNewSession) {
      console.log(`[Code Editor] Creating new session for group: ${groupName} by user: ${userName}`);
      codeEditorSessions.set(groupName, {
        code: '// Start coding here...\nconsole.log("Hello, World!");',
        language: 'javascript',
        collaborators: new Map(),
        history: [],
        createdBy: userId,
        createdAt: new Date()
      });
    } else {
      console.log(`[Code Editor] User ${userName} joining existing session for group: ${groupName}`);
    }
    
    const session = codeEditorSessions.get(groupName);
    
    // Check if user is already in the session (prevent duplicate connections)
    for (const [existingWs, collaborator] of session.collaborators.entries()) {
      if (collaborator.id === userId && existingWs !== ws) {
        // Remove old connection
        session.collaborators.delete(existingWs);
        console.log(`[Code Editor] Removed duplicate connection for user: ${userName}`);
      }
    }
    
    // Add collaborator
    session.collaborators.set(ws, {
      id: userId,
      name: userName || 'Anonymous',
      avatar: userAvatar || '',
      joinedAt: new Date(),
      cursor: { line: 0, column: 0 }
    });
    
    // Store session info on websocket
    ws.codeSession = groupName;
    ws.codeUserId = userId;
    ws.codeUserName = userName;
    
    // Prepare collaborators list for response
    const collaboratorsList = Array.from(session.collaborators.values()).map(c => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      joinedAt: c.joinedAt
    }));
    
    // Send current state to joining user
    ws.send(JSON.stringify({
      type: 'code_session_joined',
      groupName: groupName,
      code: session.code,
      language: session.language,
      collaborators: collaboratorsList,
      isNewSession: isNewSession,
      sessionCreatedBy: session.createdBy
    }));
    
    // Notify other collaborators
    broadcastToCodeSession(groupName, {
      type: 'collaborator_joined',
      collaborator: {
        id: userId,
        name: userName,
        avatar: userAvatar
      }
    }, ws);
    
    console.log(`${userName} joined code session for group: ${groupName}`);
    
  } catch (error) {
    console.error('Error joining code session:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to join code session' }));
  }
}

async function handleLeaveCodeSession(ws, data) {
  try {
    const groupName = data.groupName || ws.codeSession;
    
    if (!groupName || !codeEditorSessions.has(groupName)) {
      return;
    }
    
    const session = codeEditorSessions.get(groupName);
    const collaborator = session.collaborators.get(ws);
    
    if (collaborator) {
      session.collaborators.delete(ws);
      
      // Notify others
      broadcastToCodeSession(groupName, {
        type: 'collaborator_left',
        collaboratorId: collaborator.id,
        collaboratorName: collaborator.name
      }, ws);
      
      console.log(`${collaborator.name} left code session for group: ${groupName}`);
    }
    
    // Clean up empty sessions
    if (session.collaborators.size === 0) {
      // Keep the session for a while in case someone rejoins
      setTimeout(() => {
        const currentSession = codeEditorSessions.get(groupName);
        if (currentSession && currentSession.collaborators.size === 0) {
          codeEditorSessions.delete(groupName);
          console.log(`Code session cleaned up for group: ${groupName}`);
        }
      }, 300000); // 5 minutes
    }
    
    // Clear session from websocket
    delete ws.codeSession;
    delete ws.codeUserId;
    delete ws.codeUserName;
    
  } catch (error) {
    console.error('Error leaving code session:', error);
  }
}

async function handleCodeUpdate(ws, data) {
  try {
    const { groupName, code, cursorPosition, changeRange } = data;
    
    if (!groupName || !codeEditorSessions.has(groupName)) {
      return;
    }
    
    const session = codeEditorSessions.get(groupName);
    
    // Update code in session
    session.code = code;
    
    // Track history (for undo/redo if needed)
    session.history.push({
      code: code,
      userId: ws.codeUserId,
      timestamp: new Date()
    });
    
    // Keep history limited
    if (session.history.length > 100) {
      session.history.shift();
    }
    
    // Broadcast to other collaborators
    broadcastToCodeSession(groupName, {
      type: 'code_updated',
      code: code,
      userId: ws.codeUserId,
      userName: ws.codeUserName,
      cursorPosition: cursorPosition,
      changeRange: changeRange
    }, ws);
    
  } catch (error) {
    console.error('Error handling code update:', error);
  }
}

async function handleCursorUpdate(ws, data) {
  try {
    const { groupName, cursorPosition, selection } = data;
    
    if (!groupName || !codeEditorSessions.has(groupName)) {
      return;
    }
    
    const session = codeEditorSessions.get(groupName);
    const collaborator = session.collaborators.get(ws);
    
    if (collaborator) {
      collaborator.cursor = cursorPosition;
      collaborator.selection = selection;
      
      // Broadcast cursor position to others
      broadcastToCodeSession(groupName, {
        type: 'cursor_updated',
        userId: ws.codeUserId,
        userName: ws.codeUserName,
        cursorPosition: cursorPosition,
        selection: selection
      }, ws);
    }
    
  } catch (error) {
    console.error('Error handling cursor update:', error);
  }
}

async function handleLanguageChange(ws, data) {
  try {
    const { groupName, language } = data;
    
    if (!groupName || !codeEditorSessions.has(groupName)) {
      return;
    }
    
    const session = codeEditorSessions.get(groupName);
    session.language = language;
    
    // Update code template for new language
    const templates = {
      javascript: '// JavaScript\nconsole.log("Hello, World!");',
      python: '# Python\nprint("Hello, World!")',
      java: '// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
      cpp: '// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
      html: '<!DOCTYPE html>\n<html>\n<head>\n    <title>Page</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
      css: '/* CSS */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}',
      php: '<?php\n// PHP\necho "Hello, World!";\n?>',
      ruby: '# Ruby\nputs "Hello, World!"',
      go: '// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}'
    };
    
    // Broadcast language change to all
    broadcastToCodeSession(groupName, {
      type: 'language_changed',
      language: language,
      changedBy: ws.codeUserName,
      template: templates[language] || '// Start coding...'
    });
    
  } catch (error) {
    console.error('Error handling language change:', error);
  }
}

async function handleCodeRunResult(ws, data) {
  try {
    const { groupName, output, error, executedBy } = data;
    
    if (!groupName || !codeEditorSessions.has(groupName)) {
      return;
    }
    
    // Broadcast run result to all collaborators
    broadcastToCodeSession(groupName, {
      type: 'code_run_result',
      output: output,
      error: error,
      executedBy: executedBy || ws.codeUserName,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Error handling code run result:', error);
  }
}

// Helper function to broadcast to all collaborators in a code session
function broadcastToCodeSession(groupName, message, excludeWs = null) {
  const session = codeEditorSessions.get(groupName);
  if (!session) return;
  
  session.collaborators.forEach((collaborator, clientWs) => {
    if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(message));
    }
  });
}

// ============== End Code Editor Collaboration ==============

// Helper function to broadcast message to all clients in a room
function broadcastToRoom(roomCode, message, excludeWs = null) {
  const roomClients = videoRoomClients.get(roomCode);
  if (!roomClients) return;
  
  roomClients.forEach(client => {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

// Heartbeat to keep connections alive
setInterval(() => {
  clients.forEach(ws => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);