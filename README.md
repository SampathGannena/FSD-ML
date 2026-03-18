# FSD-ML (StudyFinder)

FSD-ML is a full-stack collaborative learning platform that combines mentorship, study groups, real-time communication, and machine learning recommendations.

The project includes:
- A Node.js + Express backend with MongoDB
- A multi-page frontend (HTML/CSS/JS)
- Real-time WebSocket features for chat and collaboration
- Optional hybrid recommendation engine (content-based + collaborative filtering + GNN)

## What The Platform Supports

- Learner and mentor authentication flows
- Study group discovery, joining, and management
- Real-time group chat with reactions, replies, pinning, search, and read tracking
- Mentor availability and mentorship request workflow
- Session feedback, tasks, goals, and progress tracking
- Video room creation/join/leave/end flows with PeerJS support
- Group file upload, listing, and download
- Collaborative code-editor APIs and session metadata
- Recommendation APIs for mentors, sessions, and groups

## Tech Stack

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- JWT authentication
- WebSocket (`ws`)
- PeerJS server integration

### Frontend
- HTML, CSS, JavaScript
- Multi-page structure for landing, credentials, learner dashboards, and mentor dashboards

### ML Recommendation Layer (Optional)
- Python 3.8+
- NumPy, SciPy, scikit-learn, pandas
- PyTorch + torch-geometric (optional for GNN)

## Project Structure

```text
FSD-ML/
	Backend/
		controllers/
		middleware/
		models/
		routes/
		services/
		ml/
		server.js
	Frontend/
		landing/
		credentials/
		Dashboards/
		mentor/
		mentorDash/
		js/
	DEPLOYMENT.md
	QUICKSTART.md
	SECURITY.md
```

## Getting Started (Local Development)

### 1) Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas URI (or local MongoDB instance)
- Python 3.8+ (only for ML recommender features)

### 2) Install Dependencies

Install backend dependencies:

```bash
cd Backend
npm install
```

You can also install root dependencies if needed:

```bash
cd ..
npm install
```

### 3) Configure Environment Variables

Copy and edit `Backend/.env` (based on `Backend/.env.example`):

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@yourdomain.com
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
FRONTEND_URL=http://localhost:5000
```

Notes:
- Password reset/email uses SendGrid (`SENDGRID_API_KEY`, `EMAIL_FROM`).
- `PORT` defaults to `5000` in the server.

### 4) Run The Application

From backend directory:

```bash
cd Backend
npm run dev
```

Or from project root:

```bash
npm start
```

App entry points:
- Landing page: `http://localhost:5000/`
- Health check: `http://localhost:5000/health`

## API Overview

Base URL (local): `http://localhost:5000/api`

### Core Routes
- Auth: `/auth/signup`, `/auth/signin`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`
- Profile and user APIs: mounted at `/api` via profile routes
- Groups/stats: `/groups`, `/match-groups`, group activity/member endpoints
- Study sessions: `/sessions`
- Video rooms: `/video-rooms`
- Recommendations: `/recommendations`

### Recommendation Endpoints
- `GET /api/recommendations/status`
- `POST /api/recommendations/initialize`
- `GET /api/recommendations/mentors?limit=10&method=context_aware`
- `GET /api/recommendations/sessions?limit=10&method=context_aware`
- `GET /api/recommendations/groups?limit=10&method=context_aware`
- `POST /api/recommendations/train`
- `DELETE /api/recommendations/cache`

### Video Room Endpoints
- `POST /api/video-rooms/create`
- `GET /api/video-rooms/:roomCode`
- `POST /api/video-rooms/:roomCode/join`
- `POST /api/video-rooms/:roomCode/leave`
- `POST /api/video-rooms/:roomCode/end`

## Real-Time Features

The backend starts a WebSocket server on the same host/port as Express and supports:
- Group chat history and live messaging
- Poll and poll-vote events
- Video room signaling events
- Collaborative code session events (join/leave/code updates/cursor updates)

PeerJS is attached at path:
- `/peerjs`

## Optional: Enable ML Recommendation Setup

Run the automated setup script from project root (PowerShell):

```powershell
.\setup-recommendations.ps1
```

This script creates `Backend/ml/venv` and installs Python requirements from `Backend/ml/requirements.txt`.

Manual setup:

```bash
cd Backend/ml
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

Then initialize the recommendation system:

```bash
curl -X POST http://localhost:5000/api/recommendations/initialize
```

## Deployment

This repository includes deployment configs and docs for multiple platforms:
- `vercel.json`
- `render.yaml`
- `railway.json`
- `netlify.toml`
- `.github/workflows/deploy.yml`

Deployment guides:
- `QUICKSTART.md`
- `DEPLOYMENT.md`
- `RENDER_DEPLOYMENT.md`

## Security Notes

- Security middleware configuration exists in `Backend/config/security.js`.
- In current `Backend/server.js`, security middleware invocation is commented out for debugging.
- Before production, re-enable security middleware and verify CORS allow-list and environment variables.

Also review:
- `SECURITY.md`

## Useful Pages

- Landing: `Frontend/landing/land.html`
- Learner credentials: `Frontend/credentials/signin.html`, `Frontend/credentials/signup.html`
- Mentor credentials: `Frontend/mentor/signin.html`, `Frontend/mentor/signup.html`
- Mentor dashboard pages: `Frontend/mentorDash/mentorMain.html`, `Frontend/mentorDash/mentorAdvancedDashboard.html`

## Troubleshooting

### MongoDB connection issues
- Verify `MONGO_URI` in `Backend/.env`
- Ensure Atlas network access allows your environment

### CORS issues
- Check frontend origin vs backend CORS options in `Backend/server.js`
- Confirm correct production URL in `FRONTEND_URL`

### Recommendation API not returning data
- Initialize first: `POST /api/recommendations/initialize`
- Ensure user is authenticated for protected recommendation routes

### Email reset flow failing
- Confirm `SENDGRID_API_KEY` and `EMAIL_FROM`
- Verify sender identity in SendGrid

## Documentation Index

- `ML-IMPLEMENTATION-SUMMARY.md`
- `RESPONSIVE_DESIGN_SUMMARY.md`
- `VENV_SETUP_SUMMARY.md`
- `Backend/FORGOT_PASSWORD_SETUP.md`
- `Backend/ml/README.md`
- `Backend/ml/TESTING.md`

## Status

The repository is organized as a deployable full-stack app with optional ML enhancement layer. It is suitable for academic projects, portfolio demonstrations, and incremental production hardening.