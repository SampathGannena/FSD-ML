const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const mentorAuthRoutes = require('./routes/mentorAuth');
const groupRoutes = require('./routes/groupRoutes');
const cors = require('cors');
const path = require('path');
const Group = require('./models/Group');
const http = require('http'); // Needed for WebSocket to attach
const WebSocket = require('ws');

dotenv.config();
const app = express();
const server = http.createServer(app); // 👈 Create server to attach both Express & WS
const wss = new WebSocket.Server({ server }); // 👈 Attach WebSocket to HTTP server

// ==== WebSocket Group Chat Setup ====
const groupClients = {}; // { groupName: Set<WebSocket> }

wss.on('connection', (ws) => {
  let currentGroup = null;
  console.log('🔌 WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Join group
      if (data.type === 'join' && data.group) {
        currentGroup = data.group;
        leaveGroup(ws);

        if (!groupClients[currentGroup]) {
          groupClients[currentGroup] = new Set();
        }
        groupClients[currentGroup].add(ws);

        ws.send(JSON.stringify({
          type: 'system',
          message: `✅ Joined group: ${currentGroup}`,
        }));

        console.log(`👥 WebSocket: Joined group ${currentGroup}`);
      }

      // Broadcast within group
      else if (data.group && data.message) {
        const msg = {
          type: 'chat',
          group: data.group,
          sender: data.sender || 'user',
          message: data.message,
        };

        if (groupClients[data.group]) {
          groupClients[data.group].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(msg));
            }
          });
        }
      }
    } catch (err) {
      console.error('❌ WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    leaveGroup(ws);
    console.log('🔌 WebSocket client disconnected');
  });

  function leaveGroup(socket) {
    if (currentGroup && groupClients[currentGroup]) {
      groupClients[currentGroup].delete(socket);
      if (groupClients[currentGroup].size === 0) {
        delete groupClients[currentGroup];
      }
    }
  }
});
// ==== END WebSocket Setup ====


// === Express Setup ===
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Serve static files from landing folder
app.use(express.static(path.join(__dirname, '../Frontend/landing')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/landing/land.html'));
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB Error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/mentor', mentorAuthRoutes);
app.use("/api/save-current-group", groupRoutes);

app.post('/api/match-groups', async (req, res) => {
  try {
    const { group_name } = req.body;
    await Group.create({ name: group_name });
    res.json({ message: `Group ${group_name} received successfully.` });
  } catch (err) {
    console.error("❌ Error in POST /api/match-groups:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/match-groups', async (req, res) => {
  try {
    const groups = await Group.find({}, 'name');
    res.json({ groups: groups.map(g => ({ group_name: g.name })) });
  } catch (err) {
    console.error("❌ Error in GET /api/match-groups:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === Start HTTP + WebSocket Server ===
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🧠 WebSocket chat available at ws://localhost:${PORT}`);
});
