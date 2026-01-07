# Quick Setup Guide - Group Recommendation System

## Installation

The recommendation system is already integrated into your application! Just follow these steps to use it.

## Step 1: Start the Server

```bash
cd Backend
npm install  # If you haven't already
npm start
```

The server will automatically load the recommendation routes.

## Step 2: Access Recommendations

### Option A: Direct Link
Navigate to: `http://localhost:5000/Dashboards/group-recommendations.html`

### Option B: From Dashboard
Add this link to your main dashboard navigation:

```html
<a href="group-recommendations.html" class="nav-link">
  <i class="fas fa-sparkles"></i>
  Discover Groups
</a>
```

## Step 3: Test the System

### Test Data Setup

Create some test groups with different categories:

```javascript
// Run this in MongoDB or create via UI
db.groups.insertMany([
  {
    name: "JavaScript Beginners",
    description: "Learn JavaScript from scratch",
    category: "Programming",
    status: "active",
    members: [],
    settings: { isPublic: true, requireApproval: false, maxMembers: 50 },
    stats: { totalMessages: 125, totalFiles: 15, totalSessions: 8 },
    recentActivity: [
      { action: "message", timestamp: new Date(), description: "New discussion" }
    ]
  },
  {
    name: "React Mastery",
    description: "Advanced React patterns and best practices",
    category: "Programming",
    status: "active",
    members: [],
    settings: { isPublic: true, requireApproval: false, maxMembers: 50 },
    stats: { totalMessages: 234, totalFiles: 28, totalSessions: 15 },
    recentActivity: [
      { action: "message", timestamp: new Date(), description: "Code review session" }
    ]
  },
  {
    name: "Python Data Science",
    description: "Data science with Python",
    category: "Data Science",
    status: "active",
    members: [],
    settings: { isPublic: true, requireApproval: false, maxMembers: 50 },
    stats: { totalMessages: 189, totalFiles: 42, totalSessions: 12 },
    recentActivity: []
  }
]);
```

## Step 4: Test API Endpoints

### Using curl:

```bash
# Get recommendations (replace YOUR_TOKEN with actual token)
curl -X GET "http://localhost:5000/api/groups/recommendations?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get trending groups
curl -X GET "http://localhost:5000/api/groups/trending?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get similar groups
curl -X GET "http://localhost:5000/api/groups/similar/JavaScript%20Beginners?limit=3" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using JavaScript (Browser Console):

```javascript
// Get your token
const token = localStorage.getItem('token');

// Fetch recommendations
fetch('http://localhost:5000/api/groups/recommendations?limit=10', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log('Recommendations:', data));

// Fetch trending
fetch('http://localhost:5000/api/groups/trending', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log('Trending:', data));
```

## Step 5: Customize Recommendations

### Adjust Weights

Edit `Backend/services/groupRecommendationService.js`:

```javascript
const weights = {
  similarity: 0.30,      // ← Adjust these
  popularity: 0.20,
  activity: 0.25,
  availability: 0.15,
  collaborative: 0.10
};
```

### Change Recommendation Limit

In the frontend or API calls:
```javascript
// Get more recommendations
fetch('/api/groups/recommendations?limit=20', ...)

// Get fewer
fetch('/api/groups/recommendations?limit=5', ...)
```

## Common Use Cases

### 1. New User (No Groups)
- System returns neutral recommendations
- Focuses on active, popular groups
- Shows trending groups

### 2. User with 2-3 Groups
- Recommendations based on category similarity
- Groups with similar members
- Related study topics

### 3. Active User (5+ Groups)
- Highly personalized recommendations
- Collaborative filtering kicks in
- Niche group suggestions

## Monitoring Recommendations

### Check Recommendation Quality

```javascript
// In browser console on recommendation page
const cards = document.querySelectorAll('.group-card');
cards.forEach(card => {
  const score = card.querySelector('.score-badge').textContent;
  const reasons = Array.from(card.querySelectorAll('.reason-item span'))
    .map(el => el.textContent);
  console.log('Score:', score, 'Reasons:', reasons);
});
```

### Server Logs

Watch for these logs:
```
📚 Fetching recommendations for user: <userId>
✅ Returned 10 recommendations
🔥 Trending groups calculated: 5 groups
```

## Troubleshooting

### Issue: No recommendations shown

**Check:**
1. User is authenticated (token exists)
2. Active groups exist in database
3. Server is running and connected to MongoDB

**Solution:**
```javascript
// Verify token
console.log('Token:', localStorage.getItem('token'));

// Check groups in DB
db.groups.find({ status: 'active' }).count()
```

### Issue: All recommendations have low scores

**Check:**
1. Groups have recent activity
2. Groups have members
3. Groups have proper category set

**Solution:**
Add activity to groups:
```javascript
// Update group with recent activity
db.groups.updateOne(
  { name: "JavaScript Beginners" },
  { 
    $push: { 
      recentActivity: {
        $each: [
          { action: "message", timestamp: new Date(), description: "New message" }
        ],
        $position: 0
      }
    }
  }
);
```

### Issue: Server error when fetching recommendations

**Check server logs for:**
- MongoDB connection errors
- Missing User/Group documents
- Token validation failures

**Solution:**
```bash
# Restart server with detailed logging
npm start
```

## Performance Tips

### 1. Limit Initial Load

```javascript
// Load fewer recommendations initially
loadRecommendations(limit = 5);

// Load more on scroll
window.addEventListener('scroll', () => {
  if (nearBottom()) loadMoreRecommendations();
});
```

### 2. Add Database Indexes

```javascript
// In MongoDB
db.groups.createIndex({ status: 1, "settings.isPublic": 1 });
db.groups.createIndex({ category: 1 });
db.users.createIndex({ groups: 1 });
```

### 3. Implement Caching (Future)

```javascript
// Redis cache example
const cachedRecs = await redis.get(`recommendations:${userId}`);
if (cachedRecs) return JSON.parse(cachedRecs);
```

## Next Steps

1. **Add to Navigation**: Include link in main dashboard
2. **Test with Users**: Get feedback on recommendation quality
3. **Track Metrics**: Monitor join rates from recommendations
4. **Iterate**: Adjust weights based on user behavior
5. **Enhance UI**: Add filters, sorting, search

## Support

If you encounter issues:

1. Check [GROUP_RECOMMENDATION_SYSTEM.md](GROUP_RECOMMENDATION_SYSTEM.md) for detailed docs
2. Review server logs
3. Test API endpoints with Postman
4. Verify database has active groups with proper data

## Files Created

- `Backend/services/groupRecommendationService.js` - Core recommendation logic
- `Backend/routes/groupRecommendationRoutes.js` - API endpoints
- `Frontend/Dashboards/group-recommendations.html` - UI page
- `GROUP_RECOMMENDATION_SYSTEM.md` - Full documentation
- `QUICK_SETUP_RECOMMENDATIONS.md` - This file

You're all set! 🎉
