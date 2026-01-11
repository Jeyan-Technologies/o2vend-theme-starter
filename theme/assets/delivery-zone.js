/**
 * Delivery Zone Selection JavaScript
 * Handles modal interactions, API calls, and zone selection
 */

(function() {
  'use strict';

  // DOM elements - will be set in init()
  let modal;
  let overlay;
  let closeBtn;
  let form;
  let zipcodeInput;
  let citySelect;
  let searchResults;
  let detectBtn;
  let errorDiv;
  let loadingDiv;
  let loadingCitiesDiv;

  // State
  let searchTimeout;
  let currentMode = 0; // 0=Zipcode, 1=City, 2=AutoDetect

  // Initialize
  function init() {
    // Get DOM elements now that they should be available
    modal = document.getElementById('delivery-zone-modal');
    overlay = modal?.querySelector('[data-zone-overlay]');
    closeBtn = modal?.querySelector('[data-zone-close]');
    form = document.getElementById('delivery-zone-form');
    zipcodeInput = document.getElementById('delivery-zone-zipcode');
    citySelect = document.getElementById('delivery-zone-city');
    searchResults = document.getElementById('delivery-zone-search-results');
    detectBtn = document.getElementById('detect-location-btn');
    errorDiv = document.getElementById('delivery-zone-error');
    loadingDiv = document.getElementById('delivery-zone-loading');
    loadingCitiesDiv = document.getElementById('delivery-zone-loading-cities');
    
    if (!modal) {
      return;
    }

    // Show modal on first visit if configured
    const showModalValue = modal.dataset.showModal;
    const showModal = showModalValue === 'true' || showModalValue === true;
    
    if (showModal) {
      setTimeout(() => {
        openModal();
      }, 500);
    }

    // Event listeners
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);
    
    // Form submission
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }

    // Zipcode search with autocomplete
    if (zipcodeInput) {
      zipcodeInput.addEventListener('input', handleZipcodeSearch);
      zipcodeInput.addEventListener('focus', handleZipcodeFocus);
    }

    // Geolocation for AutoDetect mode
    if (detectBtn) {
      detectBtn.addEventListener('click', handleGeolocation);
    }

    // City selector initialization
    if (citySelect) {
      loadCities();
    }

    // Header zone selector (if exists)
    const headerZoneBtn = document.querySelector('[data-zone-toggle]');
    if (headerZoneBtn) {
      headerZoneBtn.addEventListener('click', openModal);
    }

    // Detect mode from DOM
    if (zipcodeInput && searchResults) {
      currentMode = 0; // Zipcode mode
    } else if (citySelect) {
      currentMode = 1; // City mode
    } else if (detectBtn) {
      currentMode = 2; // AutoDetect mode
    }
  }

  // Modal functions
  function openModal() {
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Focus first input
      setTimeout(() => {
        if (zipcodeInput) {
          zipcodeInput.focus();
        } else if (citySelect) {
          citySelect.focus();
        }
      }, 100);
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      
      // Clear form state
      if (searchResults) {
        searchResults.style.display = 'none';
      }
      if (errorDiv) {
        errorDiv.style.display = 'none';
      }
    }
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    showLoading(true);
    hideError();

    let zoneId = null;
    let zipcode = null;

    try {
      if (currentMode === 0) {
        // Zipcode mode
        zipcode = zipcodeInput.value.trim();
        if (!zipcode) {
          throw new Error('Please enter a valid zipcode');
        }

        // Get zone by zipcode
        const response = await fetch(`/webstoreapi/delivery-zone/by-zipcode/${zipcode}`);
        const data = await response.json();

        if (!data.success || !data.data || data.data.length === 0) {
          throw new Error('No delivery zones found for this zipcode');
        }

        zoneId = data.data[0].zoneId;
      } else if (currentMode === 1) {
        // City mode
        zoneId = citySelect.value;
        if (!zoneId) {
          throw new Error('Please select a city');
        }
      } else if (currentMode === 2) {
        // AutoDetect mode - should have been handled by geolocation
        zipcode = zipcodeInput.value.trim();
        if (!zipcode) {
          throw new Error('Please detect location or enter a zipcode');
        }

        const response = await fetch(`/webstoreapi/delivery-zone/by-zipcode/${zipcode}`);
        const data = await response.json();

        if (!data.success || !data.data || data.data.length === 0) {
          throw new Error('No delivery zones found for this zipcode');
        }

        zoneId = data.data[0].zoneId;
      }

      // Set zone cookie
      const setResponse = await fetch('/webstoreapi/delivery-zone/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zoneId, zipcode })
      });

      const setData = await setResponse.json();

      if (!setData.success) {
        throw new Error(setData.error || 'Failed to set delivery zone');
      }

      // Success - reload page to show filtered products
      window.location.reload();
    } catch (error) {
      console.error('Error setting delivery zone:', error);
      showError(error.message);
      showLoading(false);
    }
  }

  // Handle zipcode search with autocomplete
  function handleZipcodeSearch(e) {
    const query = e.target.value.trim();

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < 2) {
      if (searchResults) {
        searchResults.style.display = 'none';
      }
      return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      searchZipcodes(query);
    }, 300);
  }

  function handleZipcodeFocus() {
    // Show recent results if input has value
    if (zipcodeInput && zipcodeInput.value.trim().length >= 2) {
      searchZipcodes(zipcodeInput.value.trim());
    }
  }

  async function searchZipcodes(query) {
    try {
      const response = await fetch(`/webstoreapi/delivery-zone/search-zipcodes?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!searchResults) return;

      if (!data.success || !data.data || data.data.length === 0) {
        searchResults.innerHTML = `
          <div class="delivery-zone-search-empty">
            No locations found
          </div>
        `;
        searchResults.style.display = 'block';
        return;
      }

      // Render results
      searchResults.innerHTML = data.data.map(result => `
        <div class="delivery-zone-search-result" data-zipcode="${result.zipcode}">
          <div class="delivery-zone-result-zipcode">${result.zipcode}</div>
          ${result.displayName ? `<div class="delivery-zone-result-details">${result.displayName}</div>` : ''}
        </div>
      `).join('');

      // Add click handlers
      const resultItems = searchResults.querySelectorAll('.delivery-zone-search-result');
      resultItems.forEach(item => {
        item.addEventListener('click', () => {
          const zipcode = item.dataset.zipcode;
          zipcodeInput.value = zipcode;
          searchResults.style.display = 'none';
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
      });

      searchResults.style.display = 'block';
    } catch (error) {
      console.error('Error searching zipcodes:', error);
      if (searchResults) {
        searchResults.style.display = 'none';
      }
    }
  }

  // Handle geolocation
  function handleGeolocation(e) {
    e.preventDefault();

    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser');
      return;
    }

    detectBtn.disabled = true;
    detectBtn.innerHTML = `
      <div class="spinner-small"></div>
      Detecting...
    `;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to zipcode
          // Note: You may need to implement or use a service for this
          // For now, show error asking user to enter manually
          showError('Please enter your zipcode manually. Geolocation to zipcode conversion coming soon.');
          detectBtn.disabled = false;
          detectBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M2 12h20"/>
            </svg>
            Detect My Location
          `;
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          showError('Could not determine your location. Please enter zipcode manually.');
          detectBtn.disabled = false;
          detectBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M2 12h20"/>
            </svg>
            Detect My Location
          `;
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        showError('Could not detect your location. Please enter zipcode manually.');
        detectBtn.disabled = false;
        detectBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M2 12h20"/>
          </svg>
          Detect My Location
        `;
      }
    );
  }

  // Load cities
  async function loadCities() {
    if (!citySelect || !loadingCitiesDiv) return;

    try {
      loadingCitiesDiv.classList.add('active');
      const response = await fetch('/webstoreapi/delivery-zone/cities');
      const data = await response.json();

      if (!data.success || !data.data || data.data.length === 0) {
        throw new Error('No cities available');
      }

      // Populate city select
      citySelect.innerHTML = '<option value="">Select a city</option>' +
        data.data.map(city => `
          <option value="${city.zoneId}">
            ${city.zoneName}
          </option>
        `).join('');

      loadingCitiesDiv.classList.remove('active');
    } catch (error) {
      console.error('Error loading cities:', error);
      if (citySelect) {
        citySelect.innerHTML = '<option value="">Error loading cities</option>';
      }
      loadingCitiesDiv.classList.remove('active');
    }
  }

  // Utility functions
  function showLoading(show) {
    if (loadingDiv) {
      loadingDiv.style.display = show ? 'flex' : 'none';
    }
  }

  function showError(message) {
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  function hideError() {
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Close modal on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeModal();
    }
  });

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

