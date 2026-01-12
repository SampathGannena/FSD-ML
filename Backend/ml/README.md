# Hybrid + GNN Recommendation System

## Overview

This directory contains a complete **hybrid recommendation system** that combines:
1. **Content-Based Filtering** - Feature similarity matching
2. **Collaborative Filtering** - Matrix factorization (SVD/ALS)
3. **Graph Neural Networks** - Social graph-based recommendations

The system uses an **ensemble approach** to provide accurate, personalized recommendations for mentors, study sessions, and study groups.

---

## Architecture

```
Backend/ml/
├── recommenders/           # Core recommendation algorithms
│   ├── content_based.py   # Content-based filtering
│   ├── collaborative_filter.py  # Matrix factorization (SVD/ALS)
│   ├── gnn_recommender.py      # GNN (GraphSAGE/LightGCN)
│   └── hybrid_ensemble.py      # Ensemble combiner
├── data/                   # Data processing
│   ├── user_features.py    # Feature extraction
│   ├── interaction_matrix.py   # Interaction data builder
│   └── graph_builder.py        # Graph construction
├── api/                    # API integration
│   └── recommendation_api.py   # Python backend API
├── utils/                  # Utilities
│   └── evaluation.py       # Metrics (Precision, NDCG, etc.)
└── requirements.txt        # Python dependencies
```

---

## Installation

### 1. Install Python Dependencies (Virtual Environment)

**Recommended: Use the automated setup script**

From the project root:
```bash
.\setup-recommendations.ps1
```

This will:
- Create a virtual environment at `Backend/ml/venv/`
- Install all Python dependencies
- Configure everything automatically

**Manual Installation:**

```bash
cd Backend/ml

# Create virtual environment
python -m venv venv

# Activate (PowerShell)
.\venv\Scripts\Activate.ps1

# Activate (CMD)
# venv\Scripts\activate.bat

# Activate (Linux/Mac)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> **Important:** Always activate the virtual environment before working with Python!
> See [VIRTUAL_ENV_GUIDE.md](VIRTUAL_ENV_GUIDE.md) for complete guide.

**Required:**
- numpy, scipy, scikit-learn (for content-based and CF)
- pymongo (for database)
- python-dotenv (for environment variables)

**Optional (for GNN):**
```bash
# If you want to use GNN recommender
pip install torch torch-geometric
```

> **Note:** GNN is optional. The system works with just content-based + collaborative filtering.

### 2. Configure Environment

Add to `Backend/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/fsd_ml
```

### 3. Integrate Routes

Add to `Backend/server.js`:
```javascript
const recommendationRoutes = require('./routes/recommendationRoutes');

// ... other routes ...

app.use('/api/recommendations', recommendationRoutes);
```

---

## Usage

### Initialize the System

```javascript
// Call once on server startup or via API
POST /api/recommendations/initialize

Response:
{
  "status": "success",
  "models": {
    "content": true,
    "collaborative": true,
    "gnn": false
  },
  "interaction_count": 1250
}
```

### Get Recommendations

**Mentor Recommendations:**
```javascript
GET /api/recommendations/mentors?limit=10&method=context_aware

Response:
{
  "success": true,
  "data": [
    {
      "mentor_id": "507f1f77bcf86cd799439011",
      "score": 0.87,
      "explanation": "Expertise in machine-learning, data-science • 92% success rate",
      "mentor_name": "Dr. Jane Smith",
      "mentor_email": "jane@example.com"
    }
  ]
}
```

**Session Recommendations:**
```javascript
GET /api/recommendations/sessions?limit=10

Response:
{
  "success": true,
  "data": [
    {
      "session_id": "507f1f77bcf86cd799439012",
      "score": 0.82,
      "explanation": "Matches your intermediate level • Based on your interest in machine-learning",
      "title": "Introduction to Neural Networks",
      "subject": "machine-learning",
      "level": "intermediate"
    }
  ]
}
```

**Group Recommendations:**
```javascript
GET /api/recommendations/groups?limit=10

Response:
{
  "success": true,
  "data": [
    {
      "group_id": "507f1f77bcf86cd799439013",
      "score": 0.79,
      "explanation": "Active group with 24 members",
      "name": "ML Enthusiasts",
      "category": "machine-learning",
      "member_count": 24
    }
  ]
}
```

---

## Ensemble Methods

The system supports **three ensemble strategies**:

### 1. Weighted Ensemble (Default)
Combines all models with configurable weights:
```
Final Score = 0.3 × Content + 0.4 × CF + 0.3 × GNN
```

**Usage:**
```javascript
GET /api/recommendations/mentors?method=weighted
```

### 2. Cascading Pipeline
Multi-stage filtering and ranking:
```
Stage 1: GNN → Filter to top 50 candidates
Stage 2: CF  → Rank and reduce to top 20
Stage 3: Content → Personalize final top 10
```

**Usage:**
```javascript
GET /api/recommendations/sessions?method=cascading
```

### 3. Context-Aware Routing (Recommended)
Adapts weights based on user context:

- **New users (streak < 5):** Content-heavy (70% content, 20% CF, 10% GNN)
- **Active users (streak > 30):** CF + GNN heavy (20% content, 40% CF, 40% GNN)
- **Mentor recommendations:** Boost content-based (domain matching)
- **Group recommendations:** Boost GNN (social connections)

**Usage:**
```javascript
GET /api/recommendations/groups?method=context_aware
```

---

## Training Models

### Manual Training

Train specific models:
```javascript
POST /api/recommendations/train
Body: { "modelType": "collaborative" }  // or "gnn" or "all"
```

### Automatic Retraining

Add to your cron job or scheduler:
```javascript
// Retrain weekly
const schedule = require('node-schedule');

schedule.scheduleJob('0 2 * * 0', async () => {
  await recommendationService.trainModels('all');
});
```

### Training Requirements

**Minimum Data:**
- **Content-Based:** Always works (uses item features)
- **Collaborative Filtering:** 1,000+ users, 10,000+ interactions
- **GNN:** 5,000+ users, 50,000+ edges for good performance

---

## Performance Metrics

The system tracks:

### Accuracy Metrics
- **Precision@K:** How many recommended items are relevant
- **Recall@K:** What % of relevant items were recommended
- **NDCG@K:** Normalized ranking quality
- **Hit Rate@K:** Whether top-K contains any relevant item

### Business Metrics
- **Coverage:** % of catalog items ever recommended
- **Diversity:** Variety in recommendations
- **Response Time:** API latency

### Example Evaluation
```python
from utils.evaluation import evaluate_recommendations

metrics = evaluate_recommendations(
    recommendations={'user1': ['item1', 'item2', 'item3']},
    ground_truth={'user1': ['item2', 'item4']},
    k_values=[5, 10]
)
# Returns: {'precision@5': 0.2, 'recall@5': 0.5, 'ndcg@5': 0.63, ...}
```

---

## API Reference

### Express.js Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recommendations/mentors` | GET | Get mentor recommendations |
| `/api/recommendations/sessions` | GET | Get session recommendations |
| `/api/recommendations/groups` | GET | Get group recommendations |
| `/api/recommendations/status` | GET | Get system status |
| `/api/recommendations/initialize` | POST | Initialize/reinitialize system |
| `/api/recommendations/train` | POST | Train models |
| `/api/recommendations/cache` | DELETE | Clear cache |

### Query Parameters

- `limit` (number): Number of recommendations (default: 10)
- `method` (string): Ensemble method - `weighted`, `cascading`, or `context_aware`
- `refresh` (boolean): Force refresh, bypass cache

---

## Troubleshooting

### Issue: "PyTorch not available"
**Solution:** GNN is optional. System will use content-based + CF only.
```bash
# Install PyTorch if needed
pip install torch torch-geometric
```

### Issue: "No interactions found"
**Solution:** System needs user activity data. Content-based will still work.
- Add more mentorship requests, session participations, group memberships

### Issue: "User not found"
**Solution:** Ensure user exists in database and is authenticated.

### Issue: Low recommendation quality
**Solutions:**
1. Train models: `POST /api/recommendations/train`
2. Add more interaction data
3. Enrich user profiles (bio, goals, interests)
4. Use `context_aware` method for adaptive weighting

---

## Customization

### Adjust Ensemble Weights

In `hybrid_ensemble.py`:
```python
self.weights = {
    'content': 0.4,      # Increase for cold-start scenarios
    'collaborative': 0.3, # Increase for mature platforms
    'gnn': 0.3           # Increase for social-heavy use cases
}
```

### Add New Recommendation Types

1. Create feature extractor in `data/user_features.py`
2. Add recommendation method in `hybrid_ensemble.py`
3. Add route in `routes/recommendationRoutes.js`

### Custom Similarity Functions

Modify `content_based.py`:
```python
def calculate_custom_similarity(self, profile1, profile2):
    # Your custom logic
    return similarity_score
```

---

## Production Deployment

### 1. Add Redis Caching (Optional)
```javascript
const redis = require('redis');
const client = redis.createClient();
// Use for faster repeated queries
```

### 2. Background Training
```javascript
// Use job queue (Bull, Agenda)
const queue = new Bull('recommendation-training');
queue.process(async (job) => {
  await recommendationService.trainModels(job.data.modelType);
});
```

### 3. Monitoring
```javascript
// Track recommendation metrics
app.get('/api/recommendations/mentors', async (req, res) => {
  const start = Date.now();
  const recs = await recommendationService.recommendMentors(userId);
  const latency = Date.now() - start;
  
  // Log metrics
  logger.info(`Recommendations generated in ${latency}ms`);
});
```

### 4. A/B Testing
```javascript
// Test different ensemble methods
const method = Math.random() > 0.5 ? 'weighted' : 'context_aware';
const recs = await recommendationService.recommendMentors(userId, { method });
```

---

## Performance Expectations

| Component | Latency | Scalability |
|-----------|---------|-------------|
| Content-Based | < 50ms | Excellent (10K+ items) |
| Collaborative Filter | < 100ms | Good (100K+ users) |
| GNN | 100-200ms | Moderate (50K users) |
| Hybrid Ensemble | 50-150ms | Good |

**Recommendations:**
- Use caching for frequently requested users
- Pre-compute recommendations for active users (background job)
- Scale GNN with GPU for 100K+ users

---

## Future Enhancements

1. **Real-time Updates:** Stream new interactions to update models incrementally
2. **Deep Learning:** Add neural collaborative filtering for better cold-start
3. **Explainability:** Enhanced explanations using LIME/SHAP
4. **Multi-objective:** Balance accuracy, diversity, and novelty
5. **Contextual Bandits:** Online learning from user feedback

---

## References

- **Content-Based:** TF-IDF, Cosine Similarity
- **Collaborative Filtering:** SVD (Koren et al.), ALS (Hu et al.)
- **GNN:** LightGCN (He et al. 2020), GraphSAGE (Hamilton et al. 2017)
- **Evaluation:** Precision@K, NDCG (Järvelin & Kekäläinen 2002)

---

## Support

For questions or issues:
1. Check this README
2. Review code comments in `recommenders/`
3. Check logs in console/terminal
4. Create an issue in the repository

---

**Built with ❤️ for the FSD-ML Learning Platform**
