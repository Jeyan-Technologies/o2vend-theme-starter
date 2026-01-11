/**
 * Checkout Price Handler
 * Handles price change detection, polling, and user notifications on the checkout page
 */

(function() {
  'use strict';

  // Configuration
  const POLL_INTERVAL = 45000; // Poll every 45 seconds
  const PRICE_CHANGE_THRESHOLD = 0.01; // 1 cent threshold for price changes
  const MAX_POLL_ATTEMPTS = 20; // Stop polling after 20 attempts (15 minutes)

  let pollInterval = null;
  let pollAttempts = 0;
  let lastCheckoutData = null;
  let priceChangeAcknowledged = false;

  /**
   * Get checkout token from various sources
   */
  function getCheckoutToken() {
    // Try from global variable first
    if (typeof CHECKOUT_TOKEN !== 'undefined' && CHECKOUT_TOKEN) {
      return CHECKOUT_TOKEN;
    }

    // Try from URL
    const urlMatch = window.location.pathname.match(/\/checkout\/([^\/]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Try from cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'checkout_token' || name === 'checkoutToken') {
        return decodeURIComponent(value);
      }
    }

    return null;
  }

  /**
   * Fetch latest checkout data
   */
  async function fetchCheckout() {
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      console.warn('[PRICE HANDLER] No checkout token found');
      return null;
    }

    try {
      const response = await fetch(`/webstoreapi/checkout`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success ? data.data : data;
    } catch (error) {
      console.error('[PRICE HANDLER] Error fetching checkout:', error);
      return null;
    }
  }

  /**
   * Show price change notification
   */
  function showPriceChangeNotification(checkoutData) {
    const banner = document.getElementById('price-change-banner');
    if (!banner) {
      return;
    }

    // Update banner content if needed
    const metadata = checkoutData.priceChangeMetadata || {};
    if (metadata.detected) {
      banner.style.display = 'block';
      
      // Add appropriate class based on change type
      banner.classList.remove('price-decrease', 'price-critical');
      if (metadata.totalChange < 0) {
        banner.classList.add('price-decrease');
      } else if (metadata.hasCriticalIssues) {
        banner.classList.add('price-critical');
      }
    }
  }

  /**
   * Update price change details display
   */
  function updatePriceChangeDetails(checkoutData) {
    const detailsContainer = document.getElementById('price-change-details');
    if (!detailsContainer) {
      return;
    }

    const metadata = checkoutData.priceChangeMetadata || {};
    if (!metadata.detected || metadata.itemsChanged === 0) {
      detailsContainer.style.display = 'none';
      return;
    }

    detailsContainer.style.display = 'block';
    
    // Update line items if needed
    const itemsList = detailsContainer.querySelector('.price-change-items-list');
    if (itemsList && checkoutData.lineItems) {
      // Items are already rendered server-side, just ensure visibility
      checkoutData.lineItems.forEach((item, index) => {
        const itemElement = itemsList.querySelector(`[data-item-id="${item.id || item.variantId || index}"]`);
        if (itemElement) {
          itemElement.style.display = 'flex';
        }
      });
    }
  }

  /**
   * Refresh checkout prices
   */
  async function refreshCheckoutPrices() {
    const refreshBtn = document.getElementById('refresh-checkout-prices');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
    }

    try {
      const checkoutData = await fetchCheckout();
      if (checkoutData) {
        // Reload page to show updated prices
        window.location.reload();
      } else {
        alert('Unable to refresh prices. Please try again.');
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.textContent = 'Refresh Prices';
        }
      }
    } catch (error) {
      console.error('[PRICE HANDLER] Error refreshing prices:', error);
      alert('Error refreshing prices. Please refresh the page.');
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Prices';
      }
    }
  }

  /**
   * Dismiss price change banner
   */
  function dismissPriceChangeBanner() {
    const banner = document.getElementById('price-change-banner');
    if (banner) {
      banner.style.display = 'none';
      // Store dismissal in sessionStorage
      sessionStorage.setItem('priceChangeBannerDismissed', 'true');
    }
  }

  /**
   * Check for price changes
   */
  async function checkForPriceChanges() {
    pollAttempts++;

    // Stop polling after max attempts
    if (pollAttempts > MAX_POLL_ATTEMPTS) {
      stopPolling();
      return;
    }

    const checkoutData = await fetchCheckout();
    if (!checkoutData) {
      return;
    }

    const metadata = checkoutData.priceChangeMetadata || {};
    
    // Check if prices changed
    if (metadata.detected) {
      // Compare with last known data
      if (lastCheckoutData) {
        const lastMetadata = lastCheckoutData.priceChangeMetadata || {};
        if (lastMetadata.detected !== metadata.detected || 
            lastMetadata.itemsChanged !== metadata.itemsChanged) {
          // Prices changed, show notification
          showPriceChangeNotification(checkoutData);
          updatePriceChangeDetails(checkoutData);
          
          // Show browser notification if supported
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Prices Updated', {
              body: 'Some prices in your checkout have changed. Please review your order.',
              icon: '/favicon.ico'
            });
          }
        }
      } else {
        // First check, just update display
        showPriceChangeNotification(checkoutData);
        updatePriceChangeDetails(checkoutData);
      }
    }

    lastCheckoutData = checkoutData;
  }

  /**
   * Start polling for price changes
   */
  function startPolling() {
    // Don't start if already polling
    if (pollInterval) {
      return;
    }

    // Don't poll if page is hidden
    if (document.hidden) {
      return;
    }

    // Initial check
    checkForPriceChanges();

    // Set up interval
    pollInterval = setInterval(() => {
      // Only poll if page is visible
      if (!document.hidden) {
        checkForPriceChanges();
      }
    }, POLL_INTERVAL);

    console.log('[PRICE HANDLER] Started polling for price changes');
  }

  /**
   * Stop polling for price changes
   */
  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
      console.log('[PRICE HANDLER] Stopped polling for price changes');
    }
  }

  /**
   * Handle form submission with price change validation
   */
  function handleFormSubmission(e) {
    const form = e.target;
    const acknowledgeCheckbox = document.getElementById('acknowledge-price-changes');
    
    // Check if price changes require acknowledgment
    if (acknowledgeCheckbox && !acknowledgeCheckbox.checked) {
      e.preventDefault();
      alert('Please acknowledge the price changes before completing your order.');
      acknowledgeCheckbox.focus();
      return false;
    }

    // Add acknowledgment to form data if checkbox is checked
    if (acknowledgeCheckbox && acknowledgeCheckbox.checked) {
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'acknowledgePriceChanges';
      hiddenInput.value = 'true';
      form.appendChild(hiddenInput);
    }

    // Stop polling when form is submitted
    stopPolling();
  }

  /**
   * Request notification permission
   */
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('[PRICE HANDLER] Notification permission:', permission);
      });
    }
  }

  /**
   * Initialize price change handler
   */
  function init() {
    // Only run on checkout page
    if (!window.location.pathname.includes('/checkout')) {
      return;
    }

    // Check if banner was dismissed
    const bannerDismissed = sessionStorage.getItem('priceChangeBannerDismissed');
    if (bannerDismissed === 'true') {
      const banner = document.getElementById('price-change-banner');
      if (banner) {
        banner.style.display = 'none';
      }
    }

    // Set up event listeners
    const refreshBtn = document.getElementById('refresh-checkout-prices');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', refreshCheckoutPrices);
    }

    const dismissBtn = document.getElementById('dismiss-price-change-banner');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', dismissPriceChangeBanner);
    }

    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', handleFormSubmission);
    }

    // Request notification permission
    requestNotificationPermission();

    // Start polling when page becomes visible
    if (!document.hidden) {
      startPolling();
    }

    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    });

    // Stop polling when page is about to unload
    window.addEventListener('beforeunload', stopPolling);

    console.log('[PRICE HANDLER] Initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();





