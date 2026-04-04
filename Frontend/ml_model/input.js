// Global variables
let allGroups = [];
let filteredGroups = [];
let recommendedGroups = [];
let currentFilter = 'all';
let userGroups = [];
let groupsRefreshIntervalId = null;
let lastGroupsRefreshAt = null;
let isGroupsRefreshing = false;
const GROUPS_AUTO_REFRESH_MS = 30000;

// Get API URL
const API_URL = window.location.origin;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadGroups();
  setupEventListeners();
  await loadUserGroups();
  await loadRecommendedGroups();
  startGroupsAutoRefresh();
  updateGroupsRefreshMeta('Auto-refresh every 30s');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopGroupsAutoRefresh();
    updateGroupsRefreshMeta('Auto-refresh paused in background');
  } else {
    startGroupsAutoRefresh();
    refreshGroupsData(true);
  }
});

// Setup event listeners
function setupEventListeners() {
  // Search bar
  const searchBar = document.getElementById('searchBar');
  searchBar.addEventListener('input', handleSearch);

  // Filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => handleFilterChange(btn));
  });

  const recommendationModal = document.getElementById('recommendationModal');
  if (recommendationModal) {
    recommendationModal.addEventListener('click', (event) => {
      if (event.target === recommendationModal) {
        closeRecommendationModal();
      }
    });
  }
}

// Load all groups from the API
async function loadGroups(options = {}) {
  const { silent = false } = options;
  const container = document.getElementById('groupsContainer');

  if (isGroupsRefreshing) return;
  isGroupsRefreshing = true;
  setGroupsRefreshState('loading');
  
  try {
    const response = await fetch(`${API_URL}/api/groups/all`);
    const data = await response.json();

    if (data.success && data.groups) {
      allGroups = data.groups;
      applyFilter();
      lastGroupsRefreshAt = new Date();
      setGroupsRefreshState('ok');
    } else {
      setGroupsRefreshState('error');
      if (!silent || allGroups.length === 0) {
        showError('Failed to load groups');
      }
    }
  } catch (error) {
    console.error('Error loading groups:', error);
    setGroupsRefreshState('error');
    if (!silent || allGroups.length === 0) {
      showError('Failed to load groups. Please try again.');
    }
  } finally {
    isGroupsRefreshing = false;
  }
}

// Load user's groups
async function loadUserGroups() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const userResponse = await fetch(`${API_URL}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      userGroups = userData.groups || [];
      applyFilter();
    }
  } catch (error) {
    console.error('Error loading user groups:', error);
  }
}

function startGroupsAutoRefresh() {
  stopGroupsAutoRefresh();
  groupsRefreshIntervalId = setInterval(() => {
    refreshGroupsData(true);
  }, GROUPS_AUTO_REFRESH_MS);
}

function stopGroupsAutoRefresh() {
  if (groupsRefreshIntervalId) {
    clearInterval(groupsRefreshIntervalId);
    groupsRefreshIntervalId = null;
  }
}

async function refreshGroupsData(silent = true) {
  await loadGroups({ silent });
  await loadUserGroups();
  await loadRecommendedGroups({ silent: true });
}

async function loadRecommendedGroups(options = {}) {
  const { silent = false } = options;
  const token = localStorage.getItem('token');
  const sectionEl = document.getElementById('recommendedSection');

  if (!token) {
    recommendedGroups = [];
    renderRecommendedGroups();
    if (sectionEl) sectionEl.style.display = 'none';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/recommendations/groups?limit=6&method=context_aware`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || payload.error || 'Failed to load recommendations');
    }

    const data = payload.data || {};
    const recommendationItems = Array.isArray(data)
      ? data
      : (Array.isArray(data.recommendations) ? data.recommendations : []);

    const groupsByName = new Map(allGroups.map(group => [String(group.name).toLowerCase(), group]));

    recommendedGroups = recommendationItems
      .map(item => {
        const groupName = item.name || item.group_name || item.groupName || '';
        if (!groupName) return null;

        const matchedGroup = groupsByName.get(String(groupName).toLowerCase());

        return {
          ...(matchedGroup || {}),
          name: groupName,
          category: item.category || matchedGroup?.category || 'General',
          memberCount: Number(item.member_count ?? item.memberCount ?? matchedGroup?.memberCount ?? matchedGroup?.members?.length ?? 0),
          status: item.status || matchedGroup?.status || 'active',
          score: Number(item.score ?? 0),
          explanation: item.explanation || item.reason || 'Matched based on your profile and study patterns.'
        };
      })
      .filter(Boolean);

    renderRecommendedGroups();
  } catch (error) {
    console.error('Error loading recommended groups:', error);
    recommendedGroups = [];
    renderRecommendedGroups();

    if (!silent && typeof window.showNotification === 'function') {
      window.showNotification('Could not load recommendations right now.', 'warning');
    }
  }
}

function renderRecommendedGroups() {
  const sectionEl = document.getElementById('recommendedSection');
  const containerEl = document.getElementById('recommendedContainer');
  if (!sectionEl || !containerEl) return;

  if (!recommendedGroups.length) {
    sectionEl.style.display = 'none';
    containerEl.innerHTML = '';
    return;
  }

  sectionEl.style.display = 'block';

  containerEl.innerHTML = recommendedGroups.map((group, index) => {
    const isJoined = userGroups.includes(group.name);
    const joinedClass = isJoined ? 'joined' : '';
    const statusClass = group.status === 'active' ? 'active' : 'inactive';
    const safeName = escapeHtml(group.name);
    const encodedGroupName = encodeURIComponent(group.name || '');
    const score = Number.isFinite(group.score) ? Math.round(group.score * 100) : 0;

    return `
      <div class="group-card recommended ${joinedClass}">
        <div class="group-card-header">
          <h3>${safeName}</h3>
          <span class="group-status ${statusClass}">${escapeHtml(group.status || 'active')}</span>
        </div>

        <div class="recommended-badges">
          <span class="recommended-badge ai">AI Match</span>
          <span class="recommended-badge score">Score ${score}%</span>
        </div>

        <div class="recommended-reason">${escapeHtml(group.explanation || 'Matched based on your profile and study patterns.')}</div>

        <div class="recommendation-actions">
          <button type="button" class="why-recommended-btn" onclick="openRecommendationModal(${index})">
            Why this recommendation?
          </button>
        </div>

        <p>${escapeHtml(group.description || 'This group aligns with your learning preferences.')}</p>

        <div class="group-meta">
          <div class="meta-item">
            <span>📁</span>
            <span>${escapeHtml(group.category || 'General')}</span>
          </div>
          <div class="meta-item">
            <span>👥</span>
            <span>${group.memberCount || 0} members</span>
          </div>
        </div>

        <div class="group-card-footer">
          <span class="member-count">${formatDate(group.createdAt)}</span>
          <button
            class="join-btn ${joinedClass}"
            onclick="handleJoinGroup(decodeURIComponent('${encodedGroupName}'))"
            ${isJoined ? 'disabled' : ''}
          >
            ${isJoined ? '✓ Joined' : 'Join Group'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openRecommendationModal(index) {
  const recommendation = recommendedGroups[index];
  if (!recommendation) return;

  const modal = document.getElementById('recommendationModal');
  const body = document.getElementById('recommendationModalBody');
  const title = document.getElementById('recommendationModalTitle');
  if (!modal || !body || !title) return;

  const score = Number.isFinite(recommendation.score) ? Math.round(recommendation.score * 100) : 0;
  title.textContent = `Why ${recommendation.name} is recommended`;

  body.innerHTML = `
    <div class="rec-detail-grid">
      <div class="rec-detail-item">
        <div class="rec-detail-label">Match Score</div>
        <div class="rec-detail-value">${score}%</div>
      </div>
      <div class="rec-detail-item">
        <div class="rec-detail-label">Category</div>
        <div class="rec-detail-value">${escapeHtml(recommendation.category || 'General')}</div>
      </div>
      <div class="rec-detail-item">
        <div class="rec-detail-label">Community Size</div>
        <div class="rec-detail-value">${recommendation.memberCount || 0} members</div>
      </div>
    </div>
    <div class="rec-detail-text">${escapeHtml(recommendation.explanation || 'This group aligns with your interests and activity patterns.')}</div>
    ${recommendation.tags && recommendation.tags.length ? `
      <div class="group-tags" style="margin-top: 12px;">
        ${recommendation.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    ` : ''}
  `;

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function closeRecommendationModal() {
  const modal = document.getElementById('recommendationModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

function updateGroupsRefreshMeta(fallbackMessage) {
  const timeEl = document.getElementById('groupsRefreshTime');
  if (!timeEl) return;

  if (lastGroupsRefreshAt) {
    const now = Date.now();
    const diffSeconds = Math.max(0, Math.floor((now - lastGroupsRefreshAt.getTime()) / 1000));

    if (diffSeconds < 5) {
      timeEl.textContent = 'Updated just now';
    } else {
      timeEl.textContent = `Updated ${diffSeconds}s ago`;
    }
    return;
  }

  timeEl.textContent = fallbackMessage || 'Auto-refresh every 30s';
}

function setGroupsRefreshState(state) {
  const dotEl = document.getElementById('groupsRefreshDot');
  if (!dotEl) return;

  dotEl.classList.remove('loading', 'error');

  if (state === 'loading') {
    dotEl.classList.add('loading');
    updateGroupsRefreshMeta('Refreshing groups...');
    return;
  }

  if (state === 'error') {
    dotEl.classList.add('error');
    updateGroupsRefreshMeta('Refresh failed. Retrying...');
    return;
  }

  updateGroupsRefreshMeta();
}

// Render groups to the page
function renderGroups(groups) {
  const container = document.getElementById('groupsContainer');
  const emptyState = document.getElementById('emptyState');

  if (groups.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  
  container.innerHTML = groups.map(group => {
    const isJoined = userGroups.includes(group.name);
    const joinedClass = isJoined ? 'joined' : '';
    const statusClass = group.status === 'active' ? 'active' : 'inactive';
    const encodedGroupName = encodeURIComponent(group.name || '');
    
    return `
      <div class="group-card ${joinedClass}">
        <div class="group-card-header">
          <h3>${escapeHtml(group.name)}</h3>
          <span class="group-status ${statusClass}">${group.status || 'active'}</span>
        </div>
        
        <p>${escapeHtml(group.description || 'No description available')}</p>
        
        <div class="group-meta">
          <div class="meta-item">
            <span>📁</span>
            <span>${escapeHtml(group.category || 'General')}</span>
          </div>
          <div class="meta-item">
            <span>👥</span>
            <span>${group.memberCount || 0} members</span>
          </div>
        </div>
        
        ${group.tags && group.tags.length > 0 ? `
          <div class="group-tags">
            ${group.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="group-card-footer">
          <span class="member-count">
            ${formatDate(group.createdAt)}
          </span>
          <button 
            class="join-btn ${joinedClass}" 
            data-group="${escapeHtml(group.name)}"
            onclick="handleJoinGroup(decodeURIComponent('${encodedGroupName}'))"
            ${isJoined ? 'disabled' : ''}
          >
            ${isJoined ? '✓ Joined' : 'Join Group'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Handle search
function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase().trim();
  
  filteredGroups = allGroups.filter(group => {
    const matchesSearch = 
      group.name.toLowerCase().includes(searchTerm) ||
      (group.description || '').toLowerCase().includes(searchTerm) ||
      (group.category || '').toLowerCase().includes(searchTerm) ||
      (group.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
    
    return matchesSearch && matchesFilter(group);
  });
  
  renderGroups(filteredGroups);
}

// Handle filter change
function handleFilterChange(btn) {
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  currentFilter = btn.dataset.filter;
  applyFilter();
}

// Apply current filter
function applyFilter() {
  const searchTerm = document.getElementById('searchBar').value.toLowerCase().trim();
  
  filteredGroups = allGroups.filter(group => {
    const matchesSearch = 
      !searchTerm ||
      group.name.toLowerCase().includes(searchTerm) ||
      (group.description || '').toLowerCase().includes(searchTerm) ||
      (group.category || '').toLowerCase().includes(searchTerm) ||
      (group.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
    
    return matchesSearch && matchesFilter(group);
  });
  
  renderGroups(filteredGroups);
}

// Check if group matches current filter
function matchesFilter(group) {
  switch(currentFilter) {
    case 'all':
      return true;
    case 'active':
      return group.status === 'active';
    case 'my-groups':
      return userGroups.includes(group.name);
    default:
      return true;
  }
}

// Handle joining a group
async function handleJoinGroup(groupName) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    alert('Please login to join a group');
    window.location.href = '../landing/login.html';
    return;
  }

  try {
    // First, save the group to the user's account
    const response = await fetch(`${API_URL}/api/save-current-group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ groupName })
    });

    const data = await response.json();

    if (response.ok) {
      // Add to user groups
      userGroups.push(groupName);
      
      // Show success message
      showNotification(`Successfully joined ${groupName}!`, 'success');
      
      // Re-render groups to update UI
      renderGroups(filteredGroups);
      renderRecommendedGroups();
      
      // Redirect to groups page after a short delay
      setTimeout(() => {
        window.location.href = '../Dashboards/groups.html';
      }, 1500);
    } else {
      showNotification(data.error || 'Failed to join group', 'error');
    }
  } catch (error) {
    console.error('Error joining group:', error);
    showNotification('Failed to join group. Please try again.', 'error');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Check if the global showNotification function exists from notifications.js
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
  } else {
    // Fallback to alert
    alert(message);
  }
}

// Show error in the groups container
function showError(message) {
  const container = document.getElementById('groupsContainer');
  container.innerHTML = `
    <div class="loading" style="color: #ff4b2b;">
      ❌ ${escapeHtml(message)}
    </div>
  `;
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility: Format date
function formatDate(dateString) {
  if (!dateString) return 'Recently';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

