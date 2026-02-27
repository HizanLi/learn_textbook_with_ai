/**
 * Notification utilities for the application
 */

// Track which notifications have been shown to prevent duplicates
const shownNotifications = new Set();

/**
 * Show a one-time notification for Python server unavailable
 * Uses browser Notification API or fallback alert
 */
export async function notifyPythonServerUnavailable() {
  const notificationKey = "python_unavailable";
  
  // Only show once per session
  if (shownNotifications.has(notificationKey)) {
    return;
  }
  
  shownNotifications.add(notificationKey);

  const title = "Python API Server Unavailable";
  const message = "Please start the Python API server with: python src/core/main.py";

  try {
    // Try to use browser Notification API if available
    if ("Notification" in window) {
      // Request permission if needed
      if (Notification.permission === "granted") {
        new Notification(title, {
          body: message,
          icon: "/src/assets/error-icon.svg", // optional
          badge: "/src/assets/badge.svg", // optional
        });
      } else if (Notification.permission !== "denied") {
        // Request permission and show notification
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, {
            body: message,
          });
        } else {
          // Fallback to alert if permission denied
          showFallbackNotification(title, message);
        }
      } else {
        // Permission was previously denied, use fallback
        showFallbackNotification(title, message);
      }
    } else {
      // Browser doesn't support Notification API, use fallback
      showFallbackNotification(title, message);
    }
  } catch (err) {
    console.error("Notification error:", err);
    showFallbackNotification(title, message);
  }
}

/**
 * Fallback notification using CSS toast or alert
 */
export function showFallbackNotification(title, message) {
  // Check if toast already exists
  if (document.getElementById("notification-toast")) {
    return;
  }

  const toast = document.createElement("div");
  toast.id = "notification-toast";
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      max-width: 400px;
      font-family: system-ui, -apple-system, sans-serif;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
      <div style="font-size: 14px; opacity: 0.9;">${message}</div>
    </div>
    <style>
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    </style>
  `;

  document.body.appendChild(toast);

  // Auto-remove after 6 seconds
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.style.animation = "slideOut 0.3s ease-out";
      setTimeout(() => {
        toast.parentNode?.removeChild(toast);
      }, 300);
    }
  }, 6000);
}

/**
 * Clear the notification tracking (for testing/debugging)
 */
export function clearNotificationHistory() {
  shownNotifications.clear();
}
