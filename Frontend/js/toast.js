// Toast Notification System
const Toast = {
  success: function(message, title = 'Success') {
    this.show(message, title, 'success');
  },
  
  error: function(message, title = 'Error') {
    this.show(message, title, 'error');
  },
  
  info: function(message, title = 'Info') {
    this.show(message, title, 'info');
  },
  
  warning: function(message, title = 'Warning') {
    this.show(message, title, 'warning');
  },
  
  show: function(message, title, type) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Get icon based on type
    let icon;
    switch(type) {
      case 'success':
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-exclamation-circle"></i>';
        break;
      case 'warning':
        icon = '<i class="fas fa-exclamation-triangle"></i>';
        break;
      case 'info':
        icon = '<i class="fas fa-info-circle"></i>';
        break;
      default:
        icon = '<i class="fas fa-bell"></i>';
    }
    
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Get background color based on type
    let backgroundColor;
    switch(type) {
      case 'success':
        backgroundColor = 'linear-gradient(135deg, #2ecc71, #27ae60)';
        break;
      case 'error':
        backgroundColor = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        break;
      case 'warning':
        backgroundColor = 'linear-gradient(135deg, #f39c12, #e67e22)';
        break;
      case 'info':
        backgroundColor = 'linear-gradient(135deg, #3498db, #2980b9)';
        break;
      default:
        backgroundColor = 'linear-gradient(135deg, #95a5a6, #7f8c8d)';
    }
    
    // Add toast styles
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${backgroundColor};
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 350px;
      min-width: 250px;
      animation: slideInToast 0.3s ease, fadeOut 0.3s ease 2.7s;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 3000);
    
    // Add click to dismiss
    toast.addEventListener('click', function(e) {
      if (e.target.classList.contains('toast-close')) {
        toast.remove();
      }
    });
  }
};

// Add CSS animations if not already present
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideInToast {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
    
    .toast-icon {
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .toast-content {
      flex: 1;
    }
    
    .toast-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    
    .toast-message {
      font-size: 13px;
      opacity: 0.9;
      line-height: 1.4;
    }
    
    .toast-close {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .toast-close:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

// Make Toast globally available
if (typeof window !== 'undefined') {
  window.Toast = Toast;
}
