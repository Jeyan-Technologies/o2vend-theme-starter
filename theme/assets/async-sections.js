/**
 * Async Section Loader
 * Loads non-critical page sections asynchronously to improve initial page load time
 */

(function() {
  'use strict';

  const AsyncSectionLoader = {
    config: {},
    retryAttempts: 3,
    retryDelay: 1000,
    cache: new Map(),

    /**
     * Initialize the async section loader
     * @param {Object} sectionsConfig - Configuration object with section endpoints
     */
    init(sectionsConfig) {
      this.config = sectionsConfig || {};
      console.log('[AsyncSectionLoader] Initializing with config:', this.config);
      
      // Find all async sections in the page
      const asyncSections = document.querySelectorAll('[data-async-section]');
      
      if (asyncSections.length === 0) {
        console.log('[AsyncSectionLoader] No async sections found');
        return;
      }

      console.log(`[AsyncSectionLoader] Found ${asyncSections.length} async sections`);
      
      // Load each section
      asyncSections.forEach(section => {
        this.loadSection(section);
      });
    },

    /**
     * Load a specific section
     * @param {HTMLElement} sectionElement - The section DOM element
     */
    async loadSection(sectionElement) {
      const sectionName = sectionElement.getAttribute('data-async-section');
      const sectionConfig = this.config[sectionName];

      if (!sectionConfig) {
        console.warn(`[AsyncSectionLoader] No config found for section: ${sectionName}`);
        return;
      }

      console.log(`[AsyncSectionLoader] Loading section: ${sectionName}`);

      try {
        // Get data from API
        const data = await this.fetchSectionData(
          sectionConfig.endpoint,
          sectionConfig.params || {}
        );

        // Render the section
        this.renderSection(sectionElement, data, sectionName);

        // Trigger custom event
        this.triggerLoadedEvent(sectionElement, sectionName, data);

      } catch (error) {
        console.error(`[AsyncSectionLoader] Failed to load section ${sectionName}:`, error);
        this.handleError(sectionElement, sectionName, error);
      }
    },

    /**
     * Fetch section data from API with retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @param {number} attempt - Current retry attempt
     * @returns {Promise<Object>} Section data
     */
    async fetchSectionData(endpoint, params = {}, attempt = 1) {
      // Build query string
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      // Check cache first
      if (this.cache.has(url)) {
        console.log(`[AsyncSectionLoader] Using cached data for: ${url}`);
        return this.cache.get(url);
      }

      try {
        console.log(`[AsyncSectionLoader] Fetching: ${url} (attempt ${attempt})`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the response
        this.cache.set(url, data);
        
        return data;

      } catch (error) {
        // Retry logic
        if (attempt < this.retryAttempts) {
          console.warn(`[AsyncSectionLoader] Retry ${attempt}/${this.retryAttempts} for ${url}`);
          await this.delay(this.retryDelay * attempt);
          return this.fetchSectionData(endpoint, params, attempt + 1);
        }
        
        throw error;
      }
    },

    /**
     * Render section with data
     * @param {HTMLElement} sectionElement - The section DOM element
     * @param {Object} data - Section data from API
     * @param {string} sectionName - Section name
     */
    renderSection(sectionElement, data, sectionName) {
      console.log(`[AsyncSectionLoader] Rendering section: ${sectionName}`, data);

      // Different rendering strategies based on section type
      switch (sectionName) {
        case 'products':
          this.renderProductGrid(sectionElement, data);
          break;
        case 'categories':
        case 'collections':
          this.renderCollectionGrid(sectionElement, data);
          break;
        case 'related-products':
        case 'relatedProducts':
          this.renderRelatedProducts(sectionElement, data);
          break;
        default:
          console.warn(`[AsyncSectionLoader] Unknown section type: ${sectionName}`);
          this.renderGenericSection(sectionElement, data);
      }

      // Add fade-in animation
      sectionElement.classList.add('async-loaded');
      
      // Re-initialize any theme functionality for new content
      // Note: Cart functionality now uses event delegation, so no need to re-initialize
      if (window.Theme && window.Theme.initProductActions) {
        window.Theme.initProductActions();
      }
    },

    /**
     * Render product grid
     */
    renderProductGrid(sectionElement, data) {
      const products = data.products || data.data || [];
      
      if (products.length === 0) {
        sectionElement.innerHTML = this.getEmptyStateHTML('products');
        return;
      }

      const gridHTML = `
        <div class="section-header">
          <h2 class="section-title">Featured Products</h2>
          <p class="section-subtitle">Handpicked items that our customers love</p>
        </div>
        <div class="products-grid">
          ${products.map(product => this.renderProductCard(product)).join('')}
        </div>
        <div class="section-footer">
          <a href="/products" class="btn btn-outline btn-lg">View All Products</a>
        </div>
      `;

      sectionElement.innerHTML = gridHTML;
    },

    /**
     * Render collection grid
     */
    renderCollectionGrid(sectionElement, data) {
      const collections = data.data || data.collections || [];
      
      if (collections.length === 0) {
        sectionElement.innerHTML = this.getEmptyStateHTML('collections');
        return;
      }

      const gridHTML = `
        <div class="section-header">
          <h2 class="section-title">Shop by Collection</h2>
          <p class="section-subtitle">Curated collections to help you find exactly what you're looking for</p>
        </div>
        <div class="collections-grid">
          ${collections.map(collection => this.renderCollectionCard(collection)).join('')}
        </div>
      `;

      sectionElement.innerHTML = gridHTML;
    },

    /**
     * Render related products
     */
    renderRelatedProducts(sectionElement, data) {
      const products = data.products || data.data || [];
      
      if (products.length === 0) {
        sectionElement.remove();
        return;
      }

      const gridHTML = `
        <div class="section-header">
          <h2 class="section-title">You May Also Like</h2>
          <p class="section-subtitle">Complete your look with these items</p>
        </div>
        <div class="products-grid products-grid-4">
          ${products.map(product => this.renderProductCard(product, 'related')).join('')}
        </div>
      `;

      sectionElement.innerHTML = gridHTML;
    },

    /**
     * Render a single product card
     * Matches the structure of snippets/product-card.liquid
     */
    renderProductCard(product, variant = 'default') {
      const imageUrl = product.images?.[0] || product.thumbnailImage || product.image || '/assets/default/placeholder-product.png';
      const price = this.formatPrice(product.prices?.priceString || product.prices?.price || product.price);
      const comparePrice = product.prices?.mrp && product.prices.mrp > product.prices.price 
        ? this.formatPrice(product.prices.mrpString || product.prices.mrp) 
        : null;
      const slug = product.slug || product.handle || product.id;
      const available = product.stockQuantity > 0 || product.inStock || product.available !== false;
      const showSaleBadge = product.prices?.mrp && product.prices.mrp > product.prices.price;

      return `
        <div class="product-card" 
             data-price="${product.prices?.price || product.price}" 
             data-name="${this.escapeHtml((product.name || product.title || '').toLowerCase())}"
             data-availability="${available ? 'in-stock' : 'out-of-stock'}"
             data-brand="${this.escapeHtml((product.brandName || product.vendor || '').toLowerCase())}">
          
          <div class="product-image-container">
            <a href="/${slug}" class="product-image-link">
              <img src="${imageUrl}" 
                   alt="${this.escapeHtml(product.name || product.title)}" 
                   class="product-image" 
                   loading="lazy">
            </a>
            
            <!-- Product Badges -->
            <div class="product-badges">
              ${showSaleBadge ? '<span class="product-badge product-badge-sale">Sale</span>' : ''}
            </div>
            
            <!-- Product Actions -->
            <div class="product-actions">
              <button class="product-action-btn quick-view-btn" data-product-id="${product.productId || product.id}" aria-label="Quick view">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="product-action-btn wishlist-btn" data-product-id="${product.productId || product.id}" aria-label="Add to wishlist">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="product-content">
            <h3 class="product-title">
              <a href="/${slug}">
                ${this.escapeHtml(product.name || product.title)}
              </a>
            </h3>
            
            <div class="product-price">
              <span class="product-price-current">${price}</span>
              ${comparePrice ? `<span class="product-price-original">${comparePrice}</span>` : ''}
            </div>
            
            ${product.shortDescription ? `<p class="product-description">${this.truncate(product.shortDescription, 80)}</p>` : ''}
            
            <div class="product-actions-bottom">
              <button class="btn btn-primary add-to-cart-btn" data-product-id="${product.productId || product.id}" ${!available ? 'disabled' : ''}>
                ${available ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>
          </div>
        </div>
      `;
    },

    /**
     * Render a single collection card
     */
    renderCollectionCard(collection) {
      const imageUrl = collection.image || '/assets/default/placeholder-collection.png';
      const slug = collection.slug || collection.handle || collection.id;
      const productCount = collection.productCount || collection.products_count || 0;

      return `
        <div class="collection-card">
          <div class="collection-image-container">
            <img src="${imageUrl}" alt="${this.escapeHtml(collection.title || collection.name)}" loading="lazy">
            <div class="collection-overlay">
              <a href="/collections/${slug}" class="collection-link">View Collection</a>
            </div>
          </div>
          <div class="collection-content">
            <h3 class="collection-title">
              <a href="/collections/${slug}">${this.escapeHtml(collection.title || collection.name)}</a>
            </h3>
            ${collection.description ? `<p class="collection-description">${this.truncate(collection.description, 120)}</p>` : ''}
            <div class="collection-meta">
              <span class="collection-count">${productCount} products</span>
            </div>
          </div>
        </div>
      `;
    },

    /**
     * Render generic section (fallback)
     */
    renderGenericSection(sectionElement, data) {
      console.log('[AsyncSectionLoader] Using generic renderer for:', data);
      sectionElement.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    },

    /**
     * Get empty state HTML
     */
    getEmptyStateHTML(type) {
      const messages = {
        products: {
          title: 'No Products Found',
          message: 'Check back soon for new products!'
        },
        collections: {
          title: 'No Collections Available',
          message: 'We are working on adding new collections.'
        }
      };

      const msg = messages[type] || messages.products;

      return `
        <div class="empty-state">
          <h3>${msg.title}</h3>
          <p>${msg.message}</p>
        </div>
      `;
    },

    /**
     * Handle section loading error
     */
    handleError(sectionElement, sectionName, error) {
      console.error(`[AsyncSectionLoader] Error in section ${sectionName}:`, error);
      
      sectionElement.innerHTML = `
        <div class="section-error">
          <p>Unable to load this section. <button class="btn-link" onclick="location.reload()">Refresh page</button></p>
        </div>
      `;
      
      sectionElement.classList.add('async-error');
    },

    /**
     * Trigger custom event when section is loaded
     */
    triggerLoadedEvent(sectionElement, sectionName, data) {
      const event = new CustomEvent('async-section-loaded', {
        detail: { sectionName, data },
        bubbles: true
      });
      sectionElement.dispatchEvent(event);
      console.log(`[AsyncSectionLoader] Triggered event for: ${sectionName}`);
    },

    /**
     * Utility: Delay promise
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Utility: Format price
     */
    formatPrice(price) {
      if (typeof price === 'number') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(price / 100);
      }
      return price;
    },

    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Utility: Truncate text
     */
    truncate(text, length) {
      // Strip HTML tags first
      const strippedText = text.replace(/<[^>]*>/g, '');
      if (strippedText.length <= length) return this.escapeHtml(strippedText);
      return this.escapeHtml(strippedText.substring(0, length)) + '...';
    }
  };

  // Make available globally
  window.AsyncSectionLoader = AsyncSectionLoader;

  console.log('[AsyncSectionLoader] Module loaded');

})();

