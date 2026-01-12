# Testing the Recommendation System

## Quick Test

### Option 1: Automated Test Script (Recommended)
```powershell
# From Backend directory
.\test-recommendations.ps1
```

### Option 2: Manual Python Test
```powershell
# Activate virtual environment
.\ml\venv\Scripts\Activate.ps1

# Run test script
python .\ml\test_recommendations.py
```

## Step-by-Step Testing

### 1. Check System Status

**Python API:**
```powershell
python .\ml\api\recommendation_api.py --action status --params '{}'
```

**Expected Output:**
```json
{
  "status": "success",
  "initialized": false,
  "models": {
    "content": false,
    "collaborative": false,
    "gnn": false
  },
  "database_connected": true
}
```

### 2. Initialize the System

This trains the models with your database data.

**Node.js API (if server is running):**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/initialize" -Method POST
```

**Python API:**
```powershell
python .\ml\api\recommendation_api.py --action initialize --params '{}'
```

**Expected Output:**
```json
{
  "status": "success",
  "message": "Recommendation system initialized",
  "models": {
    "content": true,
    "collaborative": true,
    "gnn": true
  },
  "interaction_count": 150
}
```

### 3. Get Mentor Recommendations

**Node.js API:**
```powershell
# Replace YOUR_USER_ID with actual user ID from your database
Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/mentors?userId=YOUR_USER_ID&limit=5" -Method GET
```

**Python API:**
```powershell
python .\ml\api\recommendation_api.py --action recommend_mentors --params '{\"user_id\": \"YOUR_USER_ID\", \"top_k\": 5}'
```

**Expected Output:**
```json
{
  "status": "success",
  "recommendations": [
    {
      "mentor_id": "mentor123",
      "score": 0.89,
      "explanation": "Matched based on: Python, Machine Learning expertise"
    },
    {
      "mentor_id": "mentor456",
      "score": 0.76,
      "explanation": "High collaborative filtering score"
    }
  ]
}
```

### 4. Get Session Recommendations

**Node.js API:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/sessions?userId=YOUR_USER_ID&limit=5" -Method GET
```

**Python API:**
```powershell
python .\ml\api\recommendation_api.py --action recommend_sessions --params '{\"user_id\": \"YOUR_USER_ID\", \"top_k\": 5}'
```

### 5. Get Group Recommendations

**Node.js API:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/groups?userId=YOUR_USER_ID&limit=5" -Method GET
```

**Python API:**
```powershell
python .\ml\api\recommendation_api.py --action recommend_groups --params '{\"user_id\": \"YOUR_USER_ID\", \"top_k\": 5}'
```

## Testing Different Ensemble Methods

You can test different recommendation strategies:

### Weighted Ensemble (Default)
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/mentors?userId=USER_ID&method=weighted" -Method GET
```

### Cascading Ensemble
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/mentors?userId=USER_ID&method=cascading" -Method GET
```

### Context-Aware Routing
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/recommendations/mentors?userId=USER_ID&method=context_aware" -Method GET
```

## Troubleshooting

### Issue: "Database not available"
**Solution:**
- Check MongoDB is running: `mongosh` or check MongoDB Compass
- Verify MONGODB_URI in `.env` file
- Test connection: `mongosh "mongodb://localhost:27017/fsd_ml"`

### Issue: "Model not trained"
**Solution:**
- Run initialization: `POST /api/recommendations/initialize`
- Check you have data in MongoDB collections (users, mentors, studysessions, groups)

### Issue: "User not found"
**Solution:**
- Verify user ID exists in database
- Check user ID format (should match MongoDB _id or userId field)
- Try with a different user who has interaction history

### Issue: "Empty recommendations"
**Solution:**
- Ensure you have sufficient data (at least 10+ users, mentors, sessions)
- Check user has some interaction history
- Verify candidate items exist (mentors/sessions/groups in database)

### Issue: "PyTorch errors"
**Solution:**
- PyTorch is optional - GNN will be disabled but other models work
- Install PyTorch: `pip install torch torch-geometric`
- Or use only content-based and collaborative filtering

## Performance Testing

### Check Model Training Time
```powershell
Measure-Command {
  python .\ml\api\recommendation_api.py --action initialize --params '{}'
}
```

### Check Recommendation Speed
```powershell
Measure-Command {
  python .\ml\api\recommendation_api.py --action recommend_mentors --params '{\"user_id\": \"USER_ID\", \"top_k\": 10}'
}
```

## Integration with Frontend

Once server is running, your frontend can call:

```javascript
// Initialize system
await fetch('http://localhost:3000/api/recommendations/initialize', {
  method: 'POST'
});

// Get recommendations
const response = await fetch(
  `http://localhost:3000/api/recommendations/mentors?userId=${userId}&limit=10`
);
const data = await response.json();
console.log(data.recommendations);
```

## Next Steps

1. ✅ Run `.\test-recommendations.ps1` to verify everything works
2. ✅ Initialize the system with real data
3. ✅ Test with actual user IDs from your database
4. ✅ Integrate the endpoints into your Express routes
5. ✅ Connect frontend to recommendation API
6. ✅ Monitor performance and adjust parameters as needed

## Expected Data Flow

```
User Request (Frontend)
    ↓
Express.js Server (recommendationRoutes.js)
    ↓
RecommendationService (Node.js wrapper)
    ↓
Python API (recommendation_api.py)
    ↓
Hybrid Ensemble (combines all models)
    ↓
    ├─→ Content-Based Recommender
    ├─→ Collaborative Filter
    └─→ GNN Recommender
    ↓
Ranked Recommendations
    ↓
JSON Response to Frontend
```
