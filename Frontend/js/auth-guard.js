// Authentication guard to protect pages
function addCachePreventionHeaders() {
  // Prevent caching of authenticated pages
  const meta1 = document.createElement('meta');
  meta1.httpEquiv = 'Cache-Control';
  meta1.content = 'no-cache, no-store, must-revalidate';
  document.head.appendChild(meta1);
  
  const meta2 = document.createElement('meta');
  meta2.httpEquiv = 'Pragma';
  meta2.content = 'no-cache';
  document.head.appendChild(meta2);
  
  const meta3 = document.createElement('meta');
  meta3.httpEquiv = 'Expires';
  meta3.content = '0';
  document.head.appendChild(meta3);
}

async function checkAuthentication() {
  const token = localStorage.getItem('token');
  
  // If no token, redirect to login
  if (!token) {
    redirectToLogin();
    return false;
  }
  
  try {
    // Verify token with backend
    const response = await fetch(`${window.location.origin}/api/profile`, {
      headers: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Token validation failed');
    }
    
    return true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    // Clear invalid token
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    redirectToLogin();
    return false;
  }
}

function redirectToLogin() {
  // Clear any stored data
  localStorage.clear();
  sessionStorage.clear();
  
  // Redirect to login page
  window.location.href = '../credentials/signin.html';
}

// Handle browser back button
window.addEventListener('pageshow', function(event) {
  // If page is loaded from cache (back button), check authentication
  if (event.persisted) {
    checkAuthentication();
  }
});

// Prevent back button after logout by detecting storage changes
window.addEventListener('storage', function(e) {
  // If token is removed from another tab/window, redirect this page too
  if (e.key === 'token' && e.newValue === null) {
    redirectToLogin();
  }
});

// Initialize protection when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  addCachePreventionHeaders();
  checkAuthentication();
});
