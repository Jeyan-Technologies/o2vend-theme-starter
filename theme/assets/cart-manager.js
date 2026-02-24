/**
 * O2VEND Cart Manager
 * Centralized cart state management and event system
 * Ensures cart badge updates across all components
 */

(() => {
  'use strict';

  const CartManager = {
    // Cache for cart quantity to prevent duplicate API calls
    _cartQuantityCache: null,
    _cartQuantityLoading: false,
    _cartQuantityPromise: null,
    _cacheTimestamp: null,
    _cacheTTL: 5000, // Cache for 5 seconds

    /**
     * Update cart badge count across all elements with [data-cart-count]
     * @param {number} count - Cart item count
     */
    updateCartBadge(count) {
      const numericCount = parseInt(count, 10) || 0;
      
      // Update all cart badges using [data-cart-count] - single source of truth
      // This includes both header badges and cart drawer title badges
      const countElements = document.querySelectorAll('[data-cart-count]');
      countElements.forEach(element => {
        // Update both text content and data attribute
        element.textContent = numericCount;
        element.setAttribute('data-cart-count', numericCount.toString());
        
        // Show/hide badge based on count
        // CSS rule [data-cart-count="0"] hides it automatically when data attribute is "0"
        // For drawer title, we always show the count (even if 0), so check parent context
        const isDrawerTitle = element.closest('.cart-drawer-title');
        
        if (numericCount > 0) {
          // Remove any inline display style to let CSS handle it
          // CSS has display: inline-flex by default, and won't hide when data-cart-count != "0"
          element.removeAttribute('style');
        } else {
          // Hide header badges when count is 0, but keep drawer title visible
          if (!isDrawerTitle) {
            element.style.display = 'none';
          } else {
            // Drawer title should always be visible, just show "0"
            element.removeAttribute('style');
          }
        }
      });
      
      // Update aria-label on cart toggle buttons
      const cartToggles = document.querySelectorAll('[data-cart-toggle]');
      cartToggles.forEach(toggle => {
        toggle.setAttribute('aria-label', `Shopping cart with ${numericCount} item${numericCount !== 1 ? 's' : ''}`);
      });
    },

    /**
     * Fetch current cart count from API with caching and deduplication
     * Multiple simultaneous calls will share the same promise
     * @param {boolean} forceRefresh - Force refresh cache (default: false)
     * @returns {Promise<number>} Cart item count
     */
    async getCartCount(forceRefresh = false) {
      // Return cached value if available and not expired
      const now = Date.now();
      if (!forceRefresh && this._cartQuantityCache !== null && this._cacheTimestamp) {
        const cacheAge = now - this._cacheTimestamp;
        if (cacheAge < this._cacheTTL) {
          return this._cartQuantityCache;
        }
      }

      // If already loading, return the existing promise to prevent duplicate calls
      if (this._cartQuantityLoading && this._cartQuantityPromise) {
        return this._cartQuantityPromise;
      }

      // Create and cache the promise
      this._cartQuantityLoading = true;
      this._cartQuantityPromise = (async () => {
        try {
          const response = await fetch('/webstoreapi/carts/quantity', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            return 0;
          }
          
          const json = await response.json();
          if (json.success && json.data && json.data.cartQuantity !== undefined) {
            const count = parseInt(json.data.cartQuantity, 10) || 0;
            // Update cache
            this._cartQuantityCache = count;
            this._cacheTimestamp = Date.now();
            return count;
          }
          
          return 0;
        } catch (error) {
          console.error('[CartManager] Failed to fetch cart count:', error);
          return 0;
        } finally {
          this._cartQuantityLoading = false;
          this._cartQuantityPromise = null;
        }
      })();

      return this._cartQuantityPromise;
    },

    /**
     * Dispatch cart:updated event with cart data
     * @param {Object} cartData - Cart data object with itemCount
     * @param {number} cartData.itemCount - Number of items in cart
     * @param {Object} cartData.cart - Full cart object (optional)
     */
    dispatchCartUpdated(cartData) {
      // Extract count from various possible locations in the response
      let count = 0;
      if (cartData) {
        count = cartData.itemCount || 
                cartData.cartQuantity || 
                (cartData.items && cartData.items.length) ||
                (cartData.cart && (cartData.cart.itemCount || cartData.cart.cartQuantity || (cartData.cart.items && cartData.cart.items.length))) ||
                0;
      }
      
      const event = new CustomEvent('cart:updated', {
        detail: {
          count: count,
          cart: cartData.cart || cartData
        },
        bubbles: true,
        cancelable: true
      });
      
      document.dispatchEvent(event);
      
      // Update badge immediately
      this.updateCartBadge(count);
      
      // Invalidate cache when cart is updated
      this._cartQuantityCache = count;
      this._cacheTimestamp = Date.now();
    },

    /**
     * Invalidate cart quantity cache (call when cart changes)
     */
    invalidateCache() {
      this._cartQuantityCache = null;
      this._cacheTimestamp = null;
    },

    /**
     * Initialize cart manager and set up event listeners
     */
    init() {
      // Listen for cart:updated events from external sources
      // Note: dispatchCartUpdated() already calls updateCartBadge() directly,
      // so this listener handles events from other components (like cart-drawer fallback)
      // It's safe to call updateCartBadge() multiple times as it's idempotent
      document.addEventListener('cart:updated', (event) => {
        const count = event.detail.count || 0;
        // updateCartBadge is idempotent, so calling it multiple times is safe
        this.updateCartBadge(count);
      });

      // Load initial cart count on page load
      const initCart = () => {
        this.loadInitialCartCount();
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCart);
      } else {
        // DOM already ready, but wait a bit to ensure all elements are rendered
        setTimeout(initCart, 50);
      }
    },

    /**
     * Load initial cart count on page load
     */
    async loadInitialCartCount() {
      // Small delay to ensure DOM is ready
      setTimeout(async () => {
        const count = await this.getCartCount();
        this.updateCartBadge(count);
      }, 100);
    }
  };

  // Initialize cart manager
  CartManager.init();

  // Make CartManager available globally
  window.CartManager = CartManager;

})();

