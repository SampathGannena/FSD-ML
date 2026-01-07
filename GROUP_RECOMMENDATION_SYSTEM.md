# Group Recommendation System Documentation

## Overview

The Group Recommendation System provides intelligent, personalized group suggestions to users based on multiple factors including user behavior, group activity, popularity, and collaborative filtering. This helps users discover relevant study groups that match their interests and learning goals.

## Architecture

### Components

1. **Service Layer** (`Backend/services/groupRecommendationService.js`)
   - Core recommendation algorithm
   - Scoring logic
   - Data analysis

2. **API Routes** (`Backend/routes/groupRecommendationRoutes.js`)
   - REST endpoints for recommendations
   - Feedback collection
   - Trending groups

3. **Frontend UI** (`Frontend/Dashboards/group-recommendations.html`)
   - Recommendation display
   - User interaction
   - Group joining interface

## Recommendation Algorithm

### Scoring System

The recommendation score (0-1 range) combines 5 weighted factors:

#### 1. Similarity Score (30% weight)
- **Category Matching**: Groups in same category as user's current groups
- **Name Similarity**: Keyword matching between group names
- **Score Range**: 0.0 - 1.0
- **Example**: User in "JavaScript Study" → Recommends "React JS Study"

#### 2. Popularity Score (20% weight)
- **Optimal Size**: Groups at 30-80% capacity score highest
- **Engagement**: Message-to-member ratio bonus
- **Score Range**: 0.0 - 1.0
- **Logic**: 
  - Too small (< 30%): Score = memberCount / optimalMin
  - Perfect size (30-80%): Score = 1.0
  - Too large (> 80%): Penalty applied

#### 3. Activity Score (25% weight)
- **Recent Activity**: Last 24h, 7d, 30d activity tracking
- **Score Range**: 0.2 - 1.0
- **Tiers**:
  - Very Active (>5 actions/24h): 1.0
  - Active (>2 actions/24h): 0.8
  - Moderate (>10 actions/7d): 0.6
  - Low (>5 actions/30d): 0.4
  - Inactive: 0.2

#### 4. Availability Score (15% weight)
- **Public Access**: +0.5 if group is public
- **No Approval**: +0.3 if no approval required
- **Space Available**: +0.2 based on available slots
- **Score Range**: 0.0 - 1.0

#### 5. Collaborative Filtering Score (10% weight)
- **User Similarity**: Find users with similar group memberships
- **Recommendation**: Groups popular among similar users
- **Score Range**: 0.0 - 1.0
- **Algorithm**: Count of similar users in target group / total similar users

### Final Score Calculation

```javascript
finalScore = (
  similarityScore * 0.30 +
  popularityScore * 0.20 +
  activityScore * 0.25 +
  availabilityScore * 0.15 +
  collaborativeScore * 0.10
)
```

## API Endpoints

### 1. Get Personalized Recommendations

```http
GET /api/groups/recommendations
Authorization: Bearer <token>
Query Parameters:
  - limit (optional, default: 10)
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "recommendations": [
    {
      "id": "group_id",
      "name": "JavaScript Mastery",
      "description": "Advanced JavaScript study group",
      "category": "Programming",
      "memberCount": 25,
      "activeMembers": 12,
      "stats": {
        "totalMessages": 543,
        "totalFiles": 42,
        "totalSessions": 18
      },
      "isPublic": true,
      "score": 0.87,
      "reasons": [
        "Very active group with recent discussions",
        "Matches your interest in Programming",
        "Popular group with engaged members"
      ],
      "recentActivity": [...]
    }
  ]
}
```

### 2. Get Trending Groups

```http
GET /api/groups/trending
Authorization: Bearer <token>
Query Parameters:
  - limit (optional, default: 5)
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "trending": [
    {
      "id": "group_id",
      "name": "React Developers",
      "description": "React study and discussion",
      "category": "Web Development",
      "memberCount": 45,
      "activityCount": 87,
      "stats": {...}
    }
  ]
}
```

### 3. Get Similar Groups

```http
GET /api/groups/similar/:groupName
Authorization: Bearer <token>
Query Parameters:
  - limit (optional, default: 5)
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "similar": [
    {
      "id": "group_id",
      "name": "Similar Group",
      "category": "Programming",
      "memberCount": 30,
      "score": 0.75
    }
  ]
}
```

### 4. Submit Feedback

```http
POST /api/groups/recommendations/feedback
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "groupId": "group_id",
  "action": "joined|dismissed|viewed",
  "helpful": true|false
}
```

## Frontend Integration

### Basic Usage

```html
<!-- Link to recommendations page -->
<a href="/Dashboards/group-recommendations.html">
  <i class="fas fa-sparkles"></i>
  Discover Groups
</a>
```

### JavaScript API

```javascript
// Fetch recommendations
async function getRecommendations() {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/groups/recommendations?limit=10', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.recommendations;
}

// Join recommended group
async function joinGroup(groupName) {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/save-current-group', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ groupName })
  });
  return response.json();
}
```

## Recommendation Reasons

The system provides human-readable explanations for each recommendation:

### Activity-Based
- "Very active group with recent discussions"
- "Active community"

### Popularity-Based
- "Popular group with engaged members"
- "Small, close-knit community"

### Category-Based
- "Matches your interest in [Category]"

### Content-Based
- "Rich conversation history"
- "Regular study sessions"

### Accessibility-Based
- "Easy to join - no approval needed"

## Data Requirements

### Group Model Fields Used
- `name`: Group identifier
- `category`: For similarity matching
- `members`: For popularity & collaborative filtering
- `stats`: Activity metrics
- `settings`: Availability factors
- `recentActivity`: Activity scoring
- `status`: Must be 'active'

### User Model Fields Used
- `groups`: Array of joined group names
- User similarity calculation

## Performance Optimization

### Caching Strategy (Future Enhancement)
```javascript
// Cache recommendations for 1 hour
const CACHE_TTL = 3600000; // 1 hour in ms
const recommendationCache = new Map();

function getCachedRecommendations(userId) {
  const cached = recommendationCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}
```

### Database Indexing

Add these indexes for better performance:

```javascript
// In Group model
GroupSchema.index({ status: 1, 'settings.isPublic': 1 });
GroupSchema.index({ category: 1 });
GroupSchema.index({ 'members.userId': 1 });
GroupSchema.index({ 'recentActivity.timestamp': -1 });

// In User model
UserSchema.index({ groups: 1 });
```

## Customization

### Adjust Weights

Modify weights in `calculateRecommendationScore()`:

```javascript
const weights = {
  similarity: 0.30,      // Adjust based on importance
  popularity: 0.20,      // of each factor
  activity: 0.25,
  availability: 0.15,
  collaborative: 0.10
};
```

### Add New Factors

1. Create new scoring method:
```javascript
static calculateNewFactorScore(user, group) {
  // Your logic here
  return score; // 0-1 range
}
```

2. Add to main calculation:
```javascript
const newFactorScore = this.calculateNewFactorScore(user, group);
score += newFactorScore * weights.newFactor;
```

3. Update weights to sum to 1.0

## Analytics & Improvement

### Feedback Collection

The system collects user feedback for:
- Joined groups (positive signal)
- Dismissed recommendations (negative signal)
- Viewed but not joined (neutral signal)

### Future ML Integration

```javascript
// Placeholder for ML model integration
static async getMLRecommendations(userId) {
  // 1. Collect user features
  // 2. Call ML model API
  // 3. Combine with rule-based scores
  // 4. Return hybrid recommendations
}
```

## Testing

### Unit Tests (Example)

```javascript
describe('GroupRecommendationService', () => {
  it('should calculate similarity score correctly', () => {
    const user = { groups: ['JavaScript Study', 'React Basics'] };
    const group = { name: 'Advanced React', category: 'Programming' };
    const score = GroupRecommendationService.calculateSimilarityScore(user, group, []);
    expect(score).toBeGreaterThan(0);
  });

  it('should prioritize active groups', () => {
    const activeGroup = { recentActivity: [...24hActivities] };
    const inactiveGroup = { recentActivity: [] };
    
    const activeScore = GroupRecommendationService.calculateActivityScore(activeGroup);
    const inactiveScore = GroupRecommendationService.calculateActivityScore(inactiveGroup);
    
    expect(activeScore).toBeGreaterThan(inactiveScore);
  });
});
```

### Integration Testing

```javascript
// Test recommendation endpoint
const response = await request(app)
  .get('/api/groups/recommendations')
  .set('Authorization', `Bearer ${testToken}`)
  .expect(200);

expect(response.body.success).toBe(true);
expect(response.body.recommendations).toBeInstanceOf(Array);
expect(response.body.recommendations[0]).toHaveProperty('score');
```

## Monitoring

### Key Metrics to Track

1. **Recommendation Quality**
   - Click-through rate (CTR)
   - Join rate
   - Dismiss rate

2. **System Performance**
   - Response time
   - Cache hit rate
   - Database query time

3. **User Engagement**
   - Daily active users viewing recommendations
   - Groups discovered through recommendations
   - User retention after joining recommended groups

### Logging

```javascript
console.log({
  event: 'recommendation_served',
  userId,
  recommendationCount: recommendations.length,
  avgScore: avgScore,
  timestamp: new Date()
});
```

## Troubleshooting

### Common Issues

**1. No recommendations returned**
- Check if user has any groups
- Verify active groups exist in database
- Check if user is already member of all groups

**2. Low recommendation scores**
- Verify group activity data is being tracked
- Check if `recentActivity` is populated
- Ensure timestamps are valid

**3. Slow response times**
- Add database indexes
- Implement caching
- Limit concurrent user lookups in collaborative filtering

## Roadmap

### Phase 1 (Current)
- ✅ Rule-based recommendations
- ✅ Multiple scoring factors
- ✅ Trending groups
- ✅ Similar groups

### Phase 2 (Next)
- [ ] Caching layer (Redis)
- [ ] A/B testing framework
- [ ] User preference learning
- [ ] Email notifications for recommendations

### Phase 3 (Future)
- [ ] Machine learning model integration
- [ ] Real-time recommendation updates
- [ ] Social graph analysis
- [ ] Predictive group success metrics

## Support

For issues or questions:
1. Check server logs for errors
2. Verify MongoDB connection
3. Test endpoints with Postman
4. Review user's group membership data

## License

Part of FSD-ML application - © 2025
