// Global variables
let allGroups = [];
let filteredGroups = [];
let currentFilter = 'all';
let userGroups = [];

// Get API URL
const API_URL = window.location.origin;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadGroups();
  setupEventListeners();
  await loadUserGroups();
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
}

// Load all groups from the API
async function loadGroups() {
  const container = document.getElementById('groupsContainer');
  
  try {
    const response = await fetch(`${API_URL}/api/groups/all`);
    const data = await response.json();

    if (data.success && data.groups) {
      allGroups = data.groups;
      filteredGroups = allGroups;
      renderGroups(filteredGroups);
    } else {
      showError('Failed to load groups');
    }
  } catch (error) {
    console.error('Error loading groups:', error);
    showError('Failed to load groups. Please try again.');
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
      // Re-render to show joined status
      renderGroups(filteredGroups);
    }
  } catch (error) {
    console.error('Error loading user groups:', error);
  }
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
            onclick="handleJoinGroup('${escapeHtml(group.name)}')"
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

