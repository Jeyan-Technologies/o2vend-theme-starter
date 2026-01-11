/**
 * O2VEND Default Theme - JavaScript
 * Modern, interactive functionality theme
 */

(function() {
  'use strict';

  // Theme object to hold all functionality
  const Theme = {
    // Initialize all theme functionality
    init() {
      this.initMobileMenu();
      this.initSearch();
      this.initCart();
      this.initProductActions();
      this.initNotifications();
      this.initLazyLoading();
      this.initScrollEffects();
      this.initFormValidation();
      this.initHeaderScroll();
      this.initSmoothScrolling();
      this.initIntersectionObserver();
      this.initLoginModal();
      this.initMobileBottomNav();
    },

    // Mobile menu functionality
    initMobileMenu() {
      const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
      const mainNav = document.querySelector('.main-nav');
      
      if (mobileMenuToggle && mainNav) {
        mobileMenuToggle.addEventListener('click', () => {
          const isOpen = mainNav.classList.contains('mobile-nav-open');
          
          if (isOpen) {
            this.closeMobileMenu();
          } else {
            this.openMobileMenu();
          }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
          if (!mainNav.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            this.closeMobileMenu();
          }
        });

        // Close mobile menu on escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            this.closeMobileMenu();
          }
        });
      }
    },

    openMobileMenu() {
      const mainNav = document.querySelector('.main-nav');
      const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
      
      if (mainNav && mobileMenuToggle) {
        mainNav.classList.add('mobile-nav-open');
        mobileMenuToggle.classList.add('mobile-menu-open');
        document.body.classList.add('mobile-menu-open');
        
        // Animate hamburger
        const hamburgers = mobileMenuToggle.querySelectorAll('.hamburger');
        hamburgers[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        hamburgers[1].style.opacity = '0';
        hamburgers[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
      }
    },

    closeMobileMenu() {
      const mainNav = document.querySelector('.main-nav');
      const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
      
      if (mainNav && mobileMenuToggle) {
        mainNav.classList.remove('mobile-nav-open');
        mobileMenuToggle.classList.remove('mobile-menu-open');
        document.body.classList.remove('mobile-menu-open');
        
        // Reset hamburger
        const hamburgers = mobileMenuToggle.querySelectorAll('.hamburger');
        hamburgers[0].style.transform = '';
        hamburgers[1].style.opacity = '';
        hamburgers[2].style.transform = '';
      }
    },

    // Search functionality
    initSearch() {
      const searchToggle = document.querySelector('.search-toggle');
      const searchOverlay = document.querySelector('.search-overlay');
      const searchClose = document.querySelector('.search-close');
      const searchInput = document.querySelector('.search-input');
      
      if (searchToggle && searchOverlay) {
        searchToggle.addEventListener('click', () => {
          this.openSearch();
        });
      }
      
      if (searchClose) {
        searchClose.addEventListener('click', () => {
          this.closeSearch();
        });
      }
      
      if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
          if (e.target === searchOverlay) {
            this.closeSearch();
          }
        });
      }
      
      // Close search on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeSearch();
        }
      });
      
      // Focus search input when opened
      if (searchInput) {
        searchInput.addEventListener('focus', () => {
          this.openSearch();
        });
      }
    },

    openSearch() {
      const searchOverlay = document.querySelector('.search-overlay');
      const searchInput = document.querySelector('.search-input');
      
      if (searchOverlay) {
        searchOverlay.classList.add('active');
        document.body.classList.add('search-open');
        
        // Focus search input after animation
        setTimeout(() => {
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
      }
    },

    closeSearch() {
      const searchOverlay = document.querySelector('.search-overlay');
      const searchInput = document.querySelector('.search-input');
      
      if (searchOverlay) {
        searchOverlay.classList.remove('active');
        document.body.classList.remove('search-open');
        
        if (searchInput) {
          searchInput.value = '';
        }
      }
    },

    // Cart functionality
    initCart() {
      // Use event delegation for add-to-cart buttons to handle dynamically loaded content (widgets, async sections)
      // This avoids needing to re-initialize when new product cards are added
      document.addEventListener('click', (e) => {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (!addToCartBtn) return;
        
        console.log('[Theme] Add to cart button clicked:', addToCartBtn);
        
        // Check if this is a product card button (has a product-card ancestor)
        const productCard = addToCartBtn.closest('.product-card');
        if (productCard) {
          // Check product type and variants count
          const productType = parseInt(productCard.dataset.productType || addToCartBtn.dataset.productType || '0', 10);
          const variantsCount = parseInt(productCard.dataset.variantsCount || '0', 10);
          
          // Show modal if:
          // 1. productType != 0 (always show modal)
          // 2. productType == 0 AND variants count > 0 (show modal for variant selection)
          if (productType !== 0 || (productType === 0 && variantsCount > 0)) {
            // Show modal
            e.preventDefault();
            e.stopPropagation();
            console.log('[Theme] Showing modal - productType:', productType, 'variantsCount:', variantsCount);
            this.showAddToCartModal(productCard, addToCartBtn);
          } else {
            console.log('[Theme] Skipping modal - productType:', productType, 'variantsCount:', variantsCount);
          }
          // Type == 0 && variants == 0: Don't prevent default - let product-card's own handler work
          // The product-card.liquid script will handle type 0 products with no variants directly
        } else {
          // Direct add for non-product-card buttons (e.g., product page)
          e.preventDefault();
          const productId = addToCartBtn.getAttribute('data-product-id');
          const quantity = addToCartBtn.getAttribute('data-quantity') || 1;
          
          if (productId) {
            this.addToCart(productId, parseInt(quantity));
          }
        }
      });

      // Quantity selectors
      const quantityInputs = document.querySelectorAll('.quantity-input');
      
      quantityInputs.forEach(input => {
        input.addEventListener('change', (e) => {
          const productId = input.getAttribute('data-product-id');
          const quantity = parseInt(e.target.value);
          
          if (productId && quantity > 0) {
            this.updateCartItem(productId, quantity);
          }
        });
      });

      // Remove from cart buttons
      const removeFromCartBtns = document.querySelectorAll('.remove-from-cart-btn');
      
      removeFromCartBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const productId = btn.getAttribute('data-product-id');
          
          if (productId) {
            this.removeFromCart(productId);
          }
        });
      });
    },

    async addToCart(productId, quantity = 1, skipButtonUpdate = false) {
      try {
        // Only update button state if not skipping (e.g., when called from modal)
        let btn = null;
        if (!skipButtonUpdate) {
          btn = document.querySelector(`[data-product-id="${productId}"]`);
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Adding...';
          }
        }

        const response = await fetch('/webstoreapi/carts/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            productId: productId,
            quantity: quantity
          })
        });

        // Check content type before parsing - handle HTML responses
        const contentType = response.headers.get('content-type') || '';
        const isHtml = contentType.includes('text/html');
        
        // Helper function to open login modal with fallbacks
        const openLogin = () => {
          console.log('[AddToCart] Attempting to open login modal');
          if (this.openLoginModal && typeof this.openLoginModal === 'function') {
            console.log('[AddToCart] Using this.openLoginModal');
            this.openLoginModal();
            return true;
          } else if (window.Theme && window.Theme.openLoginModal && typeof window.Theme.openLoginModal === 'function') {
            console.log('[AddToCart] Using window.Theme.openLoginModal');
            window.Theme.openLoginModal();
            return true;
          } else {
            console.log('[AddToCart] Using fallback: triggering login modal via data attribute');
            // Fallback: trigger login modal via data attribute
            const loginTrigger = document.querySelector('[data-login-modal-trigger]');
            if (loginTrigger) {
              loginTrigger.click();
              return true;
            } else {
              console.error('[AddToCart] No login trigger found and openLoginModal not available');
              return false;
            }
          }
        };
        
        // If response is HTML (error page), treat as authentication required for 404/401
        if (isHtml && !response.ok) {
          console.log('[AddToCart] HTML error page received, status:', response.status);
          if (response.status === 404 || response.status === 401) {
            console.log('[AddToCart] HTML error page with 404/401, opening login modal');
            openLogin();
            if (!skipButtonUpdate && btn) {
              btn.innerHTML = 'Add to Cart';
              btn.disabled = false;
            }
            return;
          }
        }
        
        // Try to parse JSON response
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          // If JSON parsing fails and we have a 404/401, treat as auth required
          if (!response.ok && (response.status === 404 || response.status === 401)) {
            console.log('[AddToCart] JSON parse error with 404/401 status, opening login modal');
            openLogin();
            if (!skipButtonUpdate && btn) {
              btn.innerHTML = 'Add to Cart';
              btn.disabled = false;
            }
            return;
          }
          // Re-throw if it's not a 404/401
          throw parseError;
        }
        
        // Debug logging
        console.log('[AddToCart] Response status:', response.status, 'Response OK:', response.ok);
        console.log('[AddToCart] Response data:', data);
        console.log('[AddToCart] requiresAuth:', data.requiresAuth, 'openLoginModal exists:', !!this.openLoginModal);
        
        // Check if response indicates authentication is required (check both status and data)
        if ((!response.ok || !data.success) && data.requiresAuth) {
          console.log('[AddToCart] Authentication required, opening login modal');
          openLogin();
          // Reset button state
          if (!skipButtonUpdate && btn) {
            btn.innerHTML = 'Add to Cart';
            btn.disabled = false;
          }
          return;
        }
        
        // Also check for 401 or 404 status code even if requiresAuth flag is not set
        if (!response.ok && (response.status === 401 || response.status === 404)) {
          console.log('[AddToCart] 401/404 status detected, opening login modal');
          openLogin();
          // Reset button state
          if (!skipButtonUpdate && btn) {
            btn.innerHTML = 'Add to Cart';
            btn.disabled = false;
          }
          return;
        }

        if (data.success) {
          // Always fetch full cart data after successful add to ensure instant update
          // This ensures both cart count and total are updated immediately
          try {
            // Fetch full cart data to get updated count, total, and all cart information
            const cartResponse = await fetch('/webstoreapi/carts', {
              method: 'GET',
              credentials: 'same-origin',
              headers: { 'Accept': 'application/json' }
            });
            
            if (cartResponse.ok) {
              const cartData = await cartResponse.json();
              if (cartData.success && cartData.data) {
                // Use the full cart data from the API response (includes total, itemCount, etc.)
                data.data = cartData.data;
                
                // Update cart count badge instantly using CartManager
                if (window.CartManager && typeof window.CartManager.dispatchCartUpdated === 'function') {
                  const cartCount = cartData.data.itemCount || 0;
                  window.CartManager.dispatchCartUpdated({ 
                    itemCount: cartCount, 
                    cart: cartData.data 
                  });
                }
              }
            }
          } catch (e) {
            console.warn('Failed to fetch full cart data after add:', e);
            // Fallback: try to fetch just the count if full cart fetch fails
            try {
              if (window.CartManager && typeof window.CartManager.getCartCount === 'function') {
                const cartCount = await window.CartManager.getCartCount(true);
                data.data = data.data || {};
                data.data.itemCount = cartCount;
                // If we don't have total in response, preserve whatever was in the original response
                if (!data.data.total && data.data.total !== 0) {
                  // Keep the existing total from original response or default to 0
                  data.data.total = data.data.total || 0;
                }
              }
            } catch (countError) {
              console.warn('Failed to fetch cart count after add:', countError);
              // Use itemCount from original response if available
              if (data.data && (data.data.itemCount === undefined || !data.data.items)) {
                data.data = data.data || {};
                data.data.itemCount = data.data.itemCount || (data.data.items ? data.data.items.length : 0);
              }
            }
          }
          // Update cart UI with the latest data (includes total and count)
          this.updateCartUI(data.data);
          this.showNotification('Product added to cart!', 'success');
          
          // Update button state (only if not skipping updates)
          if (!skipButtonUpdate && btn) {
            btn.innerHTML = 'Added to Cart';
            btn.classList.add('btn-success');
            setTimeout(() => {
              btn.innerHTML = 'Add to Cart';
              btn.classList.remove('btn-success');
              btn.disabled = false;
            }, 2000);
          }
        } else {
          // Check if authentication is required
          console.log('[AddToCart] Request failed, checking requiresAuth:', data.requiresAuth);
          if (data.requiresAuth) {
            console.log('[AddToCart] Authentication required in else block, opening login modal');
            // Helper function to open login modal with fallbacks
            const openLogin = () => {
              if (this.openLoginModal && typeof this.openLoginModal === 'function') {
                this.openLoginModal();
                return true;
              } else if (window.Theme && window.Theme.openLoginModal && typeof window.Theme.openLoginModal === 'function') {
                window.Theme.openLoginModal();
                return true;
              } else {
                const loginTrigger = document.querySelector('[data-login-modal-trigger]');
                if (loginTrigger) {
                  loginTrigger.click();
                  return true;
                }
                return false;
              }
            };
            openLogin();
            // Reset button state
            if (!skipButtonUpdate && btn) {
              btn.innerHTML = 'Add to Cart';
              btn.disabled = false;
            }
            return;
          }
          throw new Error(data.error || data.message || 'Failed to add product to cart');
        }
      } catch (error) {
        console.error('Error adding to cart:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        // Helper function to open login modal
        const openLogin = () => {
          if (this.openLoginModal && typeof this.openLoginModal === 'function') {
            this.openLoginModal();
          } else if (window.Theme && window.Theme.openLoginModal && typeof window.Theme.openLoginModal === 'function') {
            window.Theme.openLoginModal();
          } else {
            const loginTrigger = document.querySelector('[data-login-modal-trigger]');
            if (loginTrigger) {
              loginTrigger.click();
            }
          }
        };
        
        // Check for authentication-related errors
        if (error.message && (
          error.message.includes('Authentication required') ||
          error.message.includes('Please sign in') ||
          error.message.includes('unauthorized')
        )) {
          console.log('[AddToCart] Authentication required detected in error message');
          openLogin();
          // Reset button state (only if not skipping updates)
          if (!skipButtonUpdate) {
            const btn = document.querySelector(`[data-product-id="${productId}"]`);
            if (btn) {
              btn.innerHTML = 'Add to Cart';
              btn.disabled = false;
            }
          }
          return;
        }
        
        this.showNotification(error.message || 'Error adding product to cart', 'error');
        
        // Reset button state (only if not skipping updates)
        if (!skipButtonUpdate) {
          const btn = document.querySelector(`[data-product-id="${productId}"]`);
          if (btn) {
            btn.innerHTML = 'Add to Cart';
            btn.disabled = false;
          }
        }
      }
    },

    async updateCartItem(productId, quantity) {
      try {
        const response = await fetch('/webstoreapi/carts/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            productId: productId,
            quantity: quantity
          })
        });

        const data = await response.json();

        if (data.success) {
          // Update cart UI and dispatch event
          this.updateCartUI(data.data);
          this.showNotification('Cart updated', 'success');
        } else {
          throw new Error(data.message || 'Failed to update cart');
        }
      } catch (error) {
        console.error('Error updating cart:', error);
        this.showNotification('Error updating cart', 'error');
      }
    },

    async removeFromCart(productId) {
      try {
        const response = await fetch('/webstoreapi/carts/remove', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            productId: productId
          })
        });

        const data = await response.json();

        if (data.success) {
          // Update cart UI and dispatch event
          this.updateCartUI(data.data);
          this.showNotification('Product removed from cart', 'success');
          
          // Remove product element from cart page
          const productElement = document.querySelector(`[data-product-id="${productId}"]`)?.closest('.cart-item');
          if (productElement) {
            productElement.style.opacity = '0';
            setTimeout(() => {
              productElement.remove();
            }, 300);
          }
        } else {
          throw new Error(data.message || 'Failed to remove product from cart');
        }
      } catch (error) {
        console.error('Error removing from cart:', error);
        this.showNotification('Error removing product from cart', 'error');
      }
    },

    updateCartUI(cart) {
      // Extract count from various possible locations in the response
      let count = 0;
      if (cart) {
        count = cart.itemCount || 
                cart.cartQuantity || 
                (cart.items && cart.items.length) ||
                0;
      }
      
      console.log('[Theme] updateCartUI called with count:', count, 'cart:', cart);
      
      // Use CartManager as single source of truth for all cart count updates
      // This ensures header badge and drawer badge stay in sync
      // Both now use [data-cart-count] attribute
      if (window.CartManager) {
        // CartManager will update all [data-cart-count] elements (header and drawer)
        window.CartManager.updateCartBadge(count);
      } else {
        // Fallback if CartManager not loaded yet
        const cartCountElements = document.querySelectorAll('[data-cart-count]');
        cartCountElements.forEach(element => {
          element.textContent = count;
          element.setAttribute('data-cart-count', count.toString());
          const isDrawerTitle = element.closest('.cart-drawer-title');
          if (count > 0) {
            element.removeAttribute('style');
          } else {
            // Hide header badges when count is 0, but keep drawer title visible
            if (!isDrawerTitle) {
              element.style.display = 'none';
            } else {
              element.removeAttribute('style');
            }
          }
        });
      }

      // Also update legacy .cart-count selector for backward compatibility
      const cartCount = document.querySelector('.cart-count');
      if (cartCount) {
        cartCount.textContent = count;
      }

      // Update cart total
      const cartTotal = document.querySelector('.cart-total');
      if (cartTotal) {
        cartTotal.textContent = this.formatMoney(cart.total || 0);
      }

      // Hide cart text (no MRP/price display - only show icon and quantity badge)
      const cartTextElements = document.querySelectorAll('.site-header__cart-text');
      cartTextElements.forEach(el => {
        el.style.display = 'none';
      });

      // Update cart link
      const cartLink = document.querySelector('.cart-link');
      if (cartLink) {
        cartLink.setAttribute('aria-label', `Shopping cart with ${count} item${count !== 1 ? 's' : ''}`);
      }

      // Dispatch cart:updated event for global synchronization
      if (window.CartManager) {
        window.CartManager.dispatchCartUpdated(cart);
      } else {
        // Fallback: dispatch event directly if CartManager not loaded yet
        const event = new CustomEvent('cart:updated', {
          detail: {
            count: count,
            cart: cart
          },
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
      }
    },

    // Product actions (quick view, wishlist, etc.)
    initProductActions() {
      // Quick view functionality
      const quickViewBtns = document.querySelectorAll('.quick-view-btn');
      
      quickViewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const productId = btn.getAttribute('data-product-id');
          
          if (productId) {
            this.openQuickView(productId);
          }
        });
      });

      // Wishlist functionality
      const wishlistBtns = document.querySelectorAll('.wishlist-btn');
      
      wishlistBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const productId = btn.getAttribute('data-product-id');
          
          if (productId) {
            this.toggleWishlist(productId, btn);
          }
        });
      });
    },

    async openQuickView(productId) {
      try {
        // Show loading state
        this.showNotification('Loading product...', 'info');
        
        const response = await fetch(`/webstoreapi/products/${productId}`);
        const product = await response.json();
        
        if (product) {
          this.showQuickViewModal(product);
        } else {
          throw new Error('Product not found');
        }
      } catch (error) {
        console.error('Error loading product:', error);
        this.showNotification('Error loading product', 'error');
      }
    },

    showQuickViewModal(product) {
      // Create modal HTML
      const modalHTML = `
        <div class="quick-view-modal" id="quick-view-modal">
          <div class="quick-view-content">
            <button class="quick-view-close" aria-label="Close quick view">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div class="quick-view-body">
              <div class="quick-view-image">
                <img src="${product.images?.[0] || '/assets/placeholder-product.jpg'}" alt="${product.title}">
              </div>
              <div class="quick-view-info">
                <h2 class="quick-view-title">${product.title}</h2>
                <div class="quick-view-price">${this.formatMoney(product.prices?.priceString || product.prices?.price || product.price)}</div>
                <div class="quick-view-description">${product.description || ''}</div>
                <div class="quick-view-actions">
                  <button class="btn btn-primary add-to-cart-btn" data-product-id="${product.productId || product.id}">
                    Add to Cart
                  </button>
                  <a href="/${product.slug || product.id}" class="btn btn-outline">
                    View Details
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add modal to page
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      document.body.classList.add('modal-open');
      
      // Add event listeners
      const modal = document.getElementById('quick-view-modal');
      const closeBtn = modal.querySelector('.quick-view-close');
      
      closeBtn.addEventListener('click', () => {
        this.closeQuickViewModal();
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeQuickViewModal();
        }
      });
      
      // Add to cart functionality
      const addToCartBtn = modal.querySelector('.add-to-cart-btn');
      addToCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.addToCart(product.productId || product.id, 1);
        this.closeQuickViewModal();
      });
    },

    closeQuickViewModal() {
      const modal = document.getElementById('quick-view-modal');
      if (modal) {
        modal.remove();
        document.body.classList.remove('modal-open');
      }
    },

    async toggleWishlist(productId, btn) {
      try {
        const isInWishlist = btn.classList.contains('in-wishlist');
        
        const response = await fetch('/webstoreapi/wishlist/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            productId: productId
          })
        });

        const data = await response.json();

        if (data.success) {
          if (isInWishlist) {
            btn.classList.remove('in-wishlist');
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
            this.showNotification('Removed from wishlist', 'success');
          } else {
            btn.classList.add('in-wishlist');
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
            this.showNotification('Added to wishlist', 'success');
          }
        } else {
          throw new Error(data.message || 'Failed to update wishlist');
        }
      } catch (error) {
        console.error('Error updating wishlist:', error);
        this.showNotification('Error updating wishlist', 'error');
      }
    },

    // Notification system
    /**
     * Initialize global notification container used for toast messages.
     * The container is positioned at the bottom center of the viewport so that
     * all entry points (product cards, product detail, quick view, etc.)
     * share the same visual behavior.
     */
    initNotifications() {
      // Create notification container if it doesn't exist
      if (!document.querySelector('.notifications-container')) {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        container.style.cssText = `
          position: fixed;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          z-index: var(--z-toast, 1080);
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        `;
        document.body.appendChild(container);
      }
    },

    /**
     * Show a toast notification at the bottom center of the viewport.
     * @param {string} message - Message to display in the toast
     * @param {('success'|'error'|'warning'|'info')} [type='success'] - Notification type
     * @param {number} [duration=3000] - Time in ms before the toast auto-dismisses
     */
    showNotification(message, type = 'success', duration = 3000) {
      const container = document.querySelector('.notifications-container');
      if (!container) return;

      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.textContent = message;
      notification.style.cssText = `
        pointer-events: auto;
        margin: 0;
        animation: toastInUp 0.25s var(--ease-out, ease-out) forwards;
      `;

      container.appendChild(notification);

      // Auto remove after duration
      setTimeout(() => {
        notification.style.animation = 'toastOutDown 0.2s var(--ease-in, ease-in) forwards';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 220);
      }, duration);
    },

    // Lazy loading for images
    initLazyLoading() {
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              img.classList.add('loaded');
              observer.unobserve(img);
            }
          });
        });

        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => imageObserver.observe(img));
      }
    },

    // Scroll effects
    initScrollEffects() {
      // Sticky header
      const header = document.querySelector('.site-header');
      if (header) {
        let lastScrollY = window.scrollY;
        
        window.addEventListener('scroll', () => {
          const currentScrollY = window.scrollY;
          
          if (currentScrollY > 100) {
            header.classList.add('header-scrolled');
          } else {
            header.classList.remove('header-scrolled');
          }
          
          lastScrollY = currentScrollY;
        });
      }

      // Fade in animations
      const fadeElements = document.querySelectorAll('.fade-in');
      if (fadeElements.length > 0 && 'IntersectionObserver' in window) {
        const fadeObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('fade-in-visible');
            }
          });
        });

        fadeElements.forEach(el => fadeObserver.observe(el));
      }
    },

    // Form validation
    initFormValidation() {
      const forms = document.querySelectorAll('form[data-validate]');
      
      forms.forEach(form => {
        form.addEventListener('submit', (e) => {
          if (!this.validateForm(form)) {
            e.preventDefault();
          }
        });

        // Real-time validation
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          input.addEventListener('blur', () => {
            this.validateField(input);
          });
        });
      });
    },

    validateForm(form) {
      let isValid = true;
      const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
      
      inputs.forEach(input => {
        if (!this.validateField(input)) {
          isValid = false;
        }
      });
      
      return isValid;
    },

    validateField(field) {
      const value = field.value.trim();
      const type = field.type;
      const required = field.hasAttribute('required');
      let isValid = true;
      let message = '';

      // Clear previous error
      this.clearFieldError(field);

      // Required validation
      if (required && !value) {
        isValid = false;
        message = 'This field is required';
      }

      // Type-specific validation
      if (value && type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
          message = 'Please enter a valid email address';
        }
      }

      if (value && type === 'tel') {
        // Check if this field has intl-tel-input instance
        let phoneIsValid = false;
        
        // Check for intl-tel-input instances
        if (field.id === 'shipping-phone' && window.shippingPhoneIti) {
          phoneIsValid = window.shippingPhoneIti.isValidNumber();
        } else if (field.id === 'address-phone' && window.addressPhoneIti) {
          phoneIsValid = window.addressPhoneIti.isValidNumber();
        } else if (field.id === 'profile-phone' && window.profilePhoneIti) {
          phoneIsValid = window.profilePhoneIti.isValidNumber();
        } else if (field.id === 'login-phone-otp' && window.loginPhoneIti) {
          phoneIsValid = window.loginPhoneIti.isValidNumber();
        } else {
          // Fallback to regex validation for fields without intl-tel-input
          const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
          phoneIsValid = phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
        }
        
        if (!phoneIsValid) {
          isValid = false;
          message = 'Please enter a valid phone number';
        }
      }

      if (value && field.hasAttribute('minlength')) {
        const minLength = parseInt(field.getAttribute('minlength'));
        if (value.length < minLength) {
          isValid = false;
          message = `Must be at least ${minLength} characters`;
        }
      }

      if (value && field.hasAttribute('maxlength')) {
        const maxLength = parseInt(field.getAttribute('maxlength'));
        if (value.length > maxLength) {
          isValid = false;
          message = `Must be no more than ${maxLength} characters`;
        }
      }

      // Show error if invalid
      if (!isValid) {
        this.showFieldError(field, message);
      }

      return isValid;
    },

    showFieldError(field, message) {
      field.classList.add('error');
      
      const errorElement = document.createElement('div');
      errorElement.className = 'form-error';
      errorElement.textContent = message;
      
      field.parentNode.appendChild(errorElement);
    },

    clearFieldError(field) {
      field.classList.remove('error');
      
      const errorElement = field.parentNode.querySelector('.form-error');
      if (errorElement) {
        errorElement.remove();
      }
    },

    // Utility functions
    formatMoney(amount, currency = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount / 100);
    },
    
    // Format money helper for product cards (amounts not in cents)
    formatMoneyProductCard(amount) {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00';
      }
      const num = parseFloat(amount);
      if (isNaN(num)) return String(amount);
      // Get currency symbol from shop settings
      const currencySymbol = window.__SHOP_CURRENCY_SYMBOL__ || 
                            (document.body && document.body.dataset.shopCurrencySymbol) || 
                            '$';
      const formatted = num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return currencySymbol + formatted;
    },
    
    // Show add to cart modal for product cards
    async showAddToCartModal(productCard, addToCartBtn) {
      const modal = document.getElementById('add-to-cart-modal');
      if (!modal) {
        console.error('[AddToCartModal] Modal element not found');
        return;
      }
      
      console.log('[AddToCartModal] Opening modal for product card:', productCard);
      
      // Extract product data from card
      const baseProductId = productCard.dataset.productId;
      // Support both product-card classes and generic product classes
      const productTitle = productCard.querySelector('.product-card__title-link')?.textContent?.trim() || 
                           productCard.querySelector('.product-card__title')?.textContent?.trim() ||
                           productCard.querySelector('.product-title-link')?.textContent?.trim() || 
                           productCard.querySelector('.product-title')?.textContent?.trim() || '';
      const productImage = productCard.querySelector('.product-card__image--primary') ||
                           productCard.querySelector('.product-card__image') ||
                           productCard.querySelector('.product-image');
      const baseImageSrc = productImage?.src || '';
      
      // Fetch full product data using getProductById API endpoint (routes/api.js:3455)
      // This endpoint calls req.apiClient.getProductById() to get complete product details
      let fullProductData = null;
      try {
        const response = await fetch(`/webstoreapi/products/${baseProductId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        if (response.ok) {
          const result = await response.json();
          console.log('[AddToCartModal] Product API response:', result);
          
          // Endpoint returns: { success: true, data: product }
          if (result.success && result.data) {
            fullProductData = result.data;
            console.log('[AddToCartModal] Full product data retrieved:', fullProductData);
            
            // If product has combinations or subscriptions, redirect to product detail page
            const hasCombinations = fullProductData.combinations && fullProductData.combinations.length > 0;
            const hasSubscriptions = fullProductData.subscriptions && fullProductData.subscriptions.length > 0;
            
            if (hasCombinations || hasSubscriptions) {
              const productSlug = fullProductData.slug || fullProductData.id || baseProductId;
              window.location.href = `/${productSlug}`;
              return;
            }
          } else {
            console.warn('[AddToCartModal] API response missing success or data:', result);
          }
        } else {
          // Response not OK - try to parse error
          const errorText = await response.text();
          console.error('[AddToCartModal] API response not OK:', response.status, errorText);
          try {
            const errorJson = JSON.parse(errorText);
            console.error('[AddToCartModal] API error details:', errorJson);
          } catch (e) {
            // Error text is not JSON, already logged
          }
        }
      } catch (error) {
        console.error('Error fetching product data:', error);
        // Continue with modal if fetch fails
      }
      
      // Build variantData from fullProductData if available, otherwise from script tag
      let variantData = null;
      
      // Priority 1: Use fullProductData from API if it has variants/variations
      // API might return either 'variants' or 'variations' - handle both
      const apiVariants = fullProductData?.variants || fullProductData?.variations || null;
      if (fullProductData && apiVariants && apiVariants.length > 0) {
        console.log('[AddToCartModal] Using variant data from API response, variant count:', apiVariants.length);
        // Transform API variants to match expected format (same as product-card JSON structure)
        const transformedVariants = apiVariants.map(variant => {
          // Extract image URLs (handle both thumbnailImage1 and images array)
          const imageUrls = [];
          if (variant.thumbnailImage1?.url) {
            imageUrls.push(variant.thumbnailImage1.url);
          } else if (variant.ThumbnailImage1?.Url) {
            imageUrls.push(variant.ThumbnailImage1.Url);
          }
          if (variant.images && Array.isArray(variant.images)) {
            variant.images.forEach(img => {
              if (img.url && !imageUrls.includes(img.url)) imageUrls.push(img.url);
              else if (img.Url && !imageUrls.includes(img.Url)) imageUrls.push(img.Url);
            });
          }
          
          // Determine availability - check multiple possible fields
          const inStock = variant.inStock !== false && variant.inStock !== undefined ? variant.inStock : true;
          const available = variant.available !== false && variant.available !== undefined ? variant.available : inStock;
          
          return {
            productId: variant.productId || variant.id,
            price: variant.prices?.price || variant.price || 0,
            mrp: variant.prices?.mrp || variant.mrp || 0,
            inStock: inStock,
            available: available,
            options: variant.options || [],
            images: imageUrls
          };
        });
        
        // Get base product image
        let baseImage = baseImageSrc;
        if (fullProductData.images && fullProductData.images.length > 0) {
          baseImage = fullProductData.images[0].url || fullProductData.images[0].Url || baseImageSrc;
        } else if (fullProductData.thumbnailImage?.url) {
          baseImage = fullProductData.thumbnailImage.url;
        } else if (fullProductData.thumbnailImage?.Url) {
          baseImage = fullProductData.thumbnailImage.Url;
        }
        
        variantData = {
          variants: transformedVariants,
          baseProductImage: baseImage,
          baseProductId: fullProductData.productId || fullProductData.id || baseProductId
        };
        console.log('[AddToCartModal] Transformed variant data:', variantData);
      } else {
        // Priority 2: Fall back to script tag data
        console.log('[AddToCartModal] Using variant data from script tag');
        const variantDataScript = productCard.querySelector('.product-card-variant-data[data-product-id="' + baseProductId + '"]');
        if (variantDataScript) {
          try {
            variantData = JSON.parse(variantDataScript.textContent);
          } catch (e) {
            console.error('Error parsing variant data from script tag:', e);
          }
        }
      }
      
      // Update modal content
      const modalTitle = modal.querySelector('#add-to-cart-modal-title');
      const modalImage = modal.querySelector('#add-to-cart-modal-image');
      const modalPriceCurrent = modal.querySelector('#add-to-cart-modal-price-current');
      const modalPriceOriginal = modal.querySelector('#add-to-cart-modal-price-original');
      const modalQtyInput = modal.querySelector('#add-to-cart-modal-qty-input');
      const modalVariantOptions = modal.querySelector('#add-to-cart-modal-variant-options');
      
      // CRITICAL: Reset all modal state FIRST before setting up new product
      // This ensures clean state when opening modal for second variation product
      modal._isAddingToCart = false;
      modal._selectedOptions = {};
      if (modal._variantData) {
        delete modal._variantData;
      }
      
      // Reset confirm button state immediately (in case it was left in "Adding..." state from previous action)
      const confirmBtn = modal.querySelector('#add-to-cart-modal-confirm-btn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'ADD TO CART';
        confirmBtn.innerHTML = 'ADD TO CART'; // Also reset innerHTML in case it had loading spinner
      }
      
      // Re-enable variant selection buttons if they exist
      this.disableModalVariantSelection(modal, false);
      
      if (modalTitle) modalTitle.textContent = productTitle;
      if (modalImage && baseImageSrc) {
        modalImage.src = baseImageSrc;
        modalImage.alt = productTitle;
      }
      
      // Store variant data in modal for later use
      modal._variantData = variantData;
      
      // Get initial variant (first available or first)
      let initialVariant = null;
      let initialPrice = 0;
      let initialMrp = 0;
      if (variantData && variantData.variants && variantData.variants.length > 0) {
        initialVariant = variantData.variants.find(v => v.inStock) || variantData.variants[0];
        if (initialVariant) {
          initialPrice = initialVariant.price || 0;
          initialMrp = initialVariant.mrp || 0;
          modal.dataset.productId = initialVariant.productId;
        }
      } else {
        // No variants, use base product
        const priceCurrent = productCard.querySelector('.product-price-current');
        const priceOriginal = productCard.querySelector('.product-price-original');
        initialPrice = priceCurrent?.getAttribute('data-price-current') || 
                      parseFloat(priceCurrent?.textContent?.replace(/[^0-9.]/g, '')) || 0;
        initialMrp = priceOriginal?.getAttribute('data-price-original') || 0;
        modal.dataset.productId = baseProductId;
      }
      
      // Update initial price
      if (modalPriceCurrent) {
        modalPriceCurrent.textContent = this.formatMoneyProductCard(initialPrice);
      }
      if (modalPriceOriginal && initialMrp > initialPrice) {
        modalPriceOriginal.textContent = this.formatMoneyProductCard(initialMrp);
        modalPriceOriginal.style.display = 'inline';
      } else if (modalPriceOriginal) {
        modalPriceOriginal.style.display = 'none';
      }
      if (modalQtyInput) {
        modalQtyInput.value = '1';
      }
      
      // Render variant options if variants exist
      if (variantData && variantData.variants && variantData.variants.length > 0 && modalVariantOptions) {
        this.renderModalVariantOptions(modal, variantData);
      } else if (modalVariantOptions) {
        modalVariantOptions.innerHTML = '';
      }
      
      // Setup quantity controls
      this.setupModalQuantityControls(modal);
      
      // Setup confirm button
      this.setupModalConfirmButton(modal, modal.dataset.productId);
      
      // Setup modal close handlers
      this.setupModalCloseHandlers(modal);
      
      // Show modal
      modal.classList.add('active');
      document.body.classList.add('modal-open');
      
      // Focus on first variant option or quantity input for accessibility
      const firstOptionBtn = modalVariantOptions?.querySelector('.option-value:not(:disabled)');
      if (firstOptionBtn) {
        setTimeout(() => firstOptionBtn.focus(), 100);
      } else if (modalQtyInput) {
        setTimeout(() => modalQtyInput.focus(), 100);
      }
    },
    
    // Render variant options in modal (exact same as product page buildOptionGroups and renderOptionGroups)
    renderModalVariantOptions(modal, variantData) {
      const optionsContainer = modal.querySelector('#add-to-cart-modal-variant-options');
      if (!optionsContainer || !variantData || !variantData.variants) return;
      
      const variants = variantData.variants || [];
      if (variants.length === 0) return;
      
      // Build option groups (exact same logic as product page buildOptionGroups)
      const optionGroups = {};
      
      variants.forEach(variation => {
        const options = variation.options || [];
        
        options.forEach(option => {
          const optionName = (option.optionName || 'Option').toLowerCase();
          const cleanName = optionName.replace(/[^a-z]/g, ''); // Remove non-alphabetic chars
          
          // Map common option names
          let mappedName = cleanName;
          if (cleanName.includes('color') || cleanName.includes('colour')) {
            mappedName = 'color';
          } else if (cleanName.includes('size')) {
            mappedName = 'size';
          }
          
          if (!optionGroups[mappedName]) {
            optionGroups[mappedName] = {
              name: mappedName === 'color' ? 'Color' : (mappedName === 'size' ? 'Size' : option.optionName || 'Option'),
              type: option.displayType || (mappedName === 'color' ? 'color' : 'text'),
              values: new Map()
            };
          }
          
          const value = option.value || '';
          if (!optionGroups[mappedName].values.has(value)) {
            // Check availability (same logic as product page)
            const isInStock = variation.inStock !== false;
            const isAvailable = (variation.available !== false && variation.available !== undefined) ? variation.available : isInStock;
            optionGroups[mappedName].values.set(value, {
              value: value,
              available: isAvailable,
              images: variation.images || []
            });
          }
        });
      });
      
      // Clear container
      optionsContainer.innerHTML = '';
      
      // Sort options: color first, then size, then others (same as product page)
      const sortedKeys = Object.keys(optionGroups).sort((a, b) => {
        const order = { color: 1, size: 2 };
        return (order[a] || 99) - (order[b] || 99);
      });
      
      // Render option groups (exact same structure as product page renderOptionGroups)
      sortedKeys.forEach((key, groupIndex) => {
        const group = optionGroups[key];
        const optionDiv = document.createElement('div');
        optionDiv.className = 'product-option';
        
        const label = document.createElement('label');
        label.className = 'option-label';
        label.textContent = group.name;
        optionDiv.appendChild(label);
        
        const valuesDiv = document.createElement('div');
        valuesDiv.className = 'option-values';
        
        const valuesArray = Array.from(group.values.values());
        valuesArray.forEach((valueObj, index) => {
          const isFirst = groupIndex === 0 && index === 0;
          if (isFirst && !modal._selectedOptions[key]) {
            modal._selectedOptions[key] = valueObj.value;
          }
          
          const button = document.createElement('button');
          button.type = 'button';
          // Use same class structure as product page: option-value option-value-${group.type}
          button.className = `option-value option-value-${group.type} ${(modal._selectedOptions[key] === valueObj.value) ? 'selected' : ''} ${!valueObj.available ? 'disabled' : ''}`;
          button.dataset.optionKey = key;
          button.dataset.optionValue = valueObj.value;
          button.dataset.available = valueObj.available;
          
          if (group.type === 'color') {
            // Color swatch (exact same as product page)
            const colorValue = valueObj.value.toLowerCase().trim();
            const colorMap = {
              'red': '#ef4444',
              'blue': '#3b82f6',
              'green': '#10b981',
              'yellow': '#fbbf24',
              'black': '#000000',
              'white': '#ffffff',
              'gray': '#6b7280',
              'grey': '#6b7280',
              'pink': '#ec4899',
              'purple': '#a855f7',
              'orange': '#f97316',
              'brown': '#92400e',
              'navy': '#1e3a8a',
              'tan': '#d4a574',
              'beige': '#f5f5dc',
              'cream': '#fffdd0',
              'pumice': '#c8c5b9'
            };
            
            const color = colorMap[colorValue] || colorValue;
            button.style.backgroundColor = color;
            button.style.borderColor = (color === '#ffffff' || color === '#fffdd0' || color === '#f5f5dc') ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.1)';
            
            // Add screen reader text
            const srText = document.createElement('span');
            srText.className = 'sr-only';
            srText.textContent = valueObj.value;
            button.appendChild(srText);
          } else {
            // Text/Size button
            button.textContent = valueObj.value;
          }
          
          if (!valueObj.available) {
            button.disabled = true;
          }
          
          valuesDiv.appendChild(button);
        });
        
        optionDiv.appendChild(valuesDiv);
        optionsContainer.appendChild(optionDiv);
      });
      
      // Initialize default selection for remaining groups
      sortedKeys.forEach((key, groupIndex) => {
        if (groupIndex > 0 && !modal._selectedOptions[key]) {
          const firstBtn = optionsContainer.querySelector(`[data-option-key="${key}"]:not(:disabled)`);
          if (firstBtn) {
            modal._selectedOptions[key] = firstBtn.dataset.optionValue;
            firstBtn.classList.add('selected');
          }
        }
      });
      
      // Setup event handler (same as product page)
      this.setupModalVariantEventHandlers(modal, variantData);
      
      // Find initial variant
      this.findModalMatchingVariant(modal, variantData);
    },
    
    // Setup variant event handlers (same as product page)
    setupModalVariantEventHandlers(modal, variantData) {
      const optionsContainer = modal.querySelector('#add-to-cart-modal-variant-options');
      if (!optionsContainer) return;
      
      // Initialize flag if not exists
      if (modal._isAddingToCart === undefined) {
        modal._isAddingToCart = false;
      }
      
      // Remove existing handler if any
      if (modal._variantClickHandler) {
        optionsContainer.removeEventListener('click', modal._variantClickHandler);
      }
      
      // Create new handler (same logic as product page)
      modal._variantClickHandler = (e) => {
        // CRITICAL: Always prevent default and stop propagation first
        // This prevents the click from bubbling up and triggering add-to-cart or closing modal
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // CRITICAL: Prevent variant selection during active add-to-cart request
        // This fixes the issue where modal closes when selecting second option during request
        if (modal._isAddingToCart) {
          console.log('[AddToCartModal] Variant selection blocked - add-to-cart in progress');
          return;
        }
        
        const optionBtn = e.target.closest('.option-value');
        if (!optionBtn || optionBtn.disabled) return;
        
        const optionKey = optionBtn.dataset.optionKey;
        const optionValue = optionBtn.dataset.optionValue;
        
        if (!optionKey || !optionValue) return;
        
        // Deselect other options in same group
        const optionGroup = optionBtn.closest('.product-option');
        optionGroup.querySelectorAll('.option-value').forEach(btn => {
          btn.classList.remove('selected');
        });
        
        // Select clicked option
        optionBtn.classList.add('selected');
        
        // Update selected options
        if (!modal._selectedOptions) {
          modal._selectedOptions = {};
        }
        modal._selectedOptions[optionKey] = optionValue;
        
        // Find matching variant
        this.findModalMatchingVariant(modal, variantData);
      };
      
      // Attach handler to container (event delegation)
      optionsContainer.addEventListener('click', modal._variantClickHandler);
    },
    
    // Find matching variant (exact same logic as product page findMatchingVariant)
    findModalMatchingVariant(modal, variantData) {
      if (!variantData || !variantData.variants) return;
      
      const variants = variantData.variants || [];
      
      // If no variants, use base product
      if (variants.length === 0) {
        this.updateModalVariantUI(modal, {
          productId: variantData.baseProductId,
          price: 0,
          mrp: 0,
          inStock: true,
          available: true,
          images: []
        }, variantData);
        return;
      }
      
      // Find matching variation
      for (const variation of variants) {
        const options = variation.options || [];
        let matches = true;
        
        for (const [key, value] of Object.entries(modal._selectedOptions)) {
          const hasMatchingOption = options.some(opt => {
            const optName = (opt.optionName || 'Option').toLowerCase().replace(/[^a-z]/g, '');
            let mappedName = optName;
            if (optName.includes('color') || optName.includes('colour')) {
              mappedName = 'color';
            } else if (optName.includes('size')) {
              mappedName = 'size';
            }
            const optValue = opt.value || '';
            return mappedName === key && optValue === value;
          });
          
          if (!hasMatchingOption) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          // Check availability (same as product page logic)
          const isInStock = variation.inStock !== false;
          const isAvailable = (variation.available !== false && variation.available !== undefined) ? variation.available : isInStock;
          
          this.updateModalVariantUI(modal, {
            productId: variation.productId,
            price: variation.price || 0,
            mrp: variation.mrp || 0,
            inStock: isInStock,
            available: isAvailable,
            images: variation.images || []
          }, variantData);
          return;
        }
      }
      
      // If no match found, use first variation
      if (variants.length > 0) {
        const firstVar = variants[0];
        const isInStock = firstVar.inStock !== false;
        const isAvailable = (firstVar.available !== false && firstVar.available !== undefined) ? firstVar.available : isInStock;
        
        this.updateModalVariantUI(modal, {
          productId: firstVar.productId,
          price: firstVar.price || 0,
          mrp: firstVar.mrp || 0,
          inStock: isInStock,
          available: isAvailable,
          images: firstVar.images || []
        }, variantData);
      } else {
        this.updateModalVariantUI(modal, {
          productId: variantData.baseProductId,
          price: 0,
          mrp: 0,
          inStock: true,
          available: true,
          images: []
        }, variantData);
      }
    },
    
    // Update modal variant UI (same as product page updateVariantUI)
    updateModalVariantUI(modal, variant, variantData) {
      if (!variant) return;
      
      // Update product ID
      modal.dataset.productId = variant.productId;
      
      // Update price
      const modalPriceCurrent = modal.querySelector('#add-to-cart-modal-price-current');
      const modalPriceOriginal = modal.querySelector('#add-to-cart-modal-price-original');
      
      if (modalPriceCurrent) {
        modalPriceCurrent.textContent = this.formatMoneyProductCard(variant.price || 0);
      }
      
      if (modalPriceOriginal && variant.mrp && variant.mrp > variant.price) {
        modalPriceOriginal.textContent = this.formatMoneyProductCard(variant.mrp);
        modalPriceOriginal.style.display = 'inline';
      } else if (modalPriceOriginal) {
        modalPriceOriginal.style.display = 'none';
      }
      
      // Update image
      const modalImage = modal.querySelector('#add-to-cart-modal-image');
      if (modalImage && variant.images && variant.images.length > 0 && variant.images[0]) {
        
        const variantImageUrl = typeof variant.images[0] === 'string' 
          ? variant.images[0] 
          : (variant.images[0].url || variant.images[0].Url || variant.images[0]);
        modalImage.src = variantImageUrl;
        // Store variant image on modal for later use when adding to cart
        modal.dataset.variantImageUrl = variantImageUrl;
      } else if (modalImage && variantData.baseProductImage) {
        modalImage.src = variantData.baseProductImage;
        // Clear variant image if using base product image
        delete modal.dataset.variantImageUrl;
      }
      
      // Update confirm button disabled state
      const confirmBtn = modal.querySelector('#add-to-cart-modal-confirm-btn');
      if (confirmBtn) {
        confirmBtn.disabled = !(variant.available !== false);
      }
    },
    
    
    // Setup quantity controls in modal
    setupModalQuantityControls(modal) {
      const qtyInput = modal.querySelector('#add-to-cart-modal-qty-input');
      const qtyDecrease = modal.querySelector('#add-to-cart-modal-qty-decrease');
      const qtyIncrease = modal.querySelector('#add-to-cart-modal-qty-increase');
      
      if (!qtyInput || !qtyDecrease || !qtyIncrease) return;
      
      // Store handlers to prevent duplicates
      if (qtyDecrease._qtyHandler) {
        qtyDecrease.removeEventListener('click', qtyDecrease._qtyHandler);
      }
      if (qtyIncrease._qtyHandler) {
        qtyIncrease.removeEventListener('click', qtyIncrease._qtyHandler);
      }
      
      // Decrease button handler
      qtyDecrease._qtyHandler = () => {
        const currentValue = parseInt(qtyInput.value) || 1;
        if (currentValue > 1) {
          qtyInput.value = currentValue - 1;
        }
        qtyDecrease.disabled = parseInt(qtyInput.value) <= 1;
      };
      
      // Increase button handler
      qtyIncrease._qtyHandler = () => {
        const currentValue = parseInt(qtyInput.value) || 1;
        const max = parseInt(qtyInput.getAttribute('max')) || 99;
        if (currentValue < max) {
          qtyInput.value = currentValue + 1;
        }
        qtyDecrease.disabled = false;
        qtyIncrease.disabled = parseInt(qtyInput.value) >= max;
      };
      
      qtyDecrease.addEventListener('click', qtyDecrease._qtyHandler);
      qtyIncrease.addEventListener('click', qtyIncrease._qtyHandler);
      
      // Input validation
      if (qtyInput._changeHandler) {
        qtyInput.removeEventListener('change', qtyInput._changeHandler);
      }
      qtyInput._changeHandler = () => {
        let value = parseInt(qtyInput.value) || 1;
        const min = parseInt(qtyInput.getAttribute('min')) || 1;
        const max = parseInt(qtyInput.getAttribute('max')) || 99;
        
        if (value < min) value = min;
        if (value > max) value = max;
        
        qtyInput.value = value;
        qtyDecrease.disabled = value <= min;
        qtyIncrease.disabled = value >= max;
      };
      qtyInput.addEventListener('change', qtyInput._changeHandler);
      
      // Initialize button states
      qtyDecrease.disabled = parseInt(qtyInput.value) <= 1;
    },
    
    // Setup confirm button handler
    setupModalConfirmButton(modal, productId) {
      const confirmBtn = modal.querySelector('#add-to-cart-modal-confirm-btn');
      if (!confirmBtn) return;
      
      // Initialize flag to track active add-to-cart request
      if (modal._isAddingToCart === undefined) {
        modal._isAddingToCart = false;
      }
      
      // Remove existing listener if any
      if (confirmBtn._confirmHandler) {
        confirmBtn.removeEventListener('click', confirmBtn._confirmHandler);
      }
      
      // Add new listener
      confirmBtn._confirmHandler = async () => {
        // Prevent multiple simultaneous requests
        if (confirmBtn.disabled || modal._isAddingToCart) return;
        
        const qtyInput = modal.querySelector('#add-to-cart-modal-qty-input');
        const quantity = parseInt(qtyInput?.value) || 1;
        
        // Get current product ID (might have changed due to variant selection)
        // CRITICAL: Use the productId from modal.dataset which is updated by findModalMatchingVariant
        let currentProductId = modal.dataset.productId || productId;
        
        // Verify we have a valid variant productId, not the parent product
        // If variants exist and options are selected, ensure we're using the variant's productId
        if (modal._variantData && modal._variantData.variants && modal._variantData.variants.length > 0) {
          const selectedOptionsCount = Object.keys(modal._selectedOptions || {}).length;
          // If options are selected, re-match to ensure we have the correct variant productId
          if (selectedOptionsCount > 0) {
            // Re-match variant to ensure correct productId before adding to cart
            this.findModalMatchingVariant(modal, modal._variantData);
            const matchedProductId = modal.dataset.productId;
            if (matchedProductId && matchedProductId !== currentProductId) {
              console.log('[AddToCartModal] Updated productId from', currentProductId, 'to', matchedProductId, 'based on selected options:', modal._selectedOptions);
              currentProductId = matchedProductId;
            }
          }
        }
        
        console.log('[AddToCartModal] Adding to cart - productId:', currentProductId, 'quantity:', quantity, 'selectedOptions:', modal._selectedOptions);
        
        // CRITICAL: Set loading state and flag BEFORE any async operations
        // This prevents modal from closing during the request
        modal._isAddingToCart = true;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = 'Adding...';
        
        // Disable variant selection during request
        this.disableModalVariantSelection(modal, true);
        
        // Store variation image in localStorage before adding to cart
        const variantImageUrl = modal.dataset.variantImageUrl;
        if (variantImageUrl) {
          const imageKey = `variantImage_${currentProductId}`;
          try {
            localStorage.setItem(imageKey, variantImageUrl);
          } catch (e) {
            console.warn('Failed to store variant image in localStorage:', e);
          }
        }

        try {
          // Pass skipButtonUpdate: true to prevent addToCart from updating product card buttons
          // Modal manages its own button state
          await this.addToCart(currentProductId, quantity, true);
          // Clear flag before closing to allow modal to close
          modal._isAddingToCart = false;
          this.closeAddToCartModal(modal);
        } catch (error) {
          console.error('Error adding to cart from modal:', error);
          // Reset button state on error
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'ADD TO CART';
          // Re-enable variant selection
          this.disableModalVariantSelection(modal, false);
          // Clear the flag on error
          modal._isAddingToCart = false;
        }
      };
      
      confirmBtn.addEventListener('click', confirmBtn._confirmHandler);
    },
    
    // Disable/enable variant selection buttons
    disableModalVariantSelection(modal, disable) {
      const optionsContainer = modal.querySelector('#add-to-cart-modal-variant-options');
      if (!optionsContainer) return;
      
      const variantButtons = optionsContainer.querySelectorAll('.option-value');
      variantButtons.forEach(btn => {
        if (disable) {
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.style.pointerEvents = 'none';
        } else {
          btn.disabled = false;
          btn.style.opacity = '';
          btn.style.cursor = '';
          btn.style.pointerEvents = '';
        }
      });
    },
    
    // Setup modal close handlers
    setupModalCloseHandlers(modal) {
      const closeButtons = modal.querySelectorAll('[data-add-to-cart-modal-close]');
      const overlay = modal.querySelector('.add-to-cart-modal-overlay');
      
      // Initialize flag if not exists
      if (modal._isAddingToCart === undefined) {
        modal._isAddingToCart = false;
      }
      
      // Remove existing listeners and add new ones
      const closeHandler = (e) => {
        // CRITICAL: Prevent closing if add-to-cart request is in progress
        // Check both strict equality and truthy check for safety
        if (modal._isAddingToCart === true || modal._isAddingToCart === 'true') {
          console.log('[AddToCartModal] Close blocked - add-to-cart request in progress');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        this.closeAddToCartModal(modal);
      };
      
      closeButtons.forEach(btn => {
        if (btn._closeHandler) {
          btn.removeEventListener('click', btn._closeHandler);
        }
        btn._closeHandler = closeHandler;
        btn.addEventListener('click', btn._closeHandler);
      });
      
      if (overlay) {
        if (overlay._closeHandler) {
          overlay.removeEventListener('click', overlay._closeHandler);
        }
        overlay._closeHandler = closeHandler;
        overlay.addEventListener('click', overlay._closeHandler);
      }
      
      // Escape key handler - remove old one if exists
      if (modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
      }
      modal._escapeHandler = (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          // CRITICAL: Prevent closing if add-to-cart request is in progress
          // Check both strict equality and truthy check for safety
          if (modal._isAddingToCart === true || modal._isAddingToCart === 'true') {
            console.log('[AddToCartModal] Escape key blocked - add-to-cart request in progress');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
          this.closeAddToCartModal(modal);
        }
      };
      document.addEventListener('keydown', modal._escapeHandler);
    },
    
    // Close add to cart modal
    closeAddToCartModal(modal) {
      if (!modal) {
        // Safety: ensure body scroll is restored even if modal is null
        document.body.classList.remove('modal-open');
        return;
      }
      
      // CRITICAL: Prevent closing if add-to-cart request is in progress
      // Check both strict equality and truthy check for safety
      if (modal._isAddingToCart === true || modal._isAddingToCart === 'true') {
        console.log('[AddToCartModal] Cannot close modal while add-to-cart is in progress');
        return;
      }
      
      modal.classList.remove('active');
      // Always remove modal-open class to restore body scroll
      document.body.classList.remove('modal-open');
      
      // Reset confirm button state
      const confirmBtn = modal.querySelector('#add-to-cart-modal-confirm-btn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'ADD TO CART';
      }
      
      // Re-enable variant selection
      this.disableModalVariantSelection(modal, false);
      
      // Clean up variant data
      if (modal._variantData) {
        delete modal._variantData;
      }
      if (modal._selectedOptions) {
        delete modal._selectedOptions;
      }
      
      // Reset flag (always reset to ensure state is clean)
      modal._isAddingToCart = false;
      
      // Safety: Ensure body scroll is restored (double-check)
      if (document.body.classList.contains('modal-open')) {
        document.body.classList.remove('modal-open');
      }
      
      // Clean up variant click handler
      if (modal._variantClickHandler) {
        const optionsContainer = modal.querySelector('#add-to-cart-modal-variant-options');
        if (optionsContainer) {
          optionsContainer.removeEventListener('click', modal._variantClickHandler);
        }
        delete modal._variantClickHandler;
      }
      
      // Clean up escape key handler
      if (modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
        delete modal._escapeHandler;
      }
    },
    

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    throttle(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // Header scroll effects
    initHeaderScroll() {
      const header = document.getElementById('site-header');
      if (!header) return;

      let lastScrollY = window.scrollY;
      let ticking = false;

      const updateHeader = () => {
        const scrollY = window.scrollY;
        
        if (scrollY > 100) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }

        // Hide/show header on scroll
        if (scrollY > lastScrollY && scrollY > 200) {
          header.style.transform = 'translateY(-100%)';
        } else {
          header.style.transform = 'translateY(0)';
        }

        lastScrollY = scrollY;
        ticking = false;
      };

      const requestTick = () => {
        if (!ticking) {
          requestAnimationFrame(updateHeader);
          ticking = true;
        }
      };

      window.addEventListener('scroll', requestTick, { passive: true });
    },

    // Smooth scrolling for anchor links
    initSmoothScrolling() {
      const links = document.querySelectorAll('a[href^="#"]');
      
      links.forEach(link => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (href === '#') return;
          
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });
    },

    // Intersection Observer for animations
    initIntersectionObserver() {
      if (!('IntersectionObserver' in window)) return;

      const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-visible');
            observer.unobserve(entry.target);
          }
        });
      }, observerOptions);

      // Observe elements with fade-in class
      const fadeElements = document.querySelectorAll('.fade-in');
      fadeElements.forEach(el => observer.observe(el));

      // Observe product cards for staggered animation
      const productCards = document.querySelectorAll('.product-card');
      productCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 100}ms`;
        observer.observe(card);
      });
    },

    // Enhanced add to cart with visual feedback
    async addToCartWithFeedback(productId, btn) {
      const originalText = btn.textContent;
      const originalHTML = btn.innerHTML;
      
      // Show loading state
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        Adding...
      `;
      btn.disabled = true;

      try {
        await this.addToCart(productId, 1);
        
        // Show success state
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
          Added!
        `;
        btn.classList.add('btn-success');
        
        // Reset after delay
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove('btn-success');
          btn.disabled = false;
        }, 2000);
        
      } catch (error) {
        // Show error state
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Error
        `;
        btn.classList.add('btn-error');
        
        // Reset after delay
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove('btn-error');
          btn.disabled = false;
        }, 2000);
      }
    },

    //  scroll-triggered animations
    initScrollAnimations() {
      if (!('IntersectionObserver' in window)) return;

      const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const animationType = element.dataset.animation || 'fadeInUp';
            const delay = element.dataset.delay || 0;
            
            setTimeout(() => {
              element.classList.add('animate-in');
              element.classList.add(`animate-${animationType}`);
            }, delay);
            
            animationObserver.unobserve(element);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      });

      // Observe all elements with animation data attributes
      const animatedElements = document.querySelectorAll('[data-animation]');
      animatedElements.forEach(el => animationObserver.observe(el));
    },

    // Parallax scrolling effects
    initParallaxEffects() {
      if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

      const parallaxElements = document.querySelectorAll('[data-parallax]');
      
      if (parallaxElements.length === 0) return;

      let ticking = false;

      const updateParallax = () => {
        const scrolled = window.pageYOffset;
        
        parallaxElements.forEach(element => {
          const speed = parseFloat(element.dataset.parallax) || 0.5;
          const yPos = -(scrolled * speed);
          element.style.transform = `translateY(${yPos}px)`;
        });
        
        ticking = false;
      };

      const requestTick = () => {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      };

      window.addEventListener('scroll', requestTick, { passive: true });
    },

    // Smooth page transitions - disabled to prevent white flash
    initPageTransitions() {
      // Page transitions disabled to prevent jarring white flash
      // Navigation now uses standard browser behavior for better UX
      return;
    },

    // Micro-interactions for buttons and interactive elements
    initMicroInteractions() {
      // Button ripple effect
      const buttons = document.querySelectorAll('.btn');
      buttons.forEach(button => {
        button.addEventListener('click', (e) => {
          const ripple = document.createElement('span');
          const rect = button.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height);
          const x = e.clientX - rect.left - size / 2;
          const y = e.clientY - rect.top - size / 2;
          
          ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
          `;
          
          button.style.position = 'relative';
          button.style.overflow = 'hidden';
          button.appendChild(ripple);
          
          setTimeout(() => ripple.remove(), 600);
        });
      });

      // Hover effects for cards - handled by CSS for better performance
      // Removed JavaScript hover effects to prevent conflicts with CSS

      // Form input focus effects
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        input.addEventListener('focus', () => {
          input.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
          input.parentElement.classList.remove('focused');
        });
      });
    },

    // Staggered animations for lists and grids
    initStaggeredAnimations() {
      const staggerContainers = document.querySelectorAll('[data-stagger]');
      
      staggerContainers.forEach(container => {
        const items = container.children;
        const staggerDelay = parseInt(container.dataset.stagger) || 100;
        
        Array.from(items).forEach((item, index) => {
          item.style.animationDelay = `${index * staggerDelay}ms`;
          item.classList.add('stagger-item');
        });
      });
    },

    // Loading states and skeleton screens
    initLoadingStates() {
      // Show skeleton loading for dynamic content
      const skeletonElements = document.querySelectorAll('[data-skeleton]');
      
      skeletonElements.forEach(element => {
        element.classList.add('loading-skeleton');
        
        // Simulate loading completion
        setTimeout(() => {
          element.classList.remove('loading-skeleton');
          element.classList.add('loaded');
        }, 2000);
      });
    },

    // Enhanced intersection observer with more animation types
    initAdvancedIntersectionObserver() {
      if (!('IntersectionObserver' in window)) return;

      const observerOptions = {
        threshold: [0, 0.1, 0.5, 1],
        rootMargin: '0px 0px -50px 0px'
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const element = entry.target;
          const ratio = entry.intersectionRatio;
          
          if (ratio > 0.1) {
            element.classList.add('in-view');
          }
          
          if (ratio > 0.5) {
            element.classList.add('fully-visible');
          }
          
          if (ratio === 1) {
            element.classList.add('completely-visible');
          }
        });
      }, observerOptions);

      // Observe all elements with animation classes
      const animatedElements = document.querySelectorAll('.fade-in, .slide-in, .scale-in, .rotate-in');
      animatedElements.forEach(el => observer.observe(el));
    },

    // Performance optimizations
    initPerformanceOptimizations() {
      // Lazy loading for images
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                img.classList.add('loaded');
                imageObserver.unobserve(img);
              }
            }
          });
        });

        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => {
          img.classList.add('lazy');
          imageObserver.observe(img);
        });
      }

      // Preload critical resources
      this.preloadCriticalResources();
      
      // Optimize animations for performance
      this.optimizeAnimations();
    },

    // Preload critical resources
    preloadCriticalResources() {
      // Preload critical fonts
      const fontPreloads = [
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap'
      ];

      fontPreloads.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = href;
        document.head.appendChild(link);
      });

      // Preload critical images
      const criticalImages = document.querySelectorAll('.hero-image, .logo-image');
      criticalImages.forEach(img => {
        if (img.src) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'image';
          link.href = img.src;
          document.head.appendChild(link);
        }
      });
    },

    // Optimize animations for performance
    optimizeAnimations() {
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReducedMotion) {
        // Disable animations for users who prefer reduced motion
        document.documentElement.style.setProperty('--transition-duration', '0.01ms');
        document.documentElement.style.setProperty('--animation-duration', '0.01ms');
      }

      // Use requestAnimationFrame for smooth animations
      let animationFrameId;
      
      const smoothScroll = (target, duration = 300) => {
        const start = window.pageYOffset;
        const distance = target - start;
        const startTime = performance.now();

        const animation = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = this.easeInOutCubic(progress);
          
          window.scrollTo(0, start + distance * ease);
          
          if (progress < 1) {
            animationFrameId = requestAnimationFrame(animation);
          }
        };

        animationFrameId = requestAnimationFrame(animation);
      };

      // Smooth scroll for anchor links
      const anchorLinks = document.querySelectorAll('a[href^="#"]');
      anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = document.querySelector(link.getAttribute('href'));
          if (target) {
            smoothScroll(target.offsetTop);
          }
        });
      });
    },

    // Easing function for smooth animations
    easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    },

    // Login modal (email/password, email OTP, phone OTP)
    initLoginModal() {
      const modal = document.getElementById('login-modal');
      if (!modal) return;

      const overlay = modal.querySelector('[data-login-overlay]');
      const closeButtons = modal.querySelectorAll('[data-login-close]');
      const triggers = document.querySelectorAll('[data-login-modal-trigger]');
      const methodButtons = modal.querySelectorAll('[data-login-method]');

      const views = modal.querySelectorAll('[data-login-view]');
      const stepLabels = modal.querySelectorAll('[data-login-step-label]');

      const passwordForm = modal.querySelector('[data-login-view="password"]');
      const emailFlow = modal.querySelector('[data-login-view="email-otp"]');
      const phoneFlow = modal.querySelector('[data-login-view="phone-otp"]');

      const emailInputForm = emailFlow?.querySelector('[data-login-step="email-input"]');
      const emailVerifyForm = emailFlow?.querySelector('[data-login-step="email-verify"]');
      const phoneInputForm = phoneFlow?.querySelector('[data-login-step="phone-input"]');
      const phoneVerifyForm = phoneFlow?.querySelector('[data-login-step="phone-verify"]');

      const successView = modal.querySelector('[data-login-view="success"]');

      let selectedMethod = null;
      let emailForOtp = '';
      let phoneForOtp = '';
      let userGUIDForOtp = null;
      let userGUIDForPhoneOtp = null;
      let loginPhoneIti = null;

      const setStep = (step) => {
        stepLabels.forEach(label => {
          const key = label.getAttribute('data-login-step-label');
          label.classList.toggle('login-modal__step--active', key === step);
        });
      };

      const showView = (name) => {
        views.forEach(view => {
          const key = view.getAttribute('data-login-view');
          if (key === name) {
            view.hidden = false;
          } else if (view !== successView) {
            view.hidden = true;
          }
        });
        if (name === 'methods') {
          setStep('method');
        } else {
          setStep('verify');
        }
      };

      const resetOtpFlows = () => {
        if (emailInputForm && emailVerifyForm) {
          emailInputForm.style.display = '';
          emailVerifyForm.style.display = 'none';
        }
        if (phoneInputForm && phoneVerifyForm) {
          phoneInputForm.style.display = '';
          phoneVerifyForm.style.display = 'none';
        }
        // Destroy phone input instance when resetting
        if (loginPhoneIti) {
          loginPhoneIti.destroy();
          loginPhoneIti = null;
        }
      };

      const openModal = () => {
        // Check if user is already logged in
        const isLoggedIn = document.cookie.split(';').some(cookie => {
          const [name] = cookie.trim().split('=');
          return name === 'O2VENDIsUserLoggedin' && cookie.includes('true');
        });
        
        if (isLoggedIn) {
          // User is already logged in, redirect to account page or do nothing
          window.location.href = '/account';
          return;
        }

        selectedMethod = null;
        document.body.classList.add('modal-open');
        modal.classList.add('login-modal--active');
        // Reset errors
        modal.querySelectorAll('.login-modal__error').forEach(el => {
          el.classList.remove('login-modal__error--visible');
          el.textContent = '';
        });
        successView.hidden = true;

        // Always start at method selection with no fields visible
        resetOtpFlows();
        showView('methods');
      };

      // Initialize intl-tel-input for login phone
      const initializeLoginPhoneInput = () => {
        const phoneInput = phoneInputForm?.querySelector('#login-phone-otp');
        if (phoneInput && typeof intlTelInput !== 'undefined') {
          // Destroy existing instance if any
          if (loginPhoneIti) {
            loginPhoneIti.destroy();
            loginPhoneIti = null;
          }
          
          loginPhoneIti = intlTelInput(phoneInput, {
            utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.0/build/js/utils.js',
            initialCountry: 'auto',
            geoIpLookup: function(callback) {
              fetch('https://ipapi.co/json/')
                .then(res => res.json())
                .then(data => callback(data.country_code ? data.country_code.toLowerCase() : 'us'))
                .catch(() => callback('us'));
            },
            preferredCountries: ['us', 'gb', 'ca', 'au', 'in'],
            separateDialCode: true,
            nationalMode: false
          });
          
          // Store instance globally for validation
          window.loginPhoneIti = loginPhoneIti;
        }
      };

      const selectMethod = (method) => {
        selectedMethod = method;
        resetOtpFlows();
        if (method === 'password') {
          showView('password');
        } else if (method === 'email-otp') {
          showView('email-otp');
        } else if (method === 'phone-otp') {
          showView('phone-otp');
          // Initialize phone input when phone OTP method is selected
          setTimeout(initializeLoginPhoneInput, 100);
        }
      };

      const closeModal = () => {
        modal.classList.remove('login-modal--active');
        document.body.classList.remove('modal-open');
      };

      triggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          openModal();
        });
      });

      if (overlay) {
        overlay.addEventListener('click', closeModal);
      }
      closeButtons.forEach(btn => {
        btn.addEventListener('click', closeModal);
      });

      methodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const method = btn.getAttribute('data-login-method');
          selectMethod(method);
        });
      });

      const showError = (key, message) => {
        const el = modal.querySelector(`[data-login-error="${key}"]`);
        if (!el) return;
        el.textContent = message;
        el.classList.add('login-modal__error--visible');
      };

      const clearError = (key) => {
        const el = modal.querySelector(`[data-login-error="${key}"]`);
        if (!el) return;
        el.textContent = '';
        el.classList.remove('login-modal__error--visible');
      };

      // Email/password submit
      if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          clearError('password');
          const emailInput = passwordForm.querySelector('#login-email');
          const passwordInput = passwordForm.querySelector('#login-password');
          const rememberInput = passwordForm.querySelector('#login-remember');

          const email = emailInput?.value.trim();
          const password = passwordInput?.value.trim();

          if (!email || !password) {
            showError('password', 'Email and password are required.');
            return;
          }

          const submitBtn = passwordForm.querySelector('[data-login-submit-password]');
          const originalText = submitBtn?.textContent;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
          }

          try {
            const response = await fetch('/webstoreapi/customer/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({
                email,
                password,
                remember: rememberInput?.checked || false
              })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
              showError('password', data.error || 'Unable to sign in. Please try again.');
            } else {
              views.forEach(v => (v.hidden = true));
              successView.hidden = false;
            }
          } catch (err) {
            console.error('Login error:', err);
            showError('password', 'Unable to sign in. Please try again.');
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
            }
          }
        });
      }

      // Email OTP send
      if (emailInputForm) {
        emailInputForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          clearError('email-otp-input');
          const emailInput = emailInputForm.querySelector('#login-email-otp');
          const email = emailInput?.value.trim();
          if (!email) {
            showError('email-otp-input', 'Email is required.');
            return;
          }

          const btn = emailInputForm.querySelector('[data-login-send-email-otp]');
          const original = btn?.textContent;
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sending...';
          }

          try {
            const response = await fetch('/webstoreapi/auth/email/send-otp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
              showError('email-otp-input', data.error || 'Unable to send OTP. Please try again.');
            } else {
              emailForOtp = email;
              userGUIDForOtp = data.userGUID || null;
              const emailDisplay = emailFlow.querySelector('[data-login-email-display]');
              if (emailDisplay) {
                emailDisplay.textContent = email;
              }
              emailInputForm.style.display = 'none';
              emailVerifyForm.style.display = '';
            }
          } catch (err) {
            console.error('Send email OTP error:', err);
            showError('email-otp-input', 'Unable to send OTP. Please try again.');
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.textContent = original;
            }
          }
        });
      }

      // Email OTP verify
      if (emailVerifyForm) {
        emailVerifyForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          clearError('email-otp-verify');
          const codeInput = emailVerifyForm.querySelector('#login-email-otp-code');
          const otp = codeInput?.value.trim();
          if (!otp) {
            showError('email-otp-verify', 'OTP is required.');
            return;
          }

          const btn = emailVerifyForm.querySelector('[data-login-verify-email-otp]');
          const original = btn?.textContent;
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Verifying...';
          }

          try {
            const response = await fetch('/webstoreapi/auth/email/verify-otp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({ 
                email: emailForOtp, 
                otp,
                userGUID: userGUIDForOtp
              })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
              showError('email-otp-verify', data.error || 'Invalid or expired OTP.');
            } else {
              views.forEach(v => (v.hidden = true));
              successView.hidden = false;
            }
          } catch (err) {
            console.error('Verify email OTP error:', err);
            showError('email-otp-verify', 'Unable to verify OTP. Please try again.');
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.textContent = original;
            }
          }
        });
      }

      // Phone OTP send
      if (phoneInputForm) {
        phoneInputForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          clearError('phone-otp-input');
          const phoneInput = phoneInputForm.querySelector('#login-phone-otp');
          
          // Get phone number from intl-tel-input if available
          let phone = '';
          if (loginPhoneIti) {
            const fullPhoneNumber = loginPhoneIti.getNumber();
            if (fullPhoneNumber) {
              // Remove leading + sign
              phone = fullPhoneNumber.replace(/^\+/, '');
            } else {
              phone = phoneInput?.value.trim();
            }
          } else {
            phone = phoneInput?.value.trim();
          }
          
          if (!phone) {
            showError('phone-otp-input', 'Mobile number is required.');
            return;
          }
          
          // Validate phone number if intl-tel-input is available
          if (loginPhoneIti && !loginPhoneIti.isValidNumber()) {
            showError('phone-otp-input', 'Please enter a valid phone number.');
            return;
          }

          const btn = phoneInputForm.querySelector('[data-login-send-phone-otp]');
          const original = btn?.textContent;
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sending...';
          }

          try {
            const response = await fetch('/webstoreapi/auth/phone/send-otp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({ phoneNumber: phone })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
              showError('phone-otp-input', data.error || 'Unable to send OTP. Please try again.');
            } else {
              phoneForOtp = phone;
              userGUIDForPhoneOtp = data.userGUID || null;
              const phoneDisplay = phoneFlow.querySelector('[data-login-phone-display]');
              if (phoneDisplay) {
                phoneDisplay.textContent = phone;
              }
              phoneInputForm.style.display = 'none';
              phoneVerifyForm.style.display = '';
            }
          } catch (err) {
            console.error('Send phone OTP error:', err);
            showError('phone-otp-input', 'Unable to send OTP. Please try again.');
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.textContent = original;
            }
          }
        });
      }

      // Phone OTP verify
      if (phoneVerifyForm) {
        phoneVerifyForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          clearError('phone-otp-verify');
          const codeInput = phoneVerifyForm.querySelector('#login-phone-otp-code');
          const otp = codeInput?.value.trim();
          if (!otp) {
            showError('phone-otp-verify', 'OTP is required.');
            return;
          }

          const btn = phoneVerifyForm.querySelector('[data-login-verify-phone-otp]');
          const original = btn?.textContent;
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Verifying...';
          }

          try {
            const response = await fetch('/webstoreapi/auth/phone/verify-otp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({ 
                phoneNumber: phoneForOtp, 
                otp,
                userGUID: userGUIDForPhoneOtp
              })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
              showError('phone-otp-verify', data.error || 'Invalid or expired OTP.');
            } else {
              views.forEach(v => (v.hidden = true));
              successView.hidden = false;
            }
          } catch (err) {
            console.error('Verify phone OTP error:', err);
            showError('phone-otp-verify', 'Unable to verify OTP. Please try again.');
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.textContent = original;
            }
          }
        });
      }

      // ESC to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('login-modal--active')) {
          closeModal();
        }
      });

      // Expose helper
      this.openLoginModal = openModal;
    },

    // Accessibility enhancements
    initAccessibility() {
      // Skip links
      this.initSkipLinks();
      
      // Keyboard navigation
      this.initKeyboardNavigation();
      
      // ARIA attributes
      this.initARIA();
      
      // Focus management
      this.initFocusManagement();
    },

    // Initialize skip links
    initSkipLinks() {
      const skipLink = document.createElement('a');
      skipLink.href = '#main-content';
      skipLink.textContent = 'Skip to main content';
      skipLink.className = 'skip-link';
      document.body.insertBefore(skipLink, document.body.firstChild);
    },

    // Initialize keyboard navigation
    initKeyboardNavigation() {
      // Escape key handling
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // Close mobile menu
          this.closeMobileMenu();
          
          // Close search overlay
          this.closeSearch();
          
          // Close any open modals
          const modals = document.querySelectorAll('.modal-open');
          modals.forEach(modal => {
            modal.classList.remove('modal-open');
            document.body.classList.remove('modal-open');
          });
        }
      });

      // Tab navigation for dropdowns
      const dropdowns = document.querySelectorAll('.nav-dropdown');
      dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.nav-link');
        const menu = dropdown.querySelector('.dropdown-content');
        
        if (trigger && menu) {
          trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              dropdown.classList.toggle('active');
              trigger.setAttribute('aria-expanded', dropdown.classList.contains('active'));
            }
          });
        }
      });
    },

    // Initialize ARIA attributes
    initARIA() {
      // Mobile menu toggle
      const mobileToggle = document.querySelector('.mobile-menu-toggle');
      if (mobileToggle) {
        mobileToggle.setAttribute('aria-label', 'Toggle mobile menu');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }

      // Search toggle
      const searchToggle = document.querySelector('.search-toggle');
      if (searchToggle) {
        searchToggle.setAttribute('aria-label', 'Open search');
        searchToggle.setAttribute('aria-expanded', 'false');
      }

      // Cart link
      const cartLink = document.querySelector('.cart-link');
      if (cartLink) {
        cartLink.setAttribute('aria-label', 'View shopping cart');
      }

      // Product action buttons
      const actionButtons = document.querySelectorAll('.product-action-btn');
      actionButtons.forEach(btn => {
        const icon = btn.querySelector('svg');
        if (icon) {
          const label = btn.getAttribute('aria-label') || icon.getAttribute('aria-label') || 'Product action';
          btn.setAttribute('aria-label', label);
        }
      });
    },

    // Initialize focus management
    initFocusManagement() {
      // Trap focus in mobile menu
      const mobileMenu = document.querySelector('.mobile-nav');
      if (mobileMenu) {
        const focusableElements = mobileMenu.querySelectorAll(
          'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        mobileMenu.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
        });
      }

      // Return focus to trigger when closing modals
      let lastFocusedElement = null;
      
      document.addEventListener('focusin', (e) => {
        if (e.target.closest('.mobile-nav, .search-overlay, .modal')) {
          lastFocusedElement = e.target;
        }
      });

      // Restore focus when closing modals
      const restoreFocus = () => {
        if (lastFocusedElement && lastFocusedElement.focus) {
          lastFocusedElement.focus();
        }
      };

      // Add restore focus to close methods
      const originalCloseMobileMenu = this.closeMobileMenu;
      this.closeMobileMenu = () => {
        originalCloseMobileMenu.call(this);
        restoreFocus();
      };

      const originalCloseSearch = this.closeSearch;
      this.closeSearch = () => {
        originalCloseSearch.call(this);
        restoreFocus();
      };
    },

    // Mobile bottom navigation initialization
    initMobileBottomNav() {
      // Set active state on bottom nav based on current page
      const currentPath = window.location.pathname;
      const navItems = document.querySelectorAll('.mobile-bottom-nav__item');
      
      navItems.forEach(function(item) {
        const href = item.getAttribute('href');
        const dataItem = item.getAttribute('data-nav-item');
        
        if (href && href !== '#' && href !== 'https://wa.me/1234567890') {
          const itemPath = new URL(href, window.location.origin).pathname;
          
          // Handle home page
          if (dataItem === 'home' && (currentPath === '/' || currentPath === '/index')) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
          }
          // Handle other paths
          else if (currentPath.startsWith(itemPath) && itemPath !== '/') {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
          }
          // Handle cart toggle button (special case)
          else if (dataItem === 'cart' && item.hasAttribute('data-cart-toggle')) {
            // Cart button doesn't get active state based on path
            // It's a toggle button, not a navigation link
          }
        }
      });
    }
  };

  // Initialize theme when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      Theme.init();
      
      // Initialize additional animation features
      Theme.initScrollAnimations();
      Theme.initParallaxEffects();
      Theme.initPageTransitions();
      Theme.initMicroInteractions();
      Theme.initStaggeredAnimations();
      Theme.initLoadingStates();
      Theme.initAdvancedIntersectionObserver();
      
      // Initialize performance and accessibility features
      Theme.initPerformanceOptimizations();
      Theme.initAccessibility();
    });
  } else {
    Theme.init();
    
    // Initialize additional animation features
    Theme.initScrollAnimations();
    Theme.initParallaxEffects();
    Theme.initPageTransitions();
    Theme.initMicroInteractions();
    Theme.initStaggeredAnimations();
    Theme.initLoadingStates();
    Theme.initAdvancedIntersectionObserver();
    
    // Initialize performance and accessibility features
    Theme.initPerformanceOptimizations();
    Theme.initAccessibility();
  }

  // Make Theme available globally
  window.Theme = Theme;

})();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  /*  Animations */
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes fadeInUp {
    from { 
      opacity: 0; 
      transform: translateY(30px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  }

  @keyframes fadeInScale {
    from { 
      opacity: 0; 
      transform: scale(0.9); 
    }
    to { 
      opacity: 1; 
      transform: scale(1); 
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
    40%, 43% { transform: translateY(-10px); }
    70% { transform: translateY(-5px); }
    90% { transform: translateY(-2px); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
    20%, 40%, 60%, 80% { transform: translateX(2px); }
  }

  .fade-in {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }

  .fade-in-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .header-scrolled {
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  }

  .mobile-nav-open {
    display: block !important;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: white;
    z-index: 1000;
    padding: 80px 20px 20px;
    overflow-y: auto;
  }

  .mobile-nav-open .nav-list {
    flex-direction: column;
    gap: 20px;
  }

  .mobile-menu-open .hamburger {
    transition: all 0.3s ease;
  }

  .modal-open {
    overflow: hidden;
  }

  .quick-view-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .quick-view-content {
    background-color: white;
    border-radius: 12px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }

  .quick-view-close {
    position: absolute;
    top: 15px;
    right: 15px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: background-color 0.2s ease;
  }

  .quick-view-close:hover {
    background-color: #f3f4f6;
  }

  .quick-view-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    padding: 30px;
  }

  .quick-view-image img {
    width: 100%;
    height: 400px;
    object-fit: cover;
    border-radius: 8px;
  }

  .quick-view-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 15px;
  }

  .quick-view-price {
    font-size: 20px;
    font-weight: 600;
    color: #000;
    margin-bottom: 20px;
  }

  .quick-view-description {
    color: #6b7280;
    line-height: 1.6;
    margin-bottom: 30px;
  }

  .quick-view-actions {
    display: flex;
    gap: 15px;
  }

  @media (max-width: 768px) {
    .quick-view-body {
      grid-template-columns: 1fr;
      gap: 20px;
      padding: 20px;
    }
    
    .quick-view-image img {
      height: 250px;
    }
  }

  /* Button states */
  .btn-success {
    background-color: var(--color-success) !important;
    color: white !important;
    animation: pulse 0.6s var(--ease-out);
  }

  .btn-error {
    background-color: var(--color-error) !important;
    color: white !important;
    animation: shake 0.6s var(--ease-out);
  }

  /* Loading animations */
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .animate-bounce {
    animation: bounce 1s infinite;
  }

  /* Lazy loading */
  .lazy {
    opacity: 0;
    transition: opacity var(--transition);
  }

  .loaded {
    opacity: 1;
  }

  /* Product card animations */
  /*.product-card {
    animation: fadeInScale 0.2s var(--ease-out);
  }

  /* Product card hover effects handled by components.css */

  /* Staggered animations for product grids */
  .products-grid .product-card:nth-child(1) { animation-delay: 0ms; }
  .products-grid .product-card:nth-child(2) { animation-delay: 100ms; }
  .products-grid .product-card:nth-child(3) { animation-delay: 200ms; }
  .products-grid .product-card:nth-child(4) { animation-delay: 300ms; }
  .products-grid .product-card:nth-child(5) { animation-delay: 400ms; }
  .products-grid .product-card:nth-child(6) { animation-delay: 500ms; }

  /* Reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .fade-in,
    .product-card,
    .quick-view-content,
    .quick-view-body,
    .quick-view-title,
    .quick-view-price,
    .quick-view-description,
    .quick-view-actions {
      animation: none;
      transition: none;
    }
  }

  /* Advanced Animation Keyframes */
  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeInLeft {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes fadeInRight {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes rotateIn {
    from {
      opacity: 0;
      transform: rotate(-10deg) scale(0.8);
    }
    to {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
  }

  @keyframes slideInUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes slideInDown {
    from {
      transform: translateY(-100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes slideInLeft {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @keyframes zoomIn {
    from {
      opacity: 0;
      transform: scale(0.3);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes zoomOut {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.3);
    }
  }

  @keyframes flipInX {
    from {
      opacity: 0;
      transform: perspective(400px) rotateX(90deg);
    }
    to {
      opacity: 1;
      transform: perspective(400px) rotateX(0deg);
    }
  }

  @keyframes flipInY {
    from {
      opacity: 0;
      transform: perspective(400px) rotateY(90deg);
    }
    to {
      opacity: 1;
      transform: perspective(400px) rotateY(0deg);
    }
  }

  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.3);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
    70% {
      transform: scale(0.9);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes wobble {
    0% { transform: translateX(0%); }
    15% { transform: translateX(-25%) rotate(-5deg); }
    30% { transform: translateX(20%) rotate(3deg); }
    45% { transform: translateX(-15%) rotate(-3deg); }
    60% { transform: translateX(10%) rotate(2deg); }
    75% { transform: translateX(-5%) rotate(-1deg); }
    100% { transform: translateX(0%); }
  }

  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.5); }
    50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.8), 0 0 30px rgba(139, 92, 246, 0.6); }
  }

  @keyframes typewriter {
    from { width: 0; }
    to { width: 100%; }
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  /* Animation Classes */
  .animate-fadeInDown {
    animation: fadeInDown 0.6s var(--ease-out);
  }

  .animate-fadeInLeft {
    animation: fadeInLeft 0.6s var(--ease-out);
  }

  .animate-fadeInRight {
    animation: fadeInRight 0.6s var(--ease-out);
  }

  .animate-scaleIn {
    animation: scaleIn 0.5s var(--ease-out);
  }

  .animate-rotateIn {
    animation: rotateIn 0.6s var(--ease-out);
  }

  .animate-slideInUp {
    animation: slideInUp 0.6s var(--ease-out);
  }

  .animate-slideInDown {
    animation: slideInDown 0.6s var(--ease-out);
  }

  .animate-slideInLeft {
    animation: slideInLeft 0.6s var(--ease-out);
  }

  .animate-zoomIn {
    animation: zoomIn 0.5s var(--ease-out);
  }

  .animate-zoomOut {
    animation: zoomOut 0.5s var(--ease-out);
  }

  .animate-flipInX {
    animation: flipInX 0.6s var(--ease-out);
  }

  .animate-flipInY {
    animation: flipInY 0.6s var(--ease-out);
  }

  .animate-bounceIn {
    animation: bounceIn 0.6s var(--ease-out);
  }

  .animate-wobble {
    animation: wobble 1s var(--ease-out);
  }

  .animate-float {
    animation: float 3s ease-in-out infinite;
  }

  .animate-glow {
    animation: glow 2s ease-in-out infinite;
  }

  /* Scroll-triggered animations */
  .slide-in {
    opacity: 0;
    transform: translateX(-30px);
    transition: all 0.6s var(--ease-out);
  }

  .slide-in.animate-in {
    opacity: 1;
    transform: translateX(0);
  }

  .scale-in {
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.6s var(--ease-out);
  }

  .scale-in.animate-in {
    opacity: 1;
    transform: scale(1);
  }

  .rotate-in {
    opacity: 0;
    transform: rotate(-10deg) scale(0.8);
    transition: all 0.6s var(--ease-out);
  }

  .rotate-in.animate-in {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  /* Staggered animations */
  .stagger-item {
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s var(--ease-out);
  }

  .stagger-item.animate-in {
    opacity: 1;
    transform: translateY(0);
  }

  /* Page transitions - removed to prevent white flash */

  /* Micro-interactions */
  .btn {
    position: relative;
    overflow: hidden;
    transition: all var(--transition-fast);
  }

  .btn:hover {
    transform: none !important;
    box-shadow: none !important;
}
    
  .btn:active {
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  /* Card hover effects */
  .collection-card,
  .blog-card {
    transition: all var(--transition-fast);
  }

  .collection-card:hover,
  .blog-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: var(--shadow-xl);
  }

  /* Form focus effects */
  .form-group {
    position: relative;
    transition: all var(--transition-fast);
  }

  .form-group.focused input,
  .form-group.focused textarea,
  .form-group.focused select {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  /* Loading states */
  .loading-skeleton {
    background: linear-gradient(90deg, var(--color-gray-200) 25%, var(--color-gray-100) 50%, var(--color-gray-200) 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
  }

  @keyframes skeleton-loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .loaded {
    opacity: 1;
    transform: translateY(0);
  }

  /* Parallax elements */
  [data-parallax] {
    will-change: transform;
  }

  /* Performance optimizations */
  .optimize-animations * {
    will-change: auto;
  }

  .optimize-animations .btn:hover,
  .optimize-animations .product-card:hover,
  .optimize-animations [data-parallax] {
    will-change: transform;
  }
`;
document.head.appendChild(style);