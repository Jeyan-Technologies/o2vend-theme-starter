;(function(){
  console.log('[Cart Drawer] Script loaded')
  
  function qs(sel, ctx){ return (ctx||document).querySelector(sel) }
  function qsa(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)) }

  const bodyEl = () => document.body;
  const shopCurrency = () => (bodyEl() && bodyEl().dataset.shopCurrency) || window.__SHOP_CURRENCY__ || 'USD';
  const shopCurrencySymbol = () => (bodyEl() && bodyEl().dataset.shopCurrencySymbol) || window.__SHOP_CURRENCY_SYMBOL__ || shopCurrency();
  const shopLocale = () => (bodyEl() && bodyEl().dataset.shopLocale) || window.__SHOP_LOCALE__ || 'en-US';

  // Format money helper
  function formatMoney(amount, currency = shopCurrency()) {
    const locale = shopLocale();
    const value = typeof amount === 'number' ? amount : Number(amount) || 0;
    const currencySymbol = shopCurrencySymbol();
    const isIsoCurrency = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency);

    if (isIsoCurrency) {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency
        }).format(value);
      } catch (error) {
        console.warn('Failed to format money with locale/currency', locale, currency, error);
      }
    }

    // Fallback: format number with locale and prepend symbol
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

    return currencySymbol ? `${currencySymbol}${formattedNumber}` : formattedNumber;
  }

  function resetCheckoutButton() {
    const checkoutBtn = qs('#cart-drawer-checkout-btn')
    if (checkoutBtn) {
      checkoutBtn.classList.remove('loading')
      checkoutBtn.disabled = false
      checkoutBtn.removeAttribute('aria-disabled')
      // Restore original button text (stored in data attribute or default to 'Check out')
      const originalText = checkoutBtn.dataset.originalText || 'Check out'
      checkoutBtn.innerHTML = originalText
    }
  }

  function openDrawer(){
    const drawer = qs('#cart-drawer')
    if(!drawer) return
    drawer.classList.add('active')
    drawer.setAttribute('aria-hidden','false')
    document.body.style.overflow = 'hidden'
    // Reset checkout button state when opening drawer
    resetCheckoutButton()
    loadCartData()
  }

  function closeDrawer(){
    const drawer = qs('#cart-drawer')
    if(!drawer) return
    drawer.classList.remove('active')
    drawer.setAttribute('aria-hidden','true')
    document.body.style.overflow = ''
  }

  // Flag to prevent infinite recursion when handling cart:updated events
  let _isHandlingCartEvent = false;

  function updateCartCount(count, skipDispatch = false){
    const numericCount = parseInt(count, 10) || 0
    
    // If skipDispatch is true, just update the UI directly without dispatching events
    // This prevents infinite recursion when called from the cart:updated event listener
    if (skipDispatch) {
      if (window.CartManager) {
        // Only update the badge UI directly, don't dispatch another event
        window.CartManager.updateCartBadge(numericCount);
      } else {
        // Fallback: update UI directly without dispatching
        const els = qsa('[data-cart-count]')
        els.forEach(el => {
          el.textContent = numericCount
          el.setAttribute('data-cart-count', numericCount.toString())
          const isDrawerTitle = el.closest('.cart-drawer-title')
          if (numericCount > 0) {
            el.removeAttribute('style')
          } else {
            if (!isDrawerTitle) {
              el.style.display = 'none'
            } else {
              el.removeAttribute('style')
            }
          }
        })
      }
      return;
    }
    
    // Normal flow: use CartManager to dispatch event and update badges
    // This ensures header badge and drawer badge stay in sync
    if (window.CartManager) {
      window.CartManager.dispatchCartUpdated({ itemCount: numericCount });
    } else {
      // Fallback if CartManager not loaded yet
      const els = qsa('[data-cart-count]')
      els.forEach(el => {
        el.textContent = numericCount
        el.setAttribute('data-cart-count', numericCount.toString())
        const isDrawerTitle = el.closest('.cart-drawer-title')
        if (numericCount > 0) {
          el.removeAttribute('style')
        } else {
          // Hide header badges when count is 0, but keep drawer title visible
          if (!isDrawerTitle) {
            el.style.display = 'none'
          } else {
            el.removeAttribute('style')
          }
        }
      })
      
      // Dispatch event as fallback only if not already handling an event
      if (!_isHandlingCartEvent) {
        _isHandlingCartEvent = true;
        const event = new CustomEvent('cart:updated', {
          detail: {
            count: numericCount
          },
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
        _isHandlingCartEvent = false;
      }
    }
  }

  async function loadCartData(){
    const loading = qs('[data-cart-loading]')
    const empty = qs('[data-cart-empty]')
    const itemsList = qs('[data-cart-items-list]')
    const footer = qs('[data-cart-footer]')
    
    if (loading) loading.style.display = 'flex'
    if (empty) empty.style.display = 'none'
    if (itemsList) itemsList.style.display = 'none'
    if (footer) footer.style.display = 'none'
    
    // Reset checkout button state when loading cart data
    resetCheckoutButton()
    
    try {
      const res = await fetch('/webstoreapi/carts')
      const json = await res.json()
      
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to load cart')
      }
      
      const cart = json.data
      
      if (loading) loading.style.display = 'none'
      
      if (!cart.items || cart.items.length === 0) {
        if (empty) empty.style.display = 'flex'
        if (footer) footer.style.display = 'none'
      } else {
        if (empty) empty.style.display = 'none'
        if (itemsList) {
          itemsList.style.display = 'block'
          renderCartItems(cart.items)
        }
        if (footer) {
          footer.style.display = 'flex'
          updateCartFooter(cart)
        }
      }
      
      const count = cart.itemCount || 0
      
      // Use CartManager as single source of truth - it will update both header and drawer badges
      // updateCartCount() already dispatches the event, so we don't need to dispatch again
      updateCartCount(count)
    } catch (e) {
      console.error('Failed to load cart:', e)
      if (loading) loading.style.display = 'none'
      if (empty) empty.style.display = 'flex'
      if (footer) footer.style.display = 'none'
      // Reset checkout button even on error
      resetCheckoutButton()
    }
  }

  function renderCartItems(items) {
    const itemsList = qs('[data-cart-items-list]')
    if (!itemsList) return
    
    itemsList.innerHTML = items.map(item => {
      // Check for variation image override in localStorage
      const imageKey = `variantImage_${item.productId}`;
      let variantImage = null;
      try {
        variantImage = localStorage.getItem(imageKey);
      } catch (e) {
        console.warn('Failed to read variant image from localStorage:', e);
      }
      
      // Use variant image if available, otherwise use API image
      const displayImage = variantImage || item.image;
      
      return `
      <div class="cart-drawer-item" data-item-id="${item.productId}-${item.variantId}">
        <a href="/${item.productSlug || item.productId}" class="cart-drawer-image">
          ${displayImage ? `<img src="${displayImage}" alt="${item.title}" loading="lazy">` : ''}
        </a>
        <div class="cart-drawer-item-content">
          <a href="/${item.productSlug || item.productId}" class="cart-drawer-item-title">${item.title}</a>
          ${item.variantTitle && item.variantTitle !== 'Default Title' ? `<div class="cart-drawer-item-variant">${item.variantTitle}</div>` : ''}
          <div class="cart-drawer-item-row">
            <div class="cart-drawer-qty">
              <button class="qty-btn" data-action="decrease" data-product-id="${item.productId}" data-variant-id="${item.variantId}">−</button>
              <input type="number" class="qty-input" value="${item.quantity}" min="1" max="99" data-product-id="${item.productId}" data-variant-id="${item.variantId}">
              <button class="qty-btn" data-action="increase" data-product-id="${item.productId}" data-variant-id="${item.variantId}">+</button>
            </div>
            <div class="cart-drawer-item-price">${formatMoney(item.linePrice)}</div>
          </div>
        </div>
        <button class="cart-drawer-remove" aria-label="Remove" data-remove-item data-product-id="${item.productId}" data-variant-id="${item.variantId}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          </svg>
        </button>
      </div>
      `;
    }).join('')
  }

  function updateCartFooter(cart) {
    const total = qs('[data-cart-total]')
    if (total) {
      total.textContent = formatMoney(cart.total)
    }
  }

  async function updateQuantity(input, delta){
    const qty = Math.max(1, Math.min(99, (parseInt(input.value||'1',10) || 1) + delta))
    input.value = qty
    await syncQuantity(input)
  }

  async function syncQuantity(input){
    const productId = input.dataset.productId
    const variantId = input.dataset.variantId
    const quantity = parseInt(input.value, 10)
    try {
      const res = await fetch('/webstoreapi/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variantId, quantity })
      })
      const json = await res.json()
      if(!json.success) throw new Error(json.error||'Failed to update cart')
      // Reload cart data (which will dispatch cart:updated event)
      await loadCartData()
    } catch (e) {
      console.error('Failed to update quantity:', e)
      // Revert input value
      input.value = input.defaultValue || '1'
    }
  }

  async function removeItem(btn){
    const productId = btn.dataset.productId
    const variantId = btn.dataset.variantId
    try {
      const res = await fetch('/webstoreapi/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variantId })
      })
      const json = await res.json()
      if(!json.success) throw new Error(json.error||'Failed to remove item')
      // Reload cart data (which will dispatch cart:updated event)
      await loadCartData()
    } catch (e) {
      console.error('Failed to remove item:', e)
    }
  }

  // Flag to prevent multiple simultaneous API calls
  // Use CartManager instead of making direct API calls
  // This prevents duplicate API calls since CartManager handles caching and deduplication
  function initCartQuantity() {
    // Wait for CartManager to be available
    const checkCartManager = () => {
      if (window.CartManager && typeof window.CartManager.getCartCount === 'function') {
        // Get cart count from CartManager (uses cached value if available)
        window.CartManager.getCartCount().then(quantity => {
          updateCartCount(quantity)
        }).catch(() => {
          // Silently fail if CartManager fails
        })
      } else {
        // Retry after a short delay if CartManager not ready
        setTimeout(checkCartManager, 50)
      }
    }

    // Listen for cart:updated events from CartManager
    // IMPORTANT: Use skipDispatch=true to prevent infinite recursion
    // CartManager.dispatchCartUpdated() already updates badges and dispatches events
    // We only need to update the UI, not dispatch another event
    document.addEventListener('cart:updated', (event) => {
      const count = event.detail?.count || 0
      // Skip dispatch to prevent recursion - CartManager already handled badge updates
      updateCartCount(count, true)
    })

    // Wait a bit to ensure DOM and CartManager are ready
    setTimeout(() => {
      checkCartManager()
    }, 150)
  }

  // Set up initialization - only once
  let initCalled = false
  const runCartQuantityInit = () => {
    if (initCalled) return
    initCalled = true
    initCartQuantity()
  }
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runCartQuantityInit, { once: true })
  } else {
    runCartQuantityInit()
  }

  document.addEventListener('DOMContentLoaded', function(){
    const toggle = qsa('[data-cart-toggle]')
    toggle.forEach(t => t.addEventListener('click', function(e){ 
      e.preventDefault()
      e.stopPropagation()
      openDrawer() 
    }))

    document.body.addEventListener('click', function(e){
      const closeBtn = e.target.closest('[data-cart-close]')
      const overlay = e.target.closest('[data-cart-overlay]')
      if (closeBtn || overlay) {
        e.preventDefault()
        closeDrawer()
      }
    })

    document.body.addEventListener('click', function(e){
      const dec = e.target.closest('.qty-btn[data-action="decrease"]')
      const inc = e.target.closest('.qty-btn[data-action="increase"]')
      const removeBtn = e.target.closest('[data-remove-item]')
      if (dec) { 
        const input = dec.parentElement.querySelector('.qty-input')
        if (input) updateQuantity(input, -1) 
      }
      if (inc) { 
        const input = inc.parentElement.querySelector('.qty-input')
        if (input) updateQuantity(input, +1) 
      }
      if (removeBtn) { 
        e.preventDefault()
        removeItem(removeBtn) 
      }
    })

    document.body.addEventListener('change', function(e){
      const input = e.target.closest('.qty-input')
      if (input) syncQuantity(input)
    })

    // Checkout button
    const checkoutBtn = qs('#cart-drawer-checkout-btn')
    if (checkoutBtn) {
      // Store original button text in data attribute for restoration
      if (!checkoutBtn.dataset.originalText) {
        checkoutBtn.dataset.originalText = checkoutBtn.textContent.trim() || 'Check out'
      }
      
      checkoutBtn.addEventListener('click', function(e) {
        // Prevent multiple clicks
        if (checkoutBtn.classList.contains('loading') || checkoutBtn.disabled) {
          e.preventDefault()
          return
        }
        
        // Add loading state
        checkoutBtn.classList.add('loading')
        checkoutBtn.disabled = true
        checkoutBtn.setAttribute('aria-disabled', 'true')
        checkoutBtn.innerHTML = '<span class="loading-spinner"></span> Processing...'
        
        // Set a timeout fallback to reset button if navigation doesn't happen
        const resetTimeout = setTimeout(() => {
          resetCheckoutButton()
        }, 5000) // Reset after 5 seconds if navigation hasn't occurred
        
        // Navigate to checkout
        // Clear timeout if navigation succeeds (page will unload)
        window.addEventListener('beforeunload', () => {
          clearTimeout(resetTimeout)
        })
        
        try {
          window.location.href = '/checkout'
        } catch (error) {
          // If navigation fails, reset button immediately
          console.error('Navigation failed:', error)
          clearTimeout(resetTimeout)
          resetCheckoutButton()
        }
      })
    }

    // Discount toggle
    const discountToggle = qs('[data-discount-toggle]')
    if (discountToggle) {
      discountToggle.addEventListener('click', function() {
        const content = qs('[data-discount-content]')
        const isExpanded = discountToggle.getAttribute('aria-expanded') === 'true'
        discountToggle.setAttribute('aria-expanded', !isExpanded)
        if (content) {
          content.style.display = isExpanded ? 'none' : 'block'
        }
      })
    }

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const drawer = qs('#cart-drawer')
        if (drawer && drawer.classList.contains('active')) {
          closeDrawer()
        }
      }
    })

    // Auto-open cart drawer if ?openCart=true is in URL (e.g., from /cart redirect)
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('openCart') === 'true') {
      // Remove the query parameter from URL without reloading
      const url = new URL(window.location.href)
      url.searchParams.delete('openCart')
      window.history.replaceState({}, '', url)
      
      // Open the drawer
      openDrawer()
    }
  })
})()
