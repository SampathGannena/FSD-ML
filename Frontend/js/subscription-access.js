(function () {
  function getTokenIssuedAt(token) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length < 2) return 0;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return Number(payload.iat || 0);
    } catch (_) {
      return 0;
    }
  }

  function getActiveAuthRole() {
    return localStorage.getItem('activeAuthRole') || '';
  }

  function getAuthToken() {
    const role = getActiveAuthRole();
    const userToken = localStorage.getItem('token') || '';
    const mentorToken = localStorage.getItem('mentorToken') || '';

    if (role === 'mentor' && mentorToken) {
      return mentorToken;
    }

    if ((role === 'user' || role === 'learner') && userToken) {
      return userToken;
    }

    if (userToken && !mentorToken) {
      return userToken;
    }

    if (mentorToken && !userToken) {
      return mentorToken;
    }

    if (userToken && mentorToken) {
      const userIssuedAt = getTokenIssuedAt(userToken);
      const mentorIssuedAt = getTokenIssuedAt(mentorToken);
      return mentorIssuedAt > userIssuedAt ? mentorToken : userToken;
    }

    // Backward-compatible fallback when role is not set.
    return userToken || mentorToken || '';
  }

  function planDisplayName(plan) {
    if (plan === 'enterprise') return 'Enterprise';
    if (plan === 'premium') return 'Premium';
    return 'Starter';
  }

  function notifyError(message, title) {
    if (typeof Toast !== 'undefined' && typeof Toast.error === 'function') {
      Toast.error(message, title || 'Feature Locked');
      return;
    }
    alert(message);
  }

  async function checkFeatureAccess(featureKey, token) {
    const authToken = token || getAuthToken();
    if (!authToken) {
      return {
        success: false,
        allowed: false,
        reason: 'AUTH_REQUIRED',
        error: 'Please sign in to continue.'
      };
    }

    const response = await fetch(`${window.location.origin}/api/subscription/feature-access/${encodeURIComponent(featureKey)}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        allowed: false,
        reason: response.status === 401 ? 'AUTH_REQUIRED' : 'REQUEST_FAILED',
        error: text || `Request failed with status ${response.status}`
      };
    }

    return response.json();
  }

  async function ensureFeatureAccess(featureKey, options) {
    const config = options || {};
    const featureName = config.featureName || featureKey.replace(/_/g, ' ');
    const redirectTo = config.redirectTo || '';
    const token = config.token || getAuthToken();

    const result = await checkFeatureAccess(featureKey, token);

    if (result.success && result.allowed) {
      return result;
    }

    if (result.reason === 'AUTH_REQUIRED') {
      notifyError('Please sign in to use this feature.', 'Authentication Required');
      if (redirectTo) {
        window.location.href = redirectTo;
      }
      return result;
    }

    const currentPlan = result.subscription?.plan || 'starter';
    const currentPlanLabel = planDisplayName(currentPlan);
    notifyError(`${featureName} requires an upgraded plan. Current plan: ${currentPlanLabel}.`, 'Upgrade Required');

    if (redirectTo) {
      window.location.href = redirectTo;
    }

    return result;
  }

  window.SubscriptionAccess = {
    getActiveAuthRole,
    getAuthToken,
    checkFeatureAccess,
    ensureFeatureAccess
  };
})();
