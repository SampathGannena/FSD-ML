const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profile');
const mentorAuthRoutes = require('./routes/mentorAuth');
const groupRoutes = require('./routes/groupRoutes');
const cors = require('cors');
const path = require('path');
const Group = require('./models/Group');
const WebSocket = require('ws');
const Message = require('./models/Message');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // This saves files to the 'uploads' folder

dotenv.config();
const app = express();

// Serve static files from the Frontend folder
app.use(express.static(path.join(__dirname, '../Frontend/landing')));

// Route for landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/landing/land.html'));
});
app.use(bodyParser.json());

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log(err));

app.use('/api/auth', authRoutes);
app.use('/api/mentor', mentorAuthRoutes);

app.use('/api', profileRoutes);

app.use(express.static('public'));

const File = require('./models/File'); // Add this at the top

app.post('/api/group-upload', upload.single('file'), async (req, res) => {
  try {
    const group = req.body.group;
    const file = req.file;
    // Save file info to DB
    const savedFile = await File.create({
      group,
      filename: file.filename,
      originalname: file.originalname
    });
    res.json({ message: 'File uploaded', group, file: file.originalname, fileUrl: `/uploads/${file.filename}` });
  } catch (err) {
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Serve uploaded files statically

app.get('/api/group-files/:group', async (req, res) => {
  try {
    const files = await File.find({ group: req.params.group });
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

const authMiddleware = require('./middleware/authMiddleware');
const User = require('./models/User');

app.post('/api/match-groups', authMiddleware, async (req, res) => {
  try {
    const { group_name } = req.body;
    await Group.create({ name: group_name });

    // Use req.user._id from the middleware
    const user = await User.findByIdAndUpdate(req.user._id);
    if (!user.groups.includes(group_name)) {
      user.groups.push(group_name);
    }

    let badges = user.badges || [];
    const groupCount = user.groups.length ;

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

    // Save badges if updated
    // if (badges.length !== user.badges.length) {
    //   user.badges = badges;
    //   await user.save();
    // }

    res.json({ message: `Group ${group_name} received successfully.` });
  } catch (err) {
    console.error("Error in /api/user-groups:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/match-groups', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // If you want to return group names as objects for frontend compatibility:
    res.json({ groups: (user.groups || []).map(g => ({ group_name: g })) });
  } catch (err) {
    console.error("Error fetching user groups:", err);
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

const PORT = process.env.PORT || 7000; 
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// after redirect into this,not awaiting live fetched

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', ws => {
  clients.push(ws);

  ws.on('message', async msg => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'join') {
        // Send chat history for the group
        const history = await Message.find({ group: data.group }).sort({ timestamp: 1 });
        ws.send(JSON.stringify({ type: 'history', messages: history }));
      } else if (data.group && data.message) {
        // Save message to DB
        const saved = await Message.create({
          group: data.group,
          sender: data.sender,
          message: data.message
        });
        // Broadcast to all clients
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              group: data.group,
              sender: data.sender,
              message: data.message,
              timestamp: saved.timestamp
            }));
          }
        });
      }
    } catch (err) {
      console.error("WebSocket error:", err);
    }
  });

  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
  });
});