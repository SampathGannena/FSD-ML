/**
 * Global Notification System for FSD-ML Application
 * Modern glass-morphism toast notifications matching app theme
 */

(function() {
    'use strict';

    // Notification container
    let notificationContainer = null;

    // Initialize notification container
    function initContainer() {
        if (notificationContainer) return;
        
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 380px;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }

    // Inject styles
    function injectStyles() {
        if (document.getElementById('notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .toast-notification {
                pointer-events: auto;
                background: rgba(26, 26, 46, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 107, 0, 0.2);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 
                            0 0 0 1px rgba(255, 255, 255, 0.05),
                            inset 0 1px 0 rgba(255, 255, 255, 0.1);
                overflow: hidden;
                animation: toastSlideIn 0.4s ease-out;
                transform-origin: top right;
            }

            .toast-notification.removing {
                animation: toastSlideOut 0.3s ease-in forwards;
            }

            @keyframes toastSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(100px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
            }

            @keyframes toastSlideOut {
                from {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateX(100px) scale(0.95);
                }
            }

            .toast-progress {
                height: 3px;
                background: rgba(255, 255, 255, 0.1);
                position: relative;
                overflow: hidden;
            }

            .toast-progress-bar {
                height: 100%;
                width: 100%;
                transform-origin: left;
                animation: progressShrink linear forwards;
            }

            @keyframes progressShrink {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }

            .toast-content {
                display: flex;
                align-items: center;
                padding: 14px 16px;
                gap: 12px;
            }

            .toast-icon {
                width: 38px;
                height: 38px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                flex-shrink: 0;
            }

            .toast-body {
                flex: 1;
                min-width: 0;
            }

            .toast-title {
                font-size: 14px;
                font-weight: 600;
                margin: 0 0 2px 0;
                color: #fff;
            }

            .toast-message {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                margin: 0;
                line-height: 1.4;
                word-wrap: break-word;
            }

            .toast-close {
                background: rgba(255, 255, 255, 0.08);
                border: none;
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                padding: 6px;
                border-radius: 6px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .toast-close:hover {
                background: rgba(255, 107, 0, 0.2);
                color: #ff6b00;
            }

            .toast-close svg {
                width: 14px;
                height: 14px;
            }

            /* Success Theme - Green with glass */
            .toast-notification.success {
                border-left: 3px solid #10b981;
                background: rgba(16, 185, 129, 0.1);
            }
            .toast-notification.success .toast-icon {
                background: rgba(16, 185, 129, 0.2);
                color: #10b981;
            }
            .toast-notification.success .toast-progress-bar {
                background: linear-gradient(90deg, #10b981, #34d399);
            }
            .toast-notification.success .toast-title {
                color: #10b981;
            }

            /* Error Theme - Red with glass */
            .toast-notification.error {
                border-left: 3px solid #ef4444;
                background: rgba(239, 68, 68, 0.1);
            }
            .toast-notification.error .toast-icon {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }
            .toast-notification.error .toast-progress-bar {
                background: linear-gradient(90deg, #ef4444, #f87171);
            }
            .toast-notification.error .toast-title {
                color: #ef4444;
            }

            /* Warning Theme - Orange (app accent) with glass */
            .toast-notification.warning {
                border-left: 3px solid #ff6b00;
                background: rgba(255, 107, 0, 0.1);
            }
            .toast-notification.warning .toast-icon {
                background: rgba(255, 107, 0, 0.2);
                color: #ff6b00;
            }
            .toast-notification.warning .toast-progress-bar {
                background: linear-gradient(90deg, #ff6b00, #ff8c42);
            }
            .toast-notification.warning .toast-title {
                color: #ff6b00;
            }

            /* Info Theme - Blue with glass */
            .toast-notification.info {
                border-left: 3px solid #3b82f6;
                background: rgba(59, 130, 246, 0.1);
            }
            .toast-notification.info .toast-icon {
                background: rgba(59, 130, 246, 0.2);
                color: #3b82f6;
            }
            .toast-notification.info .toast-progress-bar {
                background: linear-gradient(90deg, #3b82f6, #60a5fa);
            }
            .toast-notification.info .toast-title {
                color: #3b82f6;
            }

            /* Loading Theme - Purple with glass */
            .toast-notification.loading {
                border-left: 3px solid #8b5cf6;
                background: rgba(139, 92, 246, 0.1);
            }
            .toast-notification.loading .toast-icon {
                background: rgba(139, 92, 246, 0.2);
                color: #8b5cf6;
            }
            .toast-notification.loading .toast-progress-bar {
                background: linear-gradient(90deg, #8b5cf6, #a78bfa);
            }
            .toast-notification.loading .toast-title {
                color: #8b5cf6;
            }

            .toast-spinner {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Subtle shake for errors */
            .toast-notification.shake {
                animation: toastSlideIn 0.4s ease-out, shake 0.4s ease-in-out 0.4s;
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }

            /* Mobile responsiveness */
            @media (max-width: 480px) {
                #notification-container {
                    left: 12px;
                    right: 12px;
                    top: 80px;
                    max-width: none;
                }

                .toast-content {
                    padding: 12px 14px;
                    gap: 10px;
                }

                .toast-icon {
                    width: 32px;
                    height: 32px;
                    font-size: 16px;
                }

                .toast-title {
                    font-size: 13px;
                }

                .toast-message {
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Icon definitions
    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
        loading: `<svg class="toast-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`
    };

    const closeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    // Default titles
    const defaultTitles = {
        success: 'Success!',
        error: 'Error!',
        warning: 'Warning!',
        info: 'Info',
        loading: 'Loading...'
    };

    /**
     * Show a toast notification
     * @param {Object} options - Notification options
     * @param {string} options.type - Type: 'success', 'error', 'warning', 'info', 'loading'
     * @param {string} options.title - Title text (optional)
     * @param {string} options.message - Message text
     * @param {number} options.duration - Duration in ms (default: 5000, 0 for no auto-close)
     * @param {boolean} options.closable - Show close button (default: true)
     * @returns {HTMLElement} The notification element
     */
    function showToast(options) {
        const {
            type = 'info',
            title = defaultTitles[type] || 'Notification',
            message = '',
            duration = 5000,
            closable = true
        } = options;

        initContainer();
        injectStyles();

        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}${type === 'error' ? ' shake' : ''}`;

        toast.innerHTML = `
            ${duration > 0 ? `
                <div class="toast-progress">
                    <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
                </div>
            ` : ''}
            <div class="toast-content">
                <div class="toast-icon">
                    ${icons[type] || icons.info}
                </div>
                <div class="toast-body">
                    <h4 class="toast-title">${title}</h4>
                    <p class="toast-message">${message}</p>
                </div>
                ${closable ? `
                    <button class="toast-close" aria-label="Close notification">
                        ${closeIcon}
                    </button>
                ` : ''}
            </div>
        `;

        // Add to container
        notificationContainer.appendChild(toast);

        // Close button handler
        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => removeToast(toast));
        }

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => removeToast(toast), duration);
        }

        return toast;
    }

    /**
     * Remove a toast notification with animation
     * @param {HTMLElement} toast - The toast element to remove
     */
    function removeToast(toast) {
        if (!toast || toast.classList.contains('removing')) return;
        
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 400);
    }

    /**
     * Remove all toast notifications
     */
    function clearAll() {
        if (!notificationContainer) return;
        const toasts = notificationContainer.querySelectorAll('.toast-notification');
        toasts.forEach(toast => removeToast(toast));
    }

    // Convenience methods
    const showSuccess = (message, title) => showToast({ type: 'success', message, title });
    const showError = (message, title) => showToast({ type: 'error', message, title });
    const showWarning = (message, title) => showToast({ type: 'warning', message, title });
    const showInfo = (message, title) => showToast({ type: 'info', message, title });
    const showLoading = (message, title) => showToast({ type: 'loading', message, title, duration: 0, closable: false });

    // Override native alert to use toast
    window.originalAlert = window.alert;
    
    window.alert = function(message) {
        if (!message) return;
        
        const msgLower = message.toLowerCase();
        let type = 'info';
        let title = '';
        
        // Auto-detect type from message content
        if (msgLower.includes('success') || msgLower.includes('successfully') || msgLower.includes('created') || msgLower.includes('saved') || msgLower.includes('updated') || msgLower.includes('signed in') || msgLower.includes('logged in') || msgLower.includes('welcome')) {
            type = 'success';
            title = 'Success!';
        } else if (msgLower.includes('error') || msgLower.includes('failed') || msgLower.includes('invalid') || msgLower.includes('wrong') || msgLower.includes('incorrect') || msgLower.includes('denied') || msgLower.includes('not found') || msgLower.includes('cannot')) {
            type = 'error';
            title = 'Error!';
        } else if (msgLower.includes('warning') || msgLower.includes('caution') || msgLower.includes('careful') || msgLower.includes('⚠️') || msgLower.includes('ended') || msgLower.includes('cancelled')) {
            type = 'warning';
            title = 'Warning!';
        } else if (msgLower.includes('please') || msgLower.includes('note') || msgLower.includes('info') || msgLower.includes('⏰') || msgLower.includes('tip') || msgLower.includes('scheduled') || msgLower.includes('upcoming')) {
            type = 'info';
            title = 'Information';
        }
        
        // Clean up emojis from message for cleaner look (keep them though)
        showToast({ type, message, title });
    };

    // Override native confirm to use styled version
    window.originalConfirm = window.confirm;
    
    window.confirm = function(message) {
        return new Promise((resolve) => {
            initContainer();
            injectStyles();
            
            // Add confirm-specific styles if not exists
            if (!document.getElementById('confirm-styles')) {
                const confirmStyles = document.createElement('style');
                confirmStyles.id = 'confirm-styles';
                confirmStyles.textContent = `
                    .confirm-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.6);
                        backdrop-filter: blur(8px);
                        -webkit-backdrop-filter: blur(8px);
                        z-index: 99998;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        animation: fadeIn 0.25s ease;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    .confirm-dialog {
                        background: rgba(26, 26, 46, 0.9);
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                        border-radius: 16px;
                        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4),
                                    0 0 0 1px rgba(255, 107, 0, 0.2),
                                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                        max-width: 360px;
                        width: 90%;
                        overflow: hidden;
                        animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    }

                    @keyframes scaleIn {
                        from { 
                            opacity: 0;
                            transform: scale(0.9) translateY(-20px);
                        }
                        to { 
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }

                    .confirm-header {
                        padding: 24px 24px 0;
                        text-align: center;
                    }

                    .confirm-icon {
                        width: 50px;
                        height: 50px;
                        border-radius: 12px;
                        background: rgba(255, 107, 0, 0.15);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 12px;
                        border: 1px solid rgba(255, 107, 0, 0.3);
                    }

                    .confirm-icon svg {
                        width: 24px;
                        height: 24px;
                        color: #ff6b00;
                    }

                    .confirm-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: #fff;
                        margin: 0;
                    }

                    .confirm-body {
                        padding: 16px 24px;
                        text-align: center;
                    }

                    .confirm-message {
                        font-size: 13px;
                        color: rgba(255, 255, 255, 0.7);
                        line-height: 1.5;
                        margin: 0;
                    }

                    .confirm-actions {
                        display: flex;
                        gap: 10px;
                        padding: 16px 24px 24px;
                        justify-content: center;
                    }

                    .confirm-btn {
                        padding: 10px 24px;
                        border-radius: 8px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        border: none;
                    }

                    .confirm-btn-cancel {
                        background: rgba(255, 255, 255, 0.08);
                        color: rgba(255, 255, 255, 0.7);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }

                    .confirm-btn-cancel:hover {
                        background: rgba(255, 255, 255, 0.12);
                        color: #fff;
                    }

                    .confirm-btn-confirm {
                        background: linear-gradient(135deg, #ff6b00, #ff4b2b);
                        color: white;
                        box-shadow: 0 4px 15px rgba(255, 107, 0, 0.3);
                    }

                    .confirm-btn-confirm:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 6px 20px rgba(255, 107, 0, 0.4);
                    }
                `;
                document.head.appendChild(confirmStyles);
            }

            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-header">
                        <div class="confirm-icon">
                            ${icons.warning}
                        </div>
                        <h3 class="confirm-title">Confirm Action</h3>
                    </div>
                    <div class="confirm-body">
                        <p class="confirm-message">${message}</p>
                    </div>
                    <div class="confirm-actions">
                        <button class="confirm-btn confirm-btn-cancel">Cancel</button>
                        <button class="confirm-btn confirm-btn-confirm">Confirm</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const cancelBtn = overlay.querySelector('.confirm-btn-cancel');
            const confirmBtn = overlay.querySelector('.confirm-btn-confirm');

            const cleanup = (result) => {
                overlay.style.animation = 'fadeIn 0.2s ease reverse';
                setTimeout(() => overlay.remove(), 200);
                resolve(result);
            };

            cancelBtn.addEventListener('click', () => cleanup(false));
            confirmBtn.addEventListener('click', () => cleanup(true));
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });

            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEscape);
                    cleanup(false);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    };

    // Export to global scope
    window.Toast = {
        show: showToast,
        success: showSuccess,
        error: showError,
        warning: showWarning,
        info: showInfo,
        loading: showLoading,
        remove: removeToast,
        clearAll: clearAll
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles();
        });
    } else {
        injectStyles();
    }

})();
