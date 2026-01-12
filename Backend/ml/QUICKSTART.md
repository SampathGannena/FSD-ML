# Recommendation System - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies with Virtual Environment

**Automated (Recommended):**
```bash
# From project root
.\setup-recommendations.ps1
```

This creates a virtual environment and installs all dependencies automatically.

**Manual Setup:**
```bash
cd Backend\ml

# Create virtual environment
python -m venv venv

# Activate it (PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

> **Note:** Always activate the virtual environment before running Python scripts!
> See [VIRTUAL_ENV_GUIDE.md](VIRTUAL_ENV_GUIDE.md) for detailed instructions.

### Step 2: Add Route to Server
In `Backend/server.js`, add:
```javascript
const recommendationRoutes = require('./routes/recommendationRoutes');
app.use('/api/recommendations', recommendationRoutes);
```

### Step 3: Start Using!

**Initialize System:**
```bash
curl -X POST http://localhost:3000/api/recommendations/initialize \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get Recommendations:**
```bash
# Mentor recommendations
curl http://localhost:3000/api/recommendations/mentors?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Session recommendations
curl http://localhost:3000/api/recommendations/sessions?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Group recommendations
curl http://localhost:3000/api/recommendations/groups?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Frontend Integration

### Mentor Recommendations Widget
```javascript
// In your dashboard component
async function loadMentorRecommendations() {
  const response = await fetch('/api/recommendations/mentors?limit=5', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const { data } = await response.json();
  
  // Display recommendations
  data.forEach(rec => {
    console.log(`${rec.mentor_name} - ${rec.explanation}`);
    // Render in UI
  });
}
```

### Session Recommendations
```javascript
async function loadSessionRecommendations() {
  const response = await fetch('/api/recommendations/sessions?limit=8', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { data } = await response.json();
  // Display upcoming sessions
}
```

---

## ⚙️ Configuration

### Choose Ensemble Method

**Context-Aware (Recommended):** Adapts to user activity level
```javascript
fetch('/api/recommendations/mentors?method=context_aware')
```

**Weighted:** Fixed weights for all users
```javascript
fetch('/api/recommendations/mentors?method=weighted')
```

**Cascading:** Multi-stage filtering
```javascript
fetch('/api/recommendations/mentors?method=cascading')
```

---

## 🔄 Training Models

### Automatic (On Initialize)
```javascript
POST /api/recommendations/initialize
// Trains if enough data available
```

### Manual Training
```javascript
POST /api/recommendations/train
Body: { "modelType": "collaborative" }

// Options: "collaborative", "gnn", "all"
```

### Scheduled Retraining
```javascript
// Add to your server startup
const schedule = require('node-schedule');

// Retrain every Sunday at 2 AM
schedule.scheduleJob('0 2 * * 0', async () => {
  await recommendationService.trainModels('all');
  console.log('Models retrained successfully');
});
```

---

## 🎯 Use Cases

### 1. Dashboard - "Recommended for You" Section
```javascript
const mentorRecs = await fetch('/api/recommendations/mentors?limit=3');
const sessionRecs = await fetch('/api/recommendations/sessions?limit=3');
// Display side-by-side
```

### 2. Browse Page - Personalized Sorting
```javascript
// Get all sessions, sort by recommendation score
const allSessions = await Session.find({});
const recs = await fetch('/api/recommendations/sessions?limit=50');

// Merge and sort
const sorted = allSessions.sort((a, b) => {
  const scoreA = recs.find(r => r.session_id === a._id)?.score || 0;
  const scoreB = recs.find(r => r.session_id === b._id)?.score || 0;
  return scoreB - scoreA;
});
```

### 3. Empty State - Suggestions
```javascript
// When user has no mentors
if (userMentors.length === 0) {
  const suggestions = await fetch('/api/recommendations/mentors?limit=5');
  // Show "Get started with these mentors"
}
```

---

## 📈 Monitoring

### Check System Status
```javascript
const status = await fetch('/api/recommendations/status');
console.log(status);
// {
//   initialized: true,
//   models: { content: true, collaborative: true, gnn: false }
// }
```

### Clear Cache (if needed)
```javascript
await fetch('/api/recommendations/cache', { method: 'DELETE' });
```

---

## 🐛 Troubleshooting

**No recommendations returned?**
- Check if user is authenticated
- Verify database has mentor/session/group data
- Call `/initialize` endpoint first

**Low quality recommendations?**
- Need more user interaction data
- Try different ensemble method
- Train models: `POST /api/recommendations/train`

**Python errors?**
- Check Python dependencies: `pip list`
- Verify MongoDB connection in `.env`
- Check logs in terminal

**Slow performance?**
- Enable caching (already enabled by default)
- Reduce `limit` parameter
- Use `weighted` method instead of `cascading`

---

## 🎨 UI Examples

### Recommendation Card
```html
<div class="recommendation-card">
  <h3>{{mentor_name}}</h3>
  <div class="score">Match: {{score * 100}}%</div>
  <p class="explanation">{{explanation}}</p>
  <button onclick="connectWithMentor('{{mentor_id}}')">
    Connect
  </button>
</div>
```

### Styles
```css
.recommendation-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
}

.score {
  color: #4CAF50;
  font-weight: bold;
}

.explanation {
  font-size: 14px;
  color: #666;
}
```

---

## 🚦 Production Checklist

- [ ] Python dependencies installed
- [ ] Route added to server.js
- [ ] MongoDB connection configured
- [ ] System initialized via API
- [ ] Models trained (if enough data)
- [ ] Frontend integrated
- [ ] Caching enabled
- [ ] Monitoring setup
- [ ] Error handling added
- [ ] Scheduled retraining (optional)

---

## 📚 Next Steps

1. **Read Full Documentation:** `Backend/ml/README.md`
2. **Customize Weights:** Modify `config.py`
3. **Add A/B Testing:** Compare different methods
4. **Monitor Performance:** Track click-through rates
5. **Enhance Features:** Add more user attributes

---

## ❓ FAQ

**Q: Do I need PyTorch for GNN?**
A: No, it's optional. Content-based + CF works without it.

**Q: How often should I retrain?**
A: Weekly is good. Daily if you have high activity.

**Q: Can I recommend other items?**
A: Yes! Extend the system following the same pattern.

**Q: What if a user is new?**
A: Content-based handles cold-start automatically.

---

**Happy Recommending! 🎯**
