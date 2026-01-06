// Mentor Authentication Guard
// This script checks if the user is authenticated as a mentor
// before allowing access to mentor-protected pages

(function() {
  'use strict';
  
  // List of pages that require mentor authentication
  const protectedPages = [
    'mentorMain.html',
    'mentorgrops.html',
    'Mprofile.html',
    'mentorAdvancedDashboard.html',
    'mentorGroupsDashboard.html',
    'mentorSessionRequests.html'
  ];
  
  // Get current page name
  const currentPage = window.location.pathname.split('/').pop();
  
  // Check if current page needs protection
  const needsProtection = protectedPages.some(page => 
    currentPage.toLowerCase() === page.toLowerCase()
  );
  
  if (needsProtection) {
    const mentorToken = localStorage.getItem('mentorToken');
    
    console.log('🔐 Mentor Auth Guard:', {
      currentPage: currentPage,
      needsProtection: needsProtection,
      hasToken: !!mentorToken,
      tokenPreview: mentorToken ? mentorToken.substring(0, 20) + '...' : 'none'
    });
    
    if (!mentorToken) {
      // No mentor token found, redirect to signin
      console.warn('⚠️ No mentor authentication token found. Redirecting to login...');
      window.location.href = '../mentor/signin.html';
      return;
    }
    
    // Verify token is still valid
    verifyMentorToken(mentorToken);
  } else {
    console.log('ℹ️ Page does not require mentor protection:', currentPage);
  }
  
  async function verifyMentorToken(token) {
    try {
      console.log('🔍 Verifying mentor token...');
      
      const response = await fetch(`${window.location.origin}/api/mentor/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Token verification response:', response.status, response.ok);
      
      if (!response.ok) {
        // Token is invalid or expired
        const errorData = await response.json().catch(() => ({}));
        console.warn('❌ Mentor token is invalid or expired:', errorData);
        console.warn('Clearing token and redirecting to login...');
        localStorage.removeItem('mentorToken');
        localStorage.removeItem('mentorId');
        localStorage.removeItem('mentorName');
        localStorage.removeItem('mentorEmail');
        localStorage.removeItem('mentorDomain');
        window.location.href = '../mentor/signin.html';
        return;
      }
      
      // Token is valid - user can proceed
      const data = await response.json();
      console.log('✅ Mentor authenticated:', data.profile?.fullname || 'Unknown');
      
      // Store mentor info for easy access
      window.currentMentor = data.profile;
      
    } catch (error) {
      console.error('⚠️ Error verifying mentor token:', error);
      // On network error, allow access but show warning
      console.warn('Could not verify token due to network error. Proceeding with caution...');
    }
  }
  
  // Utility function to get current mentor info
  window.getMentorInfo = function() {
    return window.currentMentor || null;
  };
  
  // Utility function to logout mentor
  window.mentorLogout = function() {
    localStorage.removeItem('mentorToken');
    window.location.href = '../mentor/signin.html';
  };
  
})();
