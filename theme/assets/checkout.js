/**
 * O2VEND Checkout - Main logic
 * Expects globals from inline config: CHECKOUT_TOKEN, CHECKOUT_PRICING, STATES_DATA, COUNTRIES_DATA,
 * CHECKOUT_SHIPPING_STATE, CHECKOUT_BILLING_STATE, CHECKOUT_SHIPPING_METHOD_HANDLE, CHECKOUT_CURRENCY_SYMBOL
 */
(() => {
  const _log = console.log.bind(console);
  const percentDecode = (s) => {
    if (typeof s !== 'string') return s || '';
    try {
      return s.replace(/\+/g, ' ').replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    } catch {
      return s;
    }
  };
  const debugLog = (...args) => { if (window.DEBUG_CHECKOUT) _log.apply(console, args); };
  debugLog('[CHECKOUT] Checkout pricing data:', typeof CHECKOUT_PRICING !== 'undefined' ? CHECKOUT_PRICING : null);
  debugLog('[CHECKOUT] Cart totals:', {
    total: typeof CHECKOUT_CART_TOTAL !== 'undefined' ? CHECKOUT_CART_TOTAL : 0,
    subTotal: typeof CHECKOUT_CART_SUBTOTAL !== 'undefined' ? CHECKOUT_CART_SUBTOTAL : 0,
    taxAmount: typeof CHECKOUT_CART_TAX !== 'undefined' ? CHECKOUT_CART_TAX : 0
  });

  // Flag to prevent API calls during checkout completion
  window.checkoutInProgress = false;
  window.checkoutSubmitLock = false;
  window.activeCheckoutToken = window.activeCheckoutToken || null;
  
  // Status tracking for API calls
  window.checkoutApiStatus = {
    shippingAddress: 'idle',
    billingAddress: 'idle',
    shippingMethodsFetch: 'idle',
    shippingMethodUpdate: 'idle',
    orderNote: 'idle'
  };
  
  // Track if shipping method has been selected/updated
  window.shippingMethodSelected = false;
  window.shippingMethodAutoUpdateInProgress = false;
  
  // Initialize payment gateway event system early (before apps try to use it)
  window.checkoutPaymentEvents = (() => {
    const events = {};
    return {
      emit: (eventName, data) => {
        debugLog('[CHECKOUT] Emitting payment event:', eventName, data);
        if (!events[eventName]) {
          events[eventName] = [];
        }
        events[eventName].forEach((handler) => {
          try {
            handler(data);
          } catch (error) {
            console.error('[CHECKOUT] Error in payment event handler:', error);
          }
        });
      },
      on: (eventName, handler) => {
        if (!events[eventName]) {
          events[eventName] = [];
        }
        events[eventName].push(handler);
        debugLog('[CHECKOUT] Registered listener for payment event:', eventName);
      },
      off: (eventName, handler) => {
        if (events[eventName]) {
          events[eventName] = events[eventName].filter(h => h !== handler);
        }
      }
    };
  })();
  
  // Check if shipping methods are required (section exists and has methods)
  const isShippingMethodRequired = () => {
    const container = document.getElementById('shipping-methods-container');
    
    // Check if container has shipping method radio buttons
    if (container) {
      const shippingMethodRadios = container.querySelectorAll('input[type="radio"][name^="shippingMethod"]');
      return shippingMethodRadios.length > 0;
    }
    
    return false;
  }
  
  // Update checkout button state based on pending API calls and shipping method selection
  function updateCheckoutButtonState() {
    const submitBtn = document.getElementById('checkout-submit');
    if (!submitBtn) return;
    
    const buttonText = submitBtn.querySelector('.checkout-button-text');
    const buttonIcon = submitBtn.querySelector('.checkout-button-icon');
    const originalText = submitBtn.getAttribute('data-original-text') || 'Complete Order';
    
    const hasPendingCalls = Object.values(window.checkoutApiStatus).some(status => status === 'pending');
    
    // Check if shipping address is complete
    const shippingAddressComplete = isShippingAddressComplete();
    
    // Check if shipping method is required and not selected
    const shippingMethodRequired = isShippingMethodRequired();
    const shippingMethodNotSelected = shippingMethodRequired && !window.shippingMethodSelected;
    
    // Determine status message based on pending operations (priority order)
    let statusMessage = null;
    
    if (window.checkoutApiStatus.shippingMethodUpdate === 'pending') {
      statusMessage = 'Calculating shipping fee...';
    } else if (window.checkoutApiStatus.shippingMethodsFetch === 'pending') {
      statusMessage = 'Loading shipping options...';
    } else if (window.checkoutApiStatus.shippingAddress === 'pending') {
      statusMessage = 'Updating shipping address...';
    } else if (window.checkoutApiStatus.billingAddress === 'pending') {
      statusMessage = 'Updating billing address...';
    } else if (window.checkoutApiStatus.orderNote === 'pending') {
      statusMessage = 'Saving order note...';
    } else if (!shippingAddressComplete) {
      statusMessage = 'Please complete your shipping address';
    } else if (shippingMethodNotSelected) {
      statusMessage = 'Please select a shipping method';
    }
    
    // Decide if the button should be disabled for this state
    // Disable if: pending calls, incomplete address, or missing shipping method
    const shouldDisable = hasPendingCalls || !shippingAddressComplete || shippingMethodNotSelected;
    submitBtn.disabled = shouldDisable;
    
    // If we are disabling the button but don't have a specific reason,
    // show a generic fallback message so the user always sees some context.
    if (!statusMessage && shouldDisable) {
      statusMessage = 'Updating checkout...';
    }
    
    if (statusMessage && buttonText) {
      buttonText.textContent = statusMessage;
      // Add loading class for visual feedback
      submitBtn.classList.add('checkout-button-loading');
      // Optionally show spinner by rotating icon
      if (buttonIcon) {
        buttonIcon.style.animation = 'spin 1s linear infinite';
      }
    } else if (buttonText) {
      // Restore original text
      buttonText.textContent = originalText;
      submitBtn.classList.remove('checkout-button-loading');
      // Remove spinner animation
      if (buttonIcon) {
        buttonIcon.style.animation = '';
      }
    }
  }
  
  /**
   * Get checkout token from server context, URL, or cookie
   * This function is used by multiple checkout functions
   * Exposed globally for apps to use
   */
  window.getCheckoutToken = function getCheckoutToken() {
    if (window.activeCheckoutToken) {
      return window.activeCheckoutToken;
    }

    // First, try to use the token from server-side context (most reliable)
    if (typeof CHECKOUT_TOKEN !== 'undefined' && CHECKOUT_TOKEN) {
      return CHECKOUT_TOKEN;
    }
    
    // Check URL parameter (hosted checkout: /checkout/{token})
    const pathParts = window.location.pathname.split('/');
    const tokenIndex = pathParts.indexOf('checkout');
    if (tokenIndex !== -1 && tokenIndex < pathParts.length - 1) {
      const tokenFromPath = pathParts[tokenIndex + 1];
      if (tokenFromPath && tokenFromPath !== 'checkout') {
        return tokenFromPath;
      }
    }
    
    // Fallback to cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'checkoutToken') {
        return percentDecode(value);
      }
    }
    return null;
  }

  function updateCheckoutTokenFromApi(result) {
    const nextToken = result?.checkoutToken || result?.data?.checkoutToken || null;
    if (nextToken && nextToken !== window.activeCheckoutToken) {
      console.warn('[CHECKOUT] Checkout token refreshed/recovered');
      window.activeCheckoutToken = nextToken;
    }
  }

  function getCheckoutApiErrorMessage(result, fallbackMessage) {
    if (result && typeof result.error === 'string' && result.error.trim()) {
      return result.error;
    }
    return fallbackMessage || 'Checkout request failed. Please try again.';
  }

  function resolveCheckoutErrorMessage(result, fallbackMessage) {
    const code = result?.code || result?.errorCode || '';
    const rawMessage = getCheckoutApiErrorMessage(result, fallbackMessage);
    const normalized = String(rawMessage || '').toLowerCase();
    if (code === 'CHECKOUT_TOKEN_EXPIRED' || normalized.includes('expired')) {
      return 'Your checkout session expired. We refreshed your session. Please review details and continue.';
    }
    if (code === 'CHECKOUT_STALE' || normalized.includes('another device') || normalized.includes('cart/checkout state changed')) {
      return 'Your cart changed on another device. Please review your cart and continue checkout.';
    }
    if (code === 'CHECKOUT_ALREADY_PROCESSING' || normalized.includes('already being processed')) {
      return 'Your order is already being processed. Please wait a few seconds.';
    }
    if (normalized.includes('signature') && normalized.includes('invalid')) {
      return 'Checkout security validation failed once and was retried. Please try again if needed.';
    }
    return rawMessage || 'Checkout request failed. Please try again.';
  }
  
  /**
   * Button loading utility function
   * Handles button loading states with optional loading text
   * Supports both checkout-button-text and btn-text class naming conventions
   */
  function setButtonLoading(button, loading, loadingText = null) {
    if (!button) return;
    
    // Support both checkout-button-text and btn-text class names
    const btnText = button.querySelector('.checkout-button-text') || 
                    button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (loading) {
      button.disabled = true;
      button.classList.add('loading');
      if (btnText) btnText.style.display = 'none';
      if (btnLoading) {
        btnLoading.style.display = 'flex';
        if (loadingText && btnLoading.querySelector('span:last-child')) {
          btnLoading.querySelector('span:last-child').textContent = loadingText;
        }
      } else if (loadingText) {
        button.textContent = loadingText;
      }
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      if (btnText) btnText.style.display = 'inline';
      if (btnLoading) btnLoading.style.display = 'none';
    }
  }

  // STATES_DATA and COUNTRIES_DATA set by inline config in checkout.liquid
  
  // Debug: Log states data structure
  debugLog('[CHECKOUT] States data:', STATES_DATA);
  debugLog('[CHECKOUT] Countries data:', COUNTRIES_DATA);
  
  // Helper to get states for a country (by ID or code)
  function getStatesForCountry(countryIdentifier) {
    if (!countryIdentifier) return null;
    
    // Try to parse as number (country ID)
    const countryId = parseInt(countryIdentifier, 10);
    const isNumericId = !isNaN(countryId);
    
    const codeUpper = String(countryIdentifier).toUpperCase();
    const codeLower = String(countryIdentifier).toLowerCase();
    
    debugLog('[CHECKOUT] Looking for states for country:', countryIdentifier, isNumericId ? '(ID)' : '(code)');
    debugLog('[CHECKOUT] COUNTRIES_DATA:', COUNTRIES_DATA);
    
    // First, check if countries array has statesOrProvinces
    // The structure is: countries array with objects containing id, code2 and statesOrProvinces
    if (Array.isArray(COUNTRIES_DATA) && COUNTRIES_DATA.length > 0) {
      const country = COUNTRIES_DATA.find(c => {
        // Match by ID first (if identifier is numeric)
        if (isNumericId) {
          const cId = c.id || c.countryId;
          if (cId === countryId || String(cId) === String(countryId)) {
            return true;
          }
        }
        
        // Match by code2 (primary), code, countryCode, or name
        const cCode2 = c.code2 || '';
        const cCode = c.code || '';
        const cCountryCode = c.countryCode || '';
        const cName = c.name || '';
        
        return cCode2.toUpperCase() === codeUpper ||
               cCode2.toLowerCase() === codeLower ||
               cCode.toUpperCase() === codeUpper ||
               cCode.toLowerCase() === codeLower ||
               cCountryCode.toUpperCase() === codeUpper ||
               cCountryCode.toLowerCase() === codeLower ||
               cName === countryIdentifier;
      });
      
      if (country) {
        debugLog('[CHECKOUT] Found country:', country);
        // Check for statesOrProvinces property
        if (country.statesOrProvinces && Array.isArray(country.statesOrProvinces)) {
          debugLog('[CHECKOUT] Found statesOrProvinces with', country.statesOrProvinces.length, 'states');
          return country.statesOrProvinces;
        }
        if (country.states && Array.isArray(country.states)) {
          debugLog('[CHECKOUT] Found states with', country.states.length, 'states');
          return country.states;
        }
      } else {
        debugLog('[CHECKOUT] Country not found in COUNTRIES_DATA for:', countryIdentifier);
      }
    }
    
    // Fallback: Check if STATES_DATA is an object with country codes as keys (e.g., {IN: [...], US: [...]})
    if (STATES_DATA && typeof STATES_DATA === 'object' && !Array.isArray(STATES_DATA)) {
      // Try exact match
      if (STATES_DATA[countryIdentifier]) {
        return STATES_DATA[countryIdentifier];
      }
      if (STATES_DATA[codeUpper]) {
        return STATES_DATA[codeUpper];
      }
      if (STATES_DATA[codeLower]) {
        return STATES_DATA[codeLower];
      }
      
      // Try case-insensitive match
      for (const key in STATES_DATA) {
        if (key.toUpperCase() === codeUpper || key.toLowerCase() === codeLower) {
          return STATES_DATA[key];
        }
      }
    }
    
    return null;
  }
  
  // Convert state dropdown to text input when no states are available
  let convertStateToTextInput = (stateSelect, selectedState = null) => {
    if (!stateSelect) return;
    
    const formGroup = stateSelect.closest('.form-group');
    if (!formGroup) return;
    
    // Check if already converted
    if (stateSelect.tagName === 'INPUT') return;
    
    // Find or create text input (we have both select and input in the template)
    let textInput = document.getElementById('shipping-state-text');
    if (!textInput) {
      // Create text input if it doesn't exist
      textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.id = stateSelect.id + '-text';
      textInput.name = stateSelect.name;
      textInput.className = 'form-input';
      textInput.required = true;
      textInput.placeholder = 'Enter state/province';
      formGroup.appendChild(textInput);
    }
    
    // Hide select and show text input
    stateSelect.style.display = 'none';
    stateSelect.removeAttribute('required');
    textInput.style.display = 'block';
    textInput.required = true;
    
    if (selectedState) {
      textInput.value = selectedState;
    }
    
    debugLog('[CHECKOUT] Converted state dropdown to text input for country without states');
  }
  
  // Populate states dropdown based on selected country
  function populateStates(countrySelect, stateSelect, selectedState = null) {
    if (!stateSelect || !countrySelect) {
      console.warn('[CHECKOUT] Missing country or state select element');
      return;
    }
    
    const countryIdentifier = countrySelect.value;
    debugLog('[CHECKOUT] Populating states for country:', countryIdentifier);
    
    // Clear existing options
    stateSelect.innerHTML = '<option value="">Select a state</option>';
    
    if (!countryIdentifier) {
      debugLog('[CHECKOUT] No country selected');
      return;
    }
    
    // Try to find states for this country (by ID or code) using helper function
    let countryStates = getStatesForCountry(countryIdentifier);
    
    if (countryStates) {
      debugLog('[CHECKOUT] Found states for country:', countryIdentifier, countryStates);
    }
    
    if (!countryStates) {
      debugLog('[CHECKOUT] No states found for country:', countryIdentifier);
      // If no states found, convert dropdown to text input
      convertStateToTextInput(stateSelect, selectedState);
      return;
    }
    
    debugLog('[CHECKOUT] Found states for country:', countryStates);
    
    // Handle different data structures
    let statesArray = [];
    
    if (Array.isArray(countryStates)) {
      // Array format: [{code: 'CA', name: 'California'}, ...]
      statesArray = countryStates;
    } else if (typeof countryStates === 'object') {
      // Object format: {CA: 'California', NY: 'New York'} or {states: [...]}
      if (countryStates.states && Array.isArray(countryStates.states)) {
        statesArray = countryStates.states;
      } else {
        // Convert object to array
        statesArray = Object.entries(countryStates).map(([code, name]) => ({
          code: code,
          name: typeof name === 'string' ? name : (name.name || name.code || code)
        }));
      }
    }
    
    // De-duplicate states to avoid repeated options when upstream data contains duplicates.
    const seenStateKeys = new Set();
    const uniqueStates = [];
    statesArray.forEach((state) => {
      const stateCode = state && (state.code || state.abbreviation || state.isoCode || '');
      const stateName = state && (state.name || state.label || '');
      const normalizedCode = String(stateCode).trim().toLowerCase();
      const normalizedName = String(stateName).trim().toLowerCase().replace(/\s+/g, ' ');
      const key = normalizedCode ? `code:${normalizedCode}` : `name:${normalizedName}`;

      if (!seenStateKeys.has(key)) {
        seenStateKeys.add(key);
        uniqueStates.push(state);
      }
    });

    // Populate the dropdown
    uniqueStates.forEach(state => {
      const option = document.createElement('option');
      // Handle state object structure: {id: 1, name: 'Andaman and Nicobar Islands', code: 'IN-AN'}
      const stateId = state.id || state.stateOrProvinceId || state.stateId;
      const stateCode = state.code || (typeof state === 'string' ? state : Object.keys(state)[0]);
      const stateName = state.name || state.label || (typeof state === 'string' ? state : state[stateCode]) || stateCode;
      
      // Use stateId as the value (required by API)
      option.value = stateId ? String(stateId) : stateCode;
      option.textContent = stateName;
      if (stateId) {
        option.dataset.stateId = String(stateId);
      }
      
      // Check if this should be selected
      if (selectedState) {
        const selectedStateStr = String(selectedState).toLowerCase();
        const stateIdStr = stateId ? String(stateId).toLowerCase() : '';
        const stateCodeStr = String(stateCode).toLowerCase();
        const stateNameStr = String(stateName).toLowerCase();
        
        if (stateIdStr && stateIdStr === selectedStateStr) {
          option.selected = true;
        } else if (stateCodeStr === selectedStateStr || 
            stateNameStr === selectedStateStr ||
            stateCodeStr.includes(selectedStateStr) ||
            stateNameStr.includes(selectedStateStr)) {
          option.selected = true;
        }
      }
      
      stateSelect.appendChild(option);
    });
    
    debugLog('[CHECKOUT] Populated', uniqueStates.length, 'states');
  }
  
  // Initialize states dropdowns when DOM is ready
  function initializeStateDropdowns() {
    debugLog('[CHECKOUT] initializeStateDropdowns() called');
    const shippingCountrySelect = document.getElementById('shipping-country');
    const shippingStateSelect = document.getElementById('shipping-state');
    const billingCountrySelect = document.getElementById('billing-country');
    const billingStateSelect = document.getElementById('billing-state');
    
    debugLog('[CHECKOUT] Country select:', shippingCountrySelect);
    debugLog('[CHECKOUT] State select:', shippingStateSelect);
    debugLog('[CHECKOUT] Selected country value:', shippingCountrySelect?.value);
    
    if (!shippingCountrySelect || !shippingStateSelect) {
      console.warn('[CHECKOUT] Shipping country/state selects not found');
      return;
    }
    
    // Populate shipping states on page load
    const initShippingStates = () => {
      const selectedCountry = shippingCountrySelect.value;
      // Try to get stateOrProvinceId first, fallback to province name/code
      const selectedState = typeof CHECKOUT_SHIPPING_STATE !== 'undefined' ? CHECKOUT_SHIPPING_STATE : null;
      
      debugLog('[CHECKOUT] Initializing shipping states. Country:', selectedCountry, 'State:', selectedState);
      
      if (selectedCountry) {
        debugLog('[CHECKOUT] Calling populateStates for country:', selectedCountry);
        try {
          populateStates(shippingCountrySelect, shippingStateSelect, selectedState);
          debugLog('[CHECKOUT] populateStates completed');
        } catch (error) {
          console.error('[CHECKOUT] Error in populateStates:', error);
        }
        
        // After populating states, check if address is complete and fetch shipping methods
        setTimeout(() => {
          if (typeof checkAndFetchShippingMethods === 'function') {
            checkAndFetchShippingMethods();
          }
        }, 200);
      }
    };
    
    // Initialize immediately if country is already selected
    if (shippingCountrySelect.value) {
      initShippingStates();
    } else {
      // Only use setTimeout if country is not already selected (to wait for DOM)
      setTimeout(initShippingStates, 100);
    }
    
    // Handle country change
    shippingCountrySelect.addEventListener('change', (e) => {
      debugLog('[CHECKOUT] Shipping country changed to:', e.target.value);
      populateStates(shippingCountrySelect, shippingStateSelect);
      // Trigger address update to fetch shipping methods
      if (typeof checkAndFetchShippingMethods === 'function') {
        checkAndFetchShippingMethods();
      }
    });
    
    // Handle state change
    shippingStateSelect.addEventListener('change', (e) => {
      debugLog('[CHECKOUT] Shipping state changed to:', e.target.value);
      if (typeof checkAndFetchShippingMethods === 'function') {
        checkAndFetchShippingMethods();
      }
    });
    
    // Populate billing states
    if (billingCountrySelect && billingStateSelect) {
      const initBillingStates = () => {
        const selectedCountry = billingCountrySelect.value;
        const selectedState = typeof CHECKOUT_BILLING_STATE !== 'undefined' ? CHECKOUT_BILLING_STATE : null;
        
        debugLog('[CHECKOUT] Initializing billing states. Country:', selectedCountry, 'State:', selectedState);
        
        if (selectedCountry) {
          populateStates(billingCountrySelect, billingStateSelect, selectedState);
        }
      };
      
      // Initialize immediately if country is already selected
      if (billingCountrySelect.value) {
        initBillingStates();
      }
      
      // Also initialize after a short delay
      setTimeout(initBillingStates, 100);
      
      // Handle country change
        billingCountrySelect.addEventListener('change', (e) => {
        debugLog('[CHECKOUT] Billing country changed to:', e.target.value);
        populateStates(billingCountrySelect, billingStateSelect);
      });
    }
  }
  
  // Initialize intl-tel-input for shipping phone
  function initializePhoneInput() {
    debugLog('[CHECKOUT] initializePhoneInput() called');
    const shippingPhoneInput = document.getElementById('shipping-phone');
    debugLog('[CHECKOUT] shippingPhoneInput element:', shippingPhoneInput);
    debugLog('[CHECKOUT] intlTelInput available:', typeof intlTelInput !== 'undefined');
    
    if (!shippingPhoneInput) {
      console.warn('[CHECKOUT] shipping-phone input element not found');
      return;
    }
    
    if (typeof intlTelInput === 'undefined') {
      console.warn('[CHECKOUT] intlTelInput library not loaded yet');
      return;
    }
    
    if (shippingPhoneInput && typeof intlTelInput !== 'undefined') {
      // Get existing phone number value
      const existingPhone = shippingPhoneInput.value || '';
      
      // Check the country select value synchronously before initializing
      const countrySelect = document.getElementById('shipping-country');
      let initialCountry = 'auto';
      if (countrySelect && countrySelect.value) {
        const countryCode = countrySelect.options[countrySelect.selectedIndex]?.getAttribute('data-country-code2');
        if (countryCode) {
          initialCountry = countryCode.toLowerCase();
        }
      }
      
      // Build configuration object for intl-tel-input
      const itiConfig = {
        utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.0/build/js/utils.js',
        initialCountry: initialCountry,
        preferredCountries: ['us', 'gb', 'ca', 'au', 'in'],
        separateDialCode: true,
        nationalMode: false,
        // Render outside clipping/overflow parents so country list stays clickable.
        dropdownContainer: document.body
      };
      
      // Only include geoIpLookup when using auto-detection
      if (initialCountry === 'auto') {
        itiConfig.geoIpLookup = (callback) => {
          // Try to get country from shipping address country select (use outer scope variable)
          if (countrySelect && countrySelect.value) {
            const countryCode = countrySelect.options[countrySelect.selectedIndex]?.getAttribute('data-country-code2');
            if (countryCode) {
              callback(countryCode.toLowerCase());
              return;
            }
          }
          // Fallback to auto-detection via IP
          fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => callback(data.country_code ? data.country_code.toLowerCase() : 'us'))
            .catch(() => callback('us'));
        };
      }
      
      // Initialize intl-tel-input
      debugLog('[CHECKOUT] Initializing intl-tel-input with config:', itiConfig);
      let iti;
      try {
        iti = intlTelInput(shippingPhoneInput, itiConfig);
        debugLog('[CHECKOUT] intl-tel-input initialized successfully');
      } catch (error) {
        console.error('[CHECKOUT] Error initializing intl-tel-input:', error);
        return;
      }
      
      // Store the instance for later use
      window.shippingPhoneIti = iti;
      
      // Set existing phone number if available (after a small delay to ensure utils are loaded)
      if (existingPhone) {
        // Use setTimeout to ensure utils script has loaded
        setTimeout(() => {
          iti.setNumber(existingPhone);
          // Phone changes will trigger address update, which will fetch shipping methods
        }, 100);
      }
      
      // Update country when shipping country changes (countrySelect already declared above)
      if (countrySelect) {
        countrySelect.addEventListener('change', (e) => {
          const sel = e.target;
          const countryCode = sel.options[sel.selectedIndex]?.getAttribute('data-country-code2');
          if (countryCode) {
            iti.setCountry(countryCode.toLowerCase());
          }
        });
      }
      
      // Add listeners to update button state when phone changes
      shippingPhoneInput.addEventListener('input', () => {
        if (typeof updateCheckoutButtonState === 'function') {
          updateCheckoutButtonState();
        }
      });
      shippingPhoneInput.addEventListener('blur', () => {
        if (typeof updateCheckoutButtonState === 'function') {
          updateCheckoutButtonState();
        }
      });
    }
  }

  // Initialize when DOM is ready
  function initializeCheckout() {
    debugLog('[CHECKOUT] Initializing checkout functions...');
    debugLog('[CHECKOUT] intlTelInput available:', typeof intlTelInput !== 'undefined');
    debugLog('[CHECKOUT] shipping-phone element:', document.getElementById('shipping-phone'));
    debugLog('[CHECKOUT] shipping-country element:', document.getElementById('shipping-country'));
    
    try {
      initializeStateDropdowns();
      debugLog('[CHECKOUT] State dropdowns initialized');
    } catch (error) {
      console.error('[CHECKOUT] Error initializing state dropdowns:', error);
    }
    
    try {
      initializePhoneInput();
      debugLog('[CHECKOUT] Phone input initialized');
    } catch (error) {
      console.error('[CHECKOUT] Error initializing phone input:', error);
    }
    
    // Initialize button state
    if (typeof updateCheckoutButtonState === 'function') {
      updateCheckoutButtonState();
    }
    
    // On first load: ensure address is saved to backend, then fetch shipping methods.
    // The shipping-methods API requires the checkout address to be persisted first.
    // Calling updateShippingAddress() will save the address and, on success, call
    // checkAndFetchShippingMethods(). This fixes the case where shipping options stay
    // "Loading..." until the user blurs a field (which triggers updateShippingAddress).
    const shouldRetryInitialShippingFetch = () => {
      if (!isShippingAddressComplete()) return false;
      if (window.checkoutInProgress) return false;
      if (window.shippingMethodsFetchInProgress) return false;
      if (window.checkoutApiStatus.shippingAddress === 'pending') return false;
      if (window.checkoutApiStatus.shippingMethodsFetch === 'pending') return false;
      if (window.checkoutShippingMethods && window.shippingMethodSelected) return false;
      return true;
    };

    const initialLoadDelay = 1800;
    setTimeout(() => {
      if (!shouldRetryInitialShippingFetch()) return;
      if (typeof updateShippingAddress === 'function') {
        updateShippingAddress();
      } else if (typeof checkAndFetchShippingMethods === 'function') {
        checkAndFetchShippingMethods();
      }
    }, initialLoadDelay);
    // Fallback: if updateShippingAddress returns early (e.g. state not ready), retry
    setTimeout(() => {
      if (typeof checkAndFetchShippingMethods === 'function' && shouldRetryInitialShippingFetch()) {
        checkAndFetchShippingMethods();
      }
    }, initialLoadDelay + 1200);
    // Third retry: handles slow state dropdowns or intl-tel-input init
    setTimeout(() => {
      if (typeof checkAndFetchShippingMethods === 'function' && shouldRetryInitialShippingFetch()) {
        checkAndFetchShippingMethods();
      }
    }, initialLoadDelay + 3200);
  }
  
  // Wait for intl-tel-input to load if needed
  function waitForIntlTelInput(callback, maxAttempts = 20, attempt = 0) {
    if (typeof intlTelInput !== 'undefined') {
      callback();
      return;
    }
    
    if (attempt >= maxAttempts) {
      console.warn('[CHECKOUT] intlTelInput not loaded after', maxAttempts * 100, 'ms, initializing without it');
      callback();
      return;
    }
    
    setTimeout(() => {
      waitForIntlTelInput(callback, maxAttempts, attempt + 1);
    }, 100);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForIntlTelInput(initializeCheckout);
    });
  } else {
    // DOM is already ready
    waitForIntlTelInput(initializeCheckout);
  }

  // Update order summary payment fee and total when payment method changes
  window.updatePaymentFeeDisplay = function updatePaymentFeeDisplay(paymentFee) {
    const feeLine = document.querySelector('[data-summary-payment-fee-line]');
    const feeValueEl = document.querySelector('[data-summary-payment-fee]');
    const totalEl = document.querySelector('[data-summary-total]');
    if (!feeLine || !feeValueEl || !totalEl) return;

    const fee = parseFloat(paymentFee) || 0;
    const oldFeeStr = feeValueEl.textContent.replace(/[^\d.-]/g, '');
    const oldFee = parseFloat(oldFeeStr) || 0;
    const currentTotalStr = totalEl.textContent.replace(/[^\d.-]/g, '');
    const baseTotal = (parseFloat(currentTotalStr) || 0) - oldFee;

    const fmt = typeof formatMoney === 'function' ? formatMoney : (n) => {
      const sym = document.body.dataset.shopCurrencySymbol || (typeof CHECKOUT_CURRENCY_SYMBOL !== 'undefined' ? CHECKOUT_CURRENCY_SYMBOL : '₹');
      return sym + (parseFloat(n) || 0).toFixed(2);
    };
    feeValueEl.textContent = fee > 0 ? fmt(fee) : (document.body.dataset.shopCurrencySymbol || (typeof CHECKOUT_CURRENCY_SYMBOL !== 'undefined' ? CHECKOUT_CURRENCY_SYMBOL : '₹')) + '0.00';
    feeLine.style.display = fee > 0 ? 'flex' : 'none';
    totalEl.textContent = fmt(baseTotal + fee);
  };

  function initPaymentFeeFromSelection() {
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    if (selected && typeof window.updatePaymentFeeDisplay === 'function') {
      const fee = parseFloat(selected.getAttribute('data-payment-fee') || '0') || 0;
      window.updatePaymentFeeDisplay(fee);
    }
  }

  // Dynamically filter gateway payment options using backend payment-app discovery.
  async function applyPaymentAppAvailability() {
    const radios = Array.from(document.querySelectorAll('input[name="paymentMethod"]'));
    if (!radios.length) return;

    const gatewayRadios = radios.filter((radio) => (radio.getAttribute('data-payment-type') || '') === 'PaymentGateway');
    if (!gatewayRadios.length) return;

    try {
      const checkoutToken = getCheckoutToken();
      const endpoint = checkoutToken
        ? `/webstoreapi/payment/apps?token=${encodeURIComponent(checkoutToken)}`
        : '/webstoreapi/payment/apps';
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) return;

      const result = await response.json();
      const apps = Array.isArray(result?.data) ? result.data : [];
      const methodAvailability = new Map();
      apps.forEach((app) => {
        const isAvailable = !!app.available;
        const methodIds = Array.isArray(app.paymentMethodIds) ? app.paymentMethodIds : [];
        methodIds.forEach((methodId) => methodAvailability.set(String(methodId), isAvailable));
      });

      // Guard against partial discovery responses.
      // If backend does not report all gateway ids, keep existing checkout methods visible.
      const gatewayMethodIds = gatewayRadios.map((radio) => String(radio.getAttribute('data-payment-id') || radio.value));
      const hasFullCoverage = gatewayMethodIds.length > 0 && gatewayMethodIds.every((id) => methodAvailability.has(id));
      if (!hasFullCoverage) {
        debugLog('[CHECKOUT] Skipping gateway visibility filter due to partial app discovery response');
        return;
      }

      gatewayRadios.forEach((radio) => {
        const methodId = radio.getAttribute('data-payment-id') || radio.value;
        const isAvailable = methodAvailability.get(String(methodId));
        if (isAvailable === false) {
          radio.disabled = true;
          radio.checked = false;
          const optionContainer = radio.closest('label, .checkout-payment-method, .payment-method-option');
          if (optionContainer) {
            optionContainer.style.display = 'none';
          }
        }
      });

      const selected = document.querySelector('input[name="paymentMethod"]:checked:not(:disabled)');
      if (!selected) {
        const firstEnabled = document.querySelector('input[name="paymentMethod"]:not(:disabled)');
        if (firstEnabled) {
          firstEnabled.checked = true;
          firstEnabled.dispatchEvent(new Event('change'));
        }
      }
    } catch (error) {
      debugLog('[CHECKOUT] Payment app discovery failed, keeping existing payment options:', error.message);
    }
  }

  // Handle payment method selection
  function attachPaymentMethodListeners() {
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const el = e.target;
        const paymentType = el.getAttribute('data-payment-type') || '';
        const paymentId = el.getAttribute('data-payment-id') || el.value;
        const gatewayFormsContainer = document.getElementById('payment-gateway-forms');
        const paymentFee = parseFloat(el.getAttribute('data-payment-fee') || '0') || 0;

        window.updatePaymentFeeDisplay(paymentFee);

        // Emit payment method selected event for apps to listen
        if (window.checkoutPaymentEvents && window.checkoutPaymentEvents.emit) {
          window.checkoutPaymentEvents.emit('payment:method:selected', {
            paymentMethodId: paymentId,
            paymentType: paymentType,
            value: el.value
          });
        }

        // Hide all gateway forms
        if (gatewayFormsContainer) {
          gatewayFormsContainer.innerHTML = '';
          gatewayFormsContainer.style.display = 'none';
        }

        // Show gateway form for PaymentGateway type
        if (paymentType === 'PaymentGateway') {
          loadPaymentGatewayForm(paymentId, gatewayFormsContainer);
        }

        // Hide card form (legacy support)
        const cardForm = document.getElementById('card-payment-form');
        if (cardForm) {
          cardForm.style.display = 'none';
        }
      });

      if (radio.checked) {
        radio.dispatchEvent(new Event('change'));
      }
    });
    initPaymentFeeFromSelection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyPaymentAppAvailability();
      attachPaymentMethodListeners();
      setTimeout(initPaymentFeeFromSelection, 100);
    });
  } else {
    applyPaymentAppAvailability();
    attachPaymentMethodListeners();
    setTimeout(initPaymentFeeFromSelection, 100);
  }

  // Load payment gateway form
  const loadPaymentGatewayForm = async (paymentMethodId, container) => {
    if (!container || !paymentMethodId) return;
    
    try {
      // Check if there's an app snippet for this gateway
      // This would typically be loaded via hook system, but for now we'll handle it client-side
      const gatewayElement = document.querySelector(`[data-gateway-id="${paymentMethodId}"]`);
      if (gatewayElement) {
        // Gateway forms are loaded via app hooks, so we just show the container
        container.style.display = 'block';
      }
    } catch (error) {
      console.error('Error loading payment gateway form:', error);
    }
  }

  // Update shipping address when form fields change (debounced)
  let shippingAddressTimeout;
  const shippingFields = ['shipping-first-name', 'shipping-last-name', 'shipping-address', 'shipping-city', 'shipping-state', 'shipping-state-text', 'shipping-zip', 'shipping-country', 'shipping-phone'];
  
  function attachShippingFieldListeners() {
    const markShippingAddressPending = () => {
      // As soon as the user edits shipping address fields, treat it as a
      // pending update so the checkout button stays disabled until we
      // either send the API call or decide we can't.
      window.checkoutApiStatus.shippingAddress = 'pending';
      updateCheckoutButtonState();
    };

    shippingFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) return;

      // Remove existing listeners by cloning (simple approach)
      const newField = field.cloneNode(true);
      field.parentNode.replaceChild(newField, field);
      
      // Re-attach listeners
      newField.addEventListener('blur', () => {
        markShippingAddressPending();
        updateCheckoutButtonState(); // Update button state immediately on blur
        clearTimeout(shippingAddressTimeout);
        shippingAddressTimeout = setTimeout(async () => {
          await updateShippingAddress();
          // updateShippingAddress will call checkAndFetchShippingMethods() after successful update
        }, 500);
      });
      
      // Also listen to change/input events for select dropdowns and input fields
      if (newField.tagName === 'SELECT' || newField.tagName === 'INPUT') {
        newField.addEventListener('change', () => {
          markShippingAddressPending();
          updateCheckoutButtonState(); // Update button state immediately on change
          clearTimeout(shippingAddressTimeout);
          shippingAddressTimeout = setTimeout(async () => {
            await updateShippingAddress();
            // updateShippingAddress will call checkAndFetchShippingMethods() after successful update
          }, 500);
        });
        if (newField.tagName === 'INPUT') {
          newField.addEventListener('input', () => {
            markShippingAddressPending();
            updateCheckoutButtonState(); // Update button state immediately on input
            clearTimeout(shippingAddressTimeout);
            shippingAddressTimeout = setTimeout(async () => {
              await updateShippingAddress();
            }, 500);
          });
        }
      }
    });
  }
  
  // Attach listeners initially
  attachShippingFieldListeners();
  
  // Re-attach after state field might be converted to text input
  const originalConvertStateToTextInput = convertStateToTextInput;
  convertStateToTextInput = (stateSelect, selectedState) => {
    originalConvertStateToTextInput(stateSelect, selectedState);
    // Re-attach listeners after state field conversion
    setTimeout(attachShippingFieldListeners, 100);
  };
  
  // Helper function to format money using shop settings
  function formatMoney(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0.00';
    }
    
    const num = parseFloat(amount);
    if (isNaN(num)) return String(amount);
    
    // Get currency settings from page data
    const currencySymbol = document.body.dataset.shopCurrencySymbol || window.__SHOP_CURRENCY_SYMBOL__ || (typeof CHECKOUT_CURRENCY_SYMBOL !== 'undefined' ? CHECKOUT_CURRENCY_SYMBOL : '₹');
    const currencyDecimalDigits = 2; // Default to 2 decimal places
    
    // Check if amount is in cents (if > 1000, likely in cents, otherwise might be in actual currency)
    // For now, assume API returns actual currency amounts (not cents) based on double type in schema
    // But handle both cases: if amount seems like cents (> 1000 for typical prices), divide by 100
    let formattedAmount = num;
    
    // If the amount is very large (> 1000), it might be in cents/paise
    // But since API schema shows double (decimal), we'll assume it's already in currency units
    // However, if prices from API seem to be in cents, we can detect and convert
    
    // Format with proper decimal places
    formattedAmount = formattedAmount.toFixed(currencyDecimalDigits);
    
    // Add thousand separators
    formattedAmount = formattedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return currencySymbol + formattedAmount;
  }

  // Check if shipping address is complete
  function isShippingAddressComplete() {
    const requiredFields = [
      'shipping-first-name',
      'shipping-address',
      'shipping-city',
      'shipping-zip',
      'shipping-country'
    ];
    
    // State is optional if no states are available for the country
    const stateField = document.getElementById('shipping-state');
    const stateTextInput = document.getElementById('shipping-state-text');
    const stateRequired = stateField && stateField.tagName === 'SELECT' && stateField.options.length > 1;
    
    const allRequired = requiredFields.every(fieldId => {
      const field = document.getElementById(fieldId);
      return field && field.value && field.value.trim() !== '';
    });
    
    // Check state if required (dropdown with options)
    let stateValid = true;
    if (stateRequired) {
      stateValid = stateField.value && stateField.value.trim() !== '';
    } else if (stateTextInput && stateTextInput.style.display !== 'none') {
      // If state is a text input and visible, it's required
      stateValid = stateTextInput.value && stateTextInput.value.trim() !== '';
    }
    
    // Check phone number (required)
    const phoneField = document.getElementById('shipping-phone');
    let phoneValid = false;
    if (phoneField) {
      phoneValid = (phoneField.value || '').trim() !== '';
    }
    
    return allRequired && stateValid && phoneValid;
  }

  function getCurrentShippingAddressSyncKey() {
    const form = document.getElementById('checkout-form');
    if (!form) return null;
    const formData = new FormData(form);
    const countrySelect = document.getElementById('shipping-country');
    const stateSelect = document.getElementById('shipping-state');
    const stateTextInput = document.getElementById('shipping-state-text');
    let stateOrProvinceId = null;
    if (stateSelect && stateSelect.style.display !== 'none' && stateSelect.value) {
      stateOrProvinceId = stateSelect.value;
    } else if (stateTextInput && stateTextInput.style.display !== 'none' && stateTextInput.value) {
      stateOrProvinceId = stateTextInput.value;
    }
    const payload = {
      shippingFirstName: formData.get('shippingFirstName') || '',
      shippingLastName: formData.get('shippingLastName') || '',
      shippingAddress: formData.get('shippingAddress') || '',
      shippingCity: formData.get('shippingCity') || '',
      shippingZip: formData.get('shippingZip') || '',
      shippingPhone: (formData.get('shippingPhone') || '').toString().trim(),
      countryId: countrySelect ? countrySelect.value : null,
      stateOrProvinceId: stateOrProvinceId
    };
    return JSON.stringify(payload);
  }
  
  // Fetch shipping methods when address is complete
  async function fetchShippingMethods() {
    // Prevent fetching during checkout completion or if already in progress
    if (window.checkoutInProgress || window.shippingMethodsFetchInProgress) {
      debugLog('[CHECKOUT] Skipping shipping methods fetch - checkout in progress or fetch already in progress');
      return;
    }
    if (window.checkoutApiStatus.shippingMethodUpdate === 'pending' || window.shippingMethodAutoUpdateInProgress) {
      debugLog('[CHECKOUT] Skipping shipping methods fetch while shipping method update is in progress');
      return;
    }
    
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      debugLog('[CHECKOUT] No checkout token, skipping shipping methods fetch');
      return;
    }
    
    const fetchAddressKey = window.lastShippingAddressSyncKey || getCurrentShippingAddressSyncKey();
    if (
      fetchAddressKey &&
      window.lastShippingMethodsFetchKey === fetchAddressKey &&
      window.checkoutShippingMethods
    ) {
      debugLog('[CHECKOUT] Skipping shipping methods API call for already-synced address');
      return;
    }

    // Set in-progress flag and create abort controller
    window.shippingMethodsFetchInProgress = true;
    window.shippingMethodsAbortController = new AbortController();
    let shippingFetchTimedOut = false;
    const shippingFetchTimeoutMs = 15000;
    const shippingFetchTimeoutId = setTimeout(() => {
      shippingFetchTimedOut = true;
      if (window.shippingMethodsAbortController) {
        window.shippingMethodsAbortController.abort();
      }
    }, shippingFetchTimeoutMs);
    
    // Track status
    window.checkoutApiStatus.shippingMethodsFetch = 'pending';
    updateCheckoutButtonState();
    
    const isHostedCheckout = window.location.pathname.includes('/checkout/') && 
                             window.location.pathname.split('/').length > 2;
    const endpoint = isHostedCheckout
      ? `/webstoreapi/checkout/${checkoutToken}/shipping-methods`
      : '/webstoreapi/checkout/shipping-methods';
    
    const container = document.getElementById('shipping-methods-container');
    const section = document.getElementById('shipping-methods-section');
    
    if (!container || !section) {
      console.warn('[CHECKOUT] Shipping methods container or section not found');
      window.checkoutApiStatus.shippingMethodsFetch = 'completed';
      updateCheckoutButtonState();
      window.shippingMethodsFetchInProgress = false;
      window.shippingMethodsAbortController = null;
      return;
    }
    
    container.innerHTML = '<p class="shipping-methods-loading">Loading shipping options...</p>';
    section.style.display = 'block';
    
    try {
      debugLog('[CHECKOUT] Fetching shipping methods from:', endpoint);
      const response = await fetch(endpoint, {
        signal: window.shippingMethodsAbortController.signal
      });
      
      const result = await response.json();
      updateCheckoutTokenFromApi(result);
      
      // Handle error response - check if address is required
      if (!response.ok) {
        // Clear previously loaded shipping methods on error
        window.checkoutShippingMethods = null;
        window.shippingMethodSelected = false;
        container.innerHTML = '';
        
        if (result.requiresAddress || (result.error && result.error.includes('address'))) {
          debugLog('[CHECKOUT] Shipping address required - address may need to be saved first');
          // Address form may be complete but not yet persisted. Try saving address, then refetch.
          if (isShippingAddressComplete() && typeof updateShippingAddress === 'function') {
            try {
              await updateShippingAddress();
              // Schedule refetch after this function returns (and finally clears shippingMethodsFetchInProgress)
              setTimeout(() => {
                if (typeof fetchShippingMethods === 'function') fetchShippingMethods();
              }, 150);
            } catch (e) {
              debugLog('[CHECKOUT] Address save failed:', e);
            }
          }
          if (!window.checkoutShippingMethods) {
            container.innerHTML = '<p class="shipping-methods-message">Please complete your shipping address to see available shipping options.</p>';
            section.style.display = 'block';
          }
          return;
        }
        throw new Error(resolveCheckoutErrorMessage(result, `HTTP ${response.status}: ${response.statusText}`));
      }
      
      debugLog('[CHECKOUT] Shipping methods response:', result);
      
      // Handle both wrapped response {success: true, data: [...]} and direct array response
      let methods = [];
      if (result.success && result.data && Array.isArray(result.data)) {
        methods = result.data;
      } else if (Array.isArray(result)) {
        methods = result;
      }
      
      if (methods.length > 0) {
        window.lastShippingMethodsFetchKey = fetchAddressKey || window.lastShippingMethodsFetchKey;
        container.innerHTML = '';
        
        // Get currently selected shipping method from checkout data
        const selectedShippingMethodHandle = typeof CHECKOUT_SHIPPING_METHOD_HANDLE !== 'undefined' ? CHECKOUT_SHIPPING_METHOD_HANDLE : null;
        debugLog('[CHECKOUT] Currently selected shipping method:', selectedShippingMethodHandle);
        
        // Store methods array for later use
        window.checkoutShippingMethods = methods;
        
        // Extract all unique products from all shipping methods
        const productMap = new Map();
        methods.forEach((method) => {
          if (method.products && Array.isArray(method.products)) {
            method.products.forEach((product) => {
              const productId = product.productId || product.id;
              if (productId && !productMap.has(productId)) {
                productMap.set(productId, product);
              }
            });
          }
        });
        
        const allProducts = Array.from(productMap.values());
        
        // Helper function to get applicable method IDs for a product
        const getApplicableMethodIds = (productId) => {
          return methods
            .filter((method) => {
              if (!method.products || !Array.isArray(method.products)) return false;
              return method.products.some((p) => (p.productId || p.id) === productId);
            })
            .map((method) => String(method.id || method.index))
            .sort()
            .join(',');
        };
        
        // Group products by their applicable shipping methods
        const productGroups = new Map();
        allProducts.forEach((product) => {
          const productId = product.productId || product.id;
          const methodSignature = getApplicableMethodIds(productId);
          
          if (!productGroups.has(methodSignature)) {
            productGroups.set(methodSignature, {
              products: [],
              methodIds: methodSignature.split(',').filter(id => id)
            });
          }
          productGroups.get(methodSignature).products.push(product);
        });
        
        // Create rows for each product group
        productGroups.forEach((group, methodSignature) => {
          const productRow = document.createElement('div');
          productRow.className = 'shipping-product-row';
          
          // Left side: All products in this group
          const productColumn = document.createElement('div');
          productColumn.className = 'shipping-product-column';
          
          group.products.forEach((product) => {
            const productItem = document.createElement('div');
            productItem.className = 'shipping-product-item';
            
            // Product image
            const productImage = document.createElement('img');
            productImage.src = product.thumbnailUrl || '';
            productImage.alt = product.name || '';
            productImage.className = 'shipping-product-image';
            productImage.addEventListener('error', () => {
              productImage.style.display = 'none';
            });
            
            // Product details
            const productDetails = document.createElement('div');
            productDetails.className = 'shipping-product-details';
            
            const productName = document.createElement('div');
            productName.className = 'shipping-product-name';
            productName.textContent = product.name || '';
            
            const productPrice = document.createElement('div');
            productPrice.className = 'shipping-product-price';
            const price = product.price !== undefined && product.price !== null ? parseFloat(product.price) : 0;
            const quantity = product.quantity !== undefined && product.quantity !== null ? parseFloat(product.quantity) : 1;
            productPrice.textContent = formatMoney(price) + 'x' + quantity;
            
            productDetails.appendChild(productName);
            productDetails.appendChild(productPrice);
            
            productItem.appendChild(productImage);
            productItem.appendChild(productDetails);
            productColumn.appendChild(productItem);
          });
          
          // Right side: Shared shipping methods for this group
          const methodsColumn = document.createElement('div');
          methodsColumn.className = 'shipping-methods-column';
          
          // Get the applicable methods for this group (all products in group share these)
          const applicableMethods = methods.filter((method) => {
            const methodId = String(method.id || method.index);
            return group.methodIds.includes(methodId);
          });
          
          if (applicableMethods.length === 0) {
            // No shipping methods available for these products
            const noShippingMsg = document.createElement('div');
            noShippingMsg.className = 'shipping-unavailable-message';
            noShippingMsg.textContent = 'Sorry, This product cannot be shipped to your location';
            methodsColumn.appendChild(noShippingMsg);
          } else {
            // Create radio buttons for each applicable shipping method
            // Use a unique name per group to allow selection for all products in group
            const radioGroupName = `shippingMethod-group-${methodSignature}`;
            
            applicableMethods.forEach((method, methodIndex) => {
              const methodId = method.id || method.index || methodIndex;
              const methodIdentifier = String(methodId);
              
              // Check if this method is selected
              const isSelected = (!selectedShippingMethodHandle && methodIndex === 0) ||
                (selectedShippingMethodHandle && methodIdentifier === String(selectedShippingMethodHandle));
              
              const methodDiv = document.createElement('div');
              methodDiv.className = 'shipping-method';
              
              const label = document.createElement('label');
              label.className = 'shipping-method-label';
              
              const radio = document.createElement('input');
              radio.type = 'radio';
              radio.name = radioGroupName;
              radio.value = methodIdentifier;
              radio.id = `shipping-method-${methodSignature}-${methodIndex}`;
              radio.dataset.methodId = methodIdentifier;
              radio.dataset.methodIndex = methodIndex;
              radio.checked = isSelected;
              
              const content = document.createElement('div');
              content.className = 'shipping-method-content';
              
              // Title and price row
              const titleRow = document.createElement('div');
              titleRow.className = 'shipping-method-title-row';
              
              const name = document.createElement('span');
              name.className = 'shipping-method-name';
              name.textContent = method.title || method.name || 'Shipping';
              
              const priceSpan = document.createElement('span');
              priceSpan.className = 'shipping-method-price';
              if (method.price !== undefined && method.price !== null && parseFloat(method.price) > 0) {
                priceSpan.textContent = formatMoney(method.price);
              } else {
                priceSpan.textContent = formatMoney(0);
              }
              
              titleRow.appendChild(name);
              titleRow.appendChild(priceSpan);
              content.appendChild(titleRow);
              
              // Time information row (if available)
              if (method.shippingTime || method.deliveryTime) {
                const timeRow = document.createElement('div');
                timeRow.className = 'shipping-method-time-row';
                
                if (method.shippingTime) {
                  const shippingTime = document.createElement('div');
                  shippingTime.className = 'shipping-method-time';
                  shippingTime.textContent = 'Ship by: ' + method.shippingTime;
                  timeRow.appendChild(shippingTime);
                }
                
                if (method.deliveryTime) {
                  const deliveryTime = document.createElement('div');
                  deliveryTime.className = 'shipping-method-time';
                  deliveryTime.textContent = 'Delivery by: ' + method.deliveryTime;
                  timeRow.appendChild(deliveryTime);
                }
                
                content.appendChild(timeRow);
              }
              
              label.appendChild(radio);
              label.appendChild(content);
              methodDiv.appendChild(label);
              methodsColumn.appendChild(methodDiv);
              
              // Add change handler - store method reference in closure
              ((methodObj) => {
                radio.addEventListener('change', (e) => {
                  if (e.target.checked) {
                    debugLog('[CHECKOUT] Shipping method changed for product group', methodSignature, 'to method:', methodObj);
                    updateShippingMethod(methodObj);
                  }
                });
              })(method);
            });
          }
          
          productRow.appendChild(productColumn);
          productRow.appendChild(methodsColumn);
          container.appendChild(productRow);
        });
        
        debugLog('[CHECKOUT] Rendered', methods.length, 'shipping methods');
        
        // Update shipping method on page load if a method is selected but not yet saved
        // Check if a shipping method is already selected from server
        if (selectedShippingMethodHandle) {
          // Shipping method already selected from server, mark as selected
          window.shippingMethodSelected = true;
        }
        
        // Only update if no method was previously selected (to avoid unnecessary API calls)
        const selectedRadio = container.querySelector('input[type="radio"]:checked');
        if (selectedRadio && !selectedShippingMethodHandle && !window.shippingMethodSelected) {
          // No method was previously selected, so update with the default selection
          const selectedMethodId = selectedRadio.dataset.methodId || selectedRadio.value;
          const selectedMethod = methods.find((m) => String(m.id || m.index) === String(selectedMethodId));
          if (selectedMethod) {
            // Prevent overlapping auto-select PUT/GET race on initial load.
            window.shippingMethodAutoUpdateInProgress = true;
            await updateShippingMethod(selectedMethod);
            window.shippingMethodAutoUpdateInProgress = false;
          }
        } else if (selectedRadio && selectedShippingMethodHandle) {
          // Method is already selected from server, mark as selected
          window.shippingMethodSelected = true;
        }
        
        // Update button state after shipping methods are loaded
        updateCheckoutButtonState();
      } else {
        debugLog('[CHECKOUT] No shipping methods available');
        container.innerHTML = '<p class="shipping-methods-empty">No shipping methods available for this address.</p>';
      }
      
      // Mark as completed
      window.checkoutApiStatus.shippingMethodsFetch = 'completed';
      updateCheckoutButtonState();
    } catch (error) {
      // Ignore abort errors (they're expected when cancelling)
      if (error.name === 'AbortError') {
        debugLog('[CHECKOUT] Shipping methods fetch aborted');
        // IMPORTANT: Always clear pending status on abort to prevent
        // "Loading shipping options..." from getting stuck.
        window.checkoutApiStatus.shippingMethodsFetch = 'completed';
        updateCheckoutButtonState();

        if (shippingFetchTimedOut) {
          window.checkoutShippingMethods = null;
          window.shippingMethodSelected = false;
          container.innerHTML = '<p class="shipping-methods-error">Loading shipping options timed out. Please try again.</p>';
        }
        return;
      }
      
      console.error('[CHECKOUT] Error fetching shipping methods:', error);
      
      // Clear previously loaded shipping methods on error
      window.checkoutShippingMethods = null;
      window.shippingMethodSelected = false;
      container.innerHTML = '';
      
      // Check if error is about missing address
      const errorMessage = error.message || '';
      if (errorMessage.includes('address') || errorMessage.includes('Address')) {
        container.innerHTML = '<p class="shipping-methods-message">Please complete your shipping address to see available shipping options.</p>';
      } else {
        container.innerHTML = '<p class="shipping-methods-error">Unable to load shipping options. Please try again.</p>';
      }
      
      // Mark as completed even on error (to allow retry)
      window.checkoutApiStatus.shippingMethodsFetch = 'completed';
      updateCheckoutButtonState();
    } finally {
      clearTimeout(shippingFetchTimeoutId);
      window.shippingMethodAutoUpdateInProgress = false;
      // Always reset in-progress flag and abort controller
      window.shippingMethodsFetchInProgress = false;
      window.shippingMethodsAbortController = null;

      // If a refetch was requested while this fetch was running, schedule it now.
      if (window.shippingMethodsRefetchRequested && !window.checkoutInProgress && isShippingAddressComplete()) {
        window.shippingMethodsRefetchRequested = false;
        clearTimeout(window.shippingMethodsTimeout);
        window.shippingMethodsTimeout = setTimeout(() => {
          if (!window.shippingMethodsFetchInProgress && !window.checkoutInProgress) {
            fetchShippingMethods();
          }
        }, 150);
      } else {
        window.shippingMethodsRefetchRequested = false;
      }
    }
  }
  
  // Update shipping method
  async function updateShippingMethod(shippingMethod) {
    // Prevent updating during checkout completion
    if (window.checkoutInProgress) return;
    if (window.checkoutApiStatus.shippingMethodUpdate === 'pending') {
      debugLog('[CHECKOUT] Shipping method update already in progress, skipping duplicate call');
      return;
    }
    
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      console.error('[CHECKOUT] No checkout token available');
      return;
    }
    
    if (!shippingMethod) {
      console.error('[CHECKOUT] Shipping method object is required');
      return;
    }
    
    // Track status
    window.checkoutApiStatus.shippingMethodUpdate = 'pending';
    updateCheckoutButtonState();
    
    const isHostedCheckout = window.location.pathname.includes('/checkout/') && 
                             window.location.pathname.split('/').length > 2;
    const endpoint = isHostedCheckout
      ? `/webstoreapi/checkout/${checkoutToken}/shipping-method`
      : '/webstoreapi/checkout/shipping-method';
    
    debugLog('[CHECKOUT] Updating shipping method:', shippingMethod);
    
    // Show loading state on selected radio button
    const methodId = String(shippingMethod.id || shippingMethod.index || '');
    const allShippingRadios = document.querySelectorAll('input[type="radio"][data-method-id]');
    let selectedRadio = null;
    allShippingRadios.forEach((radio) => {
      if (!selectedRadio && String(radio.dataset.methodId || '') === methodId && radio.checked) {
        selectedRadio = radio;
      }
    });
    if (!selectedRadio) {
      allShippingRadios.forEach((radio) => {
        if (!selectedRadio && String(radio.dataset.methodId || '') === methodId) {
          selectedRadio = radio;
        }
      });
    }
    if (selectedRadio) {
      selectedRadio.disabled = true;
    }
    
    try {
      // API expects shippingMethods array with the selected method object
      const requestBody = {
        shippingMethods: [shippingMethod]
      };
      
      debugLog('[CHECKOUT] Sending request to:', endpoint, 'with body:', requestBody);
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      debugLog('[CHECKOUT] Response status:', response.status, response.statusText);
      
      let result;
      try {
        result = await response.json();
        updateCheckoutTokenFromApi(result);
        debugLog('[CHECKOUT] Response data:', result);
      } catch (parseError) {
        console.error('[CHECKOUT] Failed to parse response as JSON:', parseError);
        const text = await response.text();
        console.error('[CHECKOUT] Response text:', text);
        throw new Error(`Invalid response from server: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        const errorMessage = resolveCheckoutErrorMessage(result, `HTTP ${response.status}: ${response.statusText}`);
        console.error('[CHECKOUT] API error:', errorMessage, result);
        throw new Error(errorMessage);
      }

      if (!result.success) {
        const errorMessage = resolveCheckoutErrorMessage(result, 'Failed to update shipping method');
        console.error('[CHECKOUT] Request failed:', errorMessage, result);
        throw new Error(errorMessage);
      }
      
      debugLog('[CHECKOUT] Shipping method updated successfully:', result);
      
      // Re-enable radio button on success
      if (selectedRadio) {
        selectedRadio.disabled = false;
      }
      
      // Update order summary with new pricing if available
      if (result.data && result.data.pricing) {
        // Map API pricing format to template format
        const mappedPricing = mapPricingFromApi(result.data.pricing);
        updateOrderSummary(mappedPricing);
      } else if (result.data) {
        // Check if pricing fields are directly in result.data
        const mappedPricing = mapPricingFromApi(result.data);
        updateOrderSummary(mappedPricing);
      } else {
        // Reload page to get updated checkout data with new totals
        debugLog('[CHECKOUT] Reloading page to update order totals');
        window.location.reload();
      }
      
      // Mark as completed and set shipping method selected flag
      window.checkoutApiStatus.shippingMethodUpdate = 'completed';
      window.shippingMethodSelected = true;
      updateCheckoutButtonState();
    } catch (error) {
      console.error('[CHECKOUT] Error updating shipping method:', error);
      console.error('[CHECKOUT] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Re-enable radio button on error
      if (selectedRadio) {
        selectedRadio.disabled = false;
      }
      
      // Show error message to user with more details
      const container = document.getElementById('shipping-methods-container');
      if (container) {
        // Remove existing error messages
        const existingErrors = container.querySelectorAll('.shipping-methods-error');
        existingErrors.forEach(el => el.remove());
        
        const errorMsg = document.createElement('div');
        errorMsg.className = 'shipping-methods-error';
        errorMsg.textContent = error.message || 'Failed to update shipping method. Please try again.';
        errorMsg.style.display = 'block';
        errorMsg.style.marginTop = '10px';
        errorMsg.style.padding = '10px';
        errorMsg.style.backgroundColor = '#fee';
        errorMsg.style.color = '#c33';
        errorMsg.style.borderRadius = '4px';
        
        container.appendChild(errorMsg);
        
        // Remove error message after 8 seconds
        setTimeout(() => {
          errorMsg.remove();
        }, 8000);
      }
      
      // Mark as completed even on error (to allow retry)
      window.checkoutApiStatus.shippingMethodUpdate = 'completed';
      window.shippingMethodSelected = false;
      updateCheckoutButtonState();
    }
  }
  
  // Map API pricing format to template-friendly format
  function mapPricingFromApi(apiPricing) {
    if (!apiPricing) return null;
    
    // API uses: subtotalPrice, totalPrice, totalTax, totalShipping, totalDiscounts, paymentMethodFee
    // Template expects: subtotal, total, tax, shipping, discount, paymentMethodFee
    return {
      subtotal: apiPricing.subtotalPrice || apiPricing.subtotal || 0,
      total: apiPricing.totalPrice || apiPricing.total || 0,
      tax: apiPricing.totalTax || apiPricing.tax || 0,
      shipping: apiPricing.totalShipping || apiPricing.shipping || 0,
      discount: apiPricing.totalDiscounts || apiPricing.discount || 0,
      paymentMethodFee: apiPricing.paymentMethodFee ?? apiPricing.paymentFee ?? 0
    };
  }
  
  // Calculate subtotal from cart items
  function calculateSubtotalFromItems() {
    const cartItems = document.querySelectorAll('.order-summary-item');
    let subtotal = 0;
    
    cartItems.forEach(item => {
      const priceEl = item.querySelector('[data-item-price]');
      const qtyEl = item.querySelector('[data-item-quantity]');
      
      if (priceEl && qtyEl) {
        const price = parseFloat(priceEl.getAttribute('data-item-price')) || 0;
        const quantity = parseInt(qtyEl.getAttribute('data-item-quantity')) || 0;
        subtotal += price * quantity;
      }
    });
    
    return subtotal;
  }
  
  // Update subtotal display
  function updateSubtotalDisplay(subtotal) {
    const subtotalEl = document.querySelector('[data-summary-subtotal]');
    if (subtotalEl && subtotal !== null && subtotal !== undefined) {
      subtotalEl.textContent = formatMoney(subtotal);
      debugLog('[CHECKOUT] Updated subtotal display:', subtotal);
    }
  }
  
  // Update order summary with new pricing
  function updateOrderSummary(pricing) {
    debugLog('[CHECKOUT] Updating order summary with pricing:', pricing);
    
    if (!pricing) {
      console.warn('[CHECKOUT] No pricing data provided, calculating from items');
      // If no pricing provided, calculate from cart items
      const calculatedSubtotal = calculateSubtotalFromItems();
      if (calculatedSubtotal > 0) {
        updateSubtotalDisplay(calculatedSubtotal);
      }
      return;
    }
    
    // If pricing is in API format, map it first
    if (pricing.subtotalPrice !== undefined || pricing.totalPrice !== undefined) {
      pricing = mapPricingFromApi(pricing);
      debugLog('[CHECKOUT] Mapped pricing from API format:', pricing);
    }
    
    const totalsContainer = document.querySelector('.order-summary-totals');
    if (!totalsContainer) {
      console.warn('[CHECKOUT] Order summary totals container not found');
      return;
    }
    
    // Update subtotal
    if (pricing.subtotal !== undefined && pricing.subtotal !== null && pricing.subtotal > 0) {
      updateSubtotalDisplay(pricing.subtotal);
    } else {
      // Fallback to calculating from items
      const calculatedSubtotal = calculateSubtotalFromItems();
      if (calculatedSubtotal > 0) {
        updateSubtotalDisplay(calculatedSubtotal);
      }
    }
    
    // Discount line is handled centrally by updateCheckoutPricing using pricing.discounts/totalDiscounts
    // to avoid creating duplicate Discount rows in the order summary.
        
    // Update shipping
    if (pricing.shipping !== undefined && pricing.shipping !== null) {
      const shippingEl = document.querySelector('[data-summary-shipping]');
      if (shippingEl) {
        shippingEl.textContent = pricing.shipping === 0 ? 'Free' : formatMoney(pricing.shipping);
      }
    }
    
    // Update tax
    if (pricing.tax !== undefined && pricing.tax !== null) {
      const taxEl = document.querySelector('[data-summary-tax]');
      if (taxEl) {
        taxEl.textContent = formatMoney(pricing.tax);
      }
    }

    // Update payment fee - use pricing if provided, else selected method's data-payment-fee
    let paymentFee = pricing.paymentMethodFee ?? pricing.paymentFee ?? 0;
    if (paymentFee === 0) {
      const selectedRadio = document.querySelector('input[name="paymentMethod"]:checked');
      if (selectedRadio) {
        paymentFee = parseFloat(selectedRadio.getAttribute('data-payment-fee') || '0') || 0;
      }
    }
    const feeLine = document.querySelector('[data-summary-payment-fee-line]');
    const feeValueEl = document.querySelector('[data-summary-payment-fee]');
    if (feeLine && feeValueEl) {
      const currencySymbol = document.body.dataset.shopCurrencySymbol || (typeof CHECKOUT_CURRENCY_SYMBOL !== 'undefined' ? CHECKOUT_CURRENCY_SYMBOL : '₹');
      feeValueEl.textContent = paymentFee > 0 ? formatMoney(paymentFee) : currencySymbol + '0.00';
      feeLine.style.display = paymentFee > 0 ? 'flex' : 'none';
    }

    // Update total (API totalPrice typically excludes payment fee, so add it)
    if (pricing.total !== undefined && pricing.total !== null) {
      const totalEl = document.querySelector('[data-summary-total]');
      if (totalEl) {
        const baseTotal = parseFloat(pricing.total) || 0;
        totalEl.textContent = formatMoney(baseTotal + (paymentFee || 0));
      }
    }

    debugLog('[CHECKOUT] Order summary updated successfully');
  }
  
  // Initialize subtotal on page load
  (() => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeSubtotal, 100);
      });
    } else {
      setTimeout(initializeSubtotal, 100);
    }
    
    function initializeSubtotal() {
      const subtotalEl = document.querySelector('[data-summary-subtotal]');
      if (!subtotalEl) return;
      
      // Check if subtotal is already set (from server-side rendering)
      const currentSubtotal = subtotalEl.textContent.trim();
      
      // If subtotal is 0 or empty, try to calculate from items
      if (!currentSubtotal || currentSubtotal === '$0.00' || currentSubtotal === '0.00' || currentSubtotal === '₹0.00') {
        const calculatedSubtotal = calculateSubtotalFromItems();
        if (calculatedSubtotal > 0) {
          updateSubtotalDisplay(calculatedSubtotal);
        }
      }
      
      // Also update if checkout pricing is available
      if (typeof CHECKOUT_PRICING !== 'undefined' && CHECKOUT_PRICING) {
        const checkoutPricing = CHECKOUT_PRICING;
        if (checkoutPricing && checkoutPricing.subtotal) {
          updateOrderSummary(checkoutPricing);
        }
      }
      // Ensure payment fee is applied (in case updateOrderSummary overwrote it or pricing lacked fee)
      if (typeof initPaymentFeeFromSelection === 'function') {
        initPaymentFeeFromSelection();
      }
    }
  })();
  
  // Track if shipping methods fetch is in progress to prevent duplicate calls
  window.shippingMethodsFetchInProgress = false;
  window.shippingMethodsAbortController = null;
  window.shippingMethodsRefetchRequested = false;
  window.lastShippingAddressSyncKey = null;
  window.lastShippingMethodsFetchKey = null;

  // Check and fetch shipping methods if address is complete
  function checkAndFetchShippingMethods() {
    // Prevent fetching during checkout completion
    if (window.checkoutInProgress) return;
    if (window.checkoutApiStatus.shippingMethodUpdate === 'pending' || window.shippingMethodAutoUpdateInProgress) {
      debugLog('[CHECKOUT] Delaying shipping methods fetch while shipping method update is pending');
      return;
    }
    
    // Clear any pending timeout
    clearTimeout(window.shippingMethodsTimeout);
    
    if (isShippingAddressComplete()) {
      if (
        window.lastShippingAddressSyncKey &&
        window.lastShippingMethodsFetchKey === window.lastShippingAddressSyncKey &&
        window.checkoutShippingMethods
      ) {
        debugLog('[CHECKOUT] Skipping duplicate shipping methods fetch for unchanged address');
        return;
      }

      // If a fetch is in progress, request a refetch after cleanup.
      if (window.shippingMethodsFetchInProgress) {
        window.shippingMethodsRefetchRequested = true;
        return;
      }

      // Debounce the fetch.
      window.shippingMethodsTimeout = setTimeout(() => {
        if (!window.shippingMethodsFetchInProgress && !window.checkoutInProgress) {
          fetchShippingMethods();
        }
      }, 500);
    } else {
      // Address is incomplete - clear shipping methods
      const container = document.getElementById('shipping-methods-container');
      const section = document.getElementById('shipping-methods-section');
      
      if (container) {
        container.innerHTML = '<p class="shipping-methods-message">Please complete your shipping address to see available shipping options.</p>';
      }
      if (section) {
        section.style.display = 'block';
      }
      
      // Reset shipping method state
      window.checkoutShippingMethods = null;
      window.shippingMethodSelected = false;
      window.shippingMethodsFetchInProgress = false;
      window.shippingMethodsRefetchRequested = false;
      window.checkoutApiStatus.shippingMethodsFetch = 'idle';
      updateCheckoutButtonState();
    }
  }

  async function updateShippingAddress() {
    // Prevent updating during checkout completion
    if (window.checkoutInProgress) return;
    
    // Cancel any pending shipping methods fetch when address update starts
    if (window.shippingMethodsAbortController) {
      window.shippingMethodsAbortController.abort();
      window.shippingMethodsAbortController = null;
    }
    clearTimeout(window.shippingMethodsTimeout);
    
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      // No valid checkout, clear pending state if we set it earlier
      if (window.checkoutApiStatus.shippingAddress === 'pending') {
        window.checkoutApiStatus.shippingAddress = 'idle';
        updateCheckoutButtonState();
      }
      return;
    }

    const formData = new FormData(document.getElementById('checkout-form'));

    // Do not send update if phone number is empty
    // This enforces phone as a required shipping detail at the client side.
    const phoneField = document.getElementById('shipping-phone');
    let phoneValid = false;
    if (phoneField) {
      phoneValid = (phoneField.value || '').trim() !== '';
    }

    if (!phoneValid) {
      console.warn('[CHECKOUT] Shipping address update blocked: phone number is missing or invalid');
      // Reset pending state if it was set earlier
      if (window.checkoutApiStatus.shippingAddress === 'pending') {
        window.checkoutApiStatus.shippingAddress = 'idle';
      }
      // Ensure button reflects current validation state
      updateCheckoutButtonState();
      return;
    }

    // Track status
    window.checkoutApiStatus.shippingAddress = 'pending';
    updateCheckoutButtonState();
    
    try {
      const isHostedCheckout = window.location.pathname.includes('/checkout/') && 
                               window.location.pathname.split('/').length > 2;
      const endpoint = isHostedCheckout
        ? `/webstoreapi/checkout/${checkoutToken}/shipping-address`
        : '/webstoreapi/checkout/shipping-address';
      
      // Get countryId from select dropdown
      const countrySelect = document.getElementById('shipping-country');
      const countryId = countrySelect ? countrySelect.value : null;
      
      // Get stateOrProvinceId from either select dropdown or text input
      const stateSelect = document.getElementById('shipping-state');
      const stateTextInput = document.getElementById('shipping-state-text');
      let stateOrProvinceId = null;
      
      if (stateSelect && stateSelect.style.display !== 'none' && stateSelect.value) {
        stateOrProvinceId = stateSelect.value;
      } else if (stateTextInput && stateTextInput.style.display !== 'none' && stateTextInput.value) {
        // For text input, we still need an ID - this should not happen if states are properly configured
        // But we'll send the text value and let backend handle validation
        stateOrProvinceId = stateTextInput.value;
      }
      
      // Validate that we have both IDs
      if (!countryId || !stateOrProvinceId) {
        console.warn('[CHECKOUT] Missing countryId or stateOrProvinceId. Country:', countryId, 'State:', stateOrProvinceId);
        // Don't send request if IDs are missing. Since we previously
        // marked this as pending when the user started editing, reset
        // it back so the button state reflects that no call was sent.
        window.checkoutApiStatus.shippingAddress = 'idle';
        updateCheckoutButtonState();
        return;
      }
      
      // Get phone number from intl-tel-input if available
      let shippingPhone = formData.get('shippingPhone');
      if (window.shippingPhoneIti) {
        const phoneNumber = window.shippingPhoneIti.getNumber();
        if (phoneNumber) {
          // Remove leading + sign
          shippingPhone = phoneNumber.replace(/^\+/, '');
        }
      }
      
      const requestBody = {
        shippingFirstName: formData.get('shippingFirstName'),
        shippingLastName: formData.get('shippingLastName'),
        shippingAddress: formData.get('shippingAddress'),
        shippingCity: formData.get('shippingCity'),
        shippingZip: formData.get('shippingZip'),
        shippingPhone: shippingPhone,
        countryId: countryId,
        stateOrProvinceId: stateOrProvinceId
      };
      const addressSyncKey = JSON.stringify(requestBody);

      if (
        window.lastShippingAddressSyncKey === addressSyncKey &&
        window.checkoutApiStatus.shippingAddress === 'completed'
      ) {
        debugLog('[CHECKOUT] Skipping duplicate shipping address update');
        if (!window.checkoutInProgress) {
          checkAndFetchShippingMethods();
        }
        return;
      }
      
      debugLog('[CHECKOUT] Updating shipping address with data:', requestBody);
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json().catch(() => ({}));
      updateCheckoutTokenFromApi(result);

      if (!response.ok) {
        const shippingAddressErrorMessage = resolveCheckoutErrorMessage(result, 'Failed to update shipping address.');
        console.error('Failed to update shipping address:', shippingAddressErrorMessage);
        
        // Clear shipping methods when address update fails (400+ errors)
        // This prevents using stale shipping methods when address is invalid
        // Use checkAndFetchShippingMethods to handle clearing consistently
        checkAndFetchShippingMethods();
        const container = document.getElementById('shipping-methods-container');
        if (container) {
          container.innerHTML = `<p class="shipping-methods-error">${shippingAddressErrorMessage}</p>`;
        }
        
        // Mark as completed even on error (to allow retry)
        window.checkoutApiStatus.shippingAddress = 'completed';
        updateCheckoutButtonState();
      } else {
        window.lastShippingAddressSyncKey = addressSyncKey;
        // Mark as completed
        window.checkoutApiStatus.shippingAddress = 'completed';
        updateCheckoutButtonState();
        
        // Only fetch shipping methods if checkout not in progress
        if (!window.checkoutInProgress) {
          checkAndFetchShippingMethods();
        }
      }
    } catch (error) {
      console.error('Error updating shipping address:', error);
      
      // Clear shipping methods when address update fails
      // Use checkAndFetchShippingMethods to handle clearing consistently
      checkAndFetchShippingMethods();
      
      // Mark as completed even on error (to allow retry)
      window.checkoutApiStatus.shippingAddress = 'completed';
      updateCheckoutButtonState();
    }
  }

  // Update billing address when form fields change (debounced)
  let billingAddressTimeout;
  const billingFields = ['billing-first-name', 'billing-last-name', 'billing-address', 'billing-city', 'billing-state', 'billing-zip', 'billing-country', 'billing-phone'];
  billingFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('blur', () => {
        clearTimeout(billingAddressTimeout);
        billingAddressTimeout = setTimeout(updateBillingAddress, 500);
      });
    }
  });

  async function updateBillingAddress() {
    // Prevent updating during checkout completion
    if (window.checkoutInProgress) return;
    
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) return;

    const sameAsShipping = document.getElementById('same-as-shipping')?.checked;
    if (sameAsShipping) return; // Don't update if same as shipping

    // Track status
    window.checkoutApiStatus.billingAddress = 'pending';
    updateCheckoutButtonState();

    const formData = new FormData(document.getElementById('checkout-form'));
    
    try {
      // Get countryId from select dropdown
      const countrySelect = document.getElementById('billing-country');
      const countryId = countrySelect ? countrySelect.value : null;
      
      // Get stateOrProvinceId from select dropdown
      const stateSelect = document.getElementById('billing-state');
      const stateOrProvinceId = stateSelect && stateSelect.value ? stateSelect.value : null;
      
      // Validate that we have both IDs
      if (!countryId || !stateOrProvinceId) {
        console.warn('[CHECKOUT] Missing billing countryId or stateOrProvinceId. Country:', countryId, 'State:', stateOrProvinceId);
        // Don't send request if IDs are missing
        return;
      }
      
      const response = await fetch('/webstoreapi/checkout/billing-address', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          billingFirstName: formData.get('billingFirstName'),
          billingLastName: formData.get('billingLastName'),
          billingAddress: formData.get('billingAddress'),
          billingCity: formData.get('billingCity'),
          billingZip: formData.get('billingZip'),
          phone: formData.get('billingPhone'),
          countryId: countryId,
          stateOrProvinceId: stateOrProvinceId
        })
      });

      if (!response.ok) {
        const result = await response.json();
        console.error('Failed to update billing address:', result.error);
        // Mark as completed even on error (to allow retry)
        window.checkoutApiStatus.billingAddress = 'completed';
        updateCheckoutButtonState();
      } else {
        // Mark as completed
        window.checkoutApiStatus.billingAddress = 'completed';
        updateCheckoutButtonState();
      }
    } catch (error) {
      console.error('Error updating billing address:', error);
      // Mark as completed even on error (to allow retry)
      window.checkoutApiStatus.billingAddress = 'completed';
      updateCheckoutButtonState();
    }
  }

  // Handle same as shipping checkbox change
  document.getElementById('same-as-shipping')?.addEventListener('change', (e) => {
    const billingFields = document.getElementById('billing-address-fields');
    if (billingFields) {
      billingFields.style.display = e.target.checked ? 'none' : 'block';
    }
    if (e.target.checked) {
      // Clear billing address when same as shipping
      updateBillingAddress();
    } else {
      // Update billing address when unchecked
      updateBillingAddress();
    }
  });

  // Manual order note save
  let lastSavedOrderNote = null;
  const orderNotesField = document.getElementById('order-notes') || document.getElementById('orderNotes');
  const orderNoteSaveBtn = document.getElementById('order-note-save-btn');
  const orderNoteSaveStatus = document.getElementById('order-note-save-status');

  function setOrderNoteStatus(message, tone = 'muted') {
    if (!orderNoteSaveStatus) return;
    orderNoteSaveStatus.textContent = message || '';
    if (tone === 'success') {
      orderNoteSaveStatus.style.color = '#16a34a';
    } else if (tone === 'error') {
      orderNoteSaveStatus.style.color = '#dc2626';
    } else if (tone === 'warning') {
      orderNoteSaveStatus.style.color = '#d97706';
    } else {
      orderNoteSaveStatus.style.color = '#6b7280';
    }
  }

  function setOrderNoteButtonLoading(loading) {
    if (!orderNoteSaveBtn) return;
    const btnText = orderNoteSaveBtn.querySelector('.btn-text');
    const btnLoading = orderNoteSaveBtn.querySelector('.btn-loading');
    orderNoteSaveBtn.disabled = loading;
    if (btnText) btnText.style.display = loading ? 'none' : 'inline';
    if (btnLoading) btnLoading.style.display = loading ? 'inline-flex' : 'none';
  }

  if (orderNotesField) {
    lastSavedOrderNote = (orderNotesField.value || '').trim();
    setOrderNoteStatus(lastSavedOrderNote ? 'Saved' : '');
    orderNotesField.addEventListener('input', () => {
      const currentNote = (orderNotesField.value || '').trim();
      if (currentNote !== lastSavedOrderNote) {
        setOrderNoteStatus('Unsaved changes', 'warning');
      } else {
        setOrderNoteStatus('Saved', 'success');
      }
    });
  }

  async function updateNote(options = {}) {
    const force = options.force === true;
    const showFeedback = options.showFeedback === true;
    // Prevent updating during checkout completion
    if (window.checkoutInProgress && !force) return false;
    
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      if (showFeedback) {
        setOrderNoteStatus('Checkout session not found', 'error');
        setOrderNoteButtonLoading(false);
      }
      return false;
    }

    const formData = new FormData(document.getElementById('checkout-form'));
    const note = (formData.get('orderNotes') || '').trim();
    if (!force && note === lastSavedOrderNote) {
      if (showFeedback) setOrderNoteStatus('Already saved', 'success');
      return true;
    }

    // Track status
    window.checkoutApiStatus.orderNote = 'pending';
    updateCheckoutButtonState();
    if (showFeedback) {
      setOrderNoteButtonLoading(true);
      setOrderNoteStatus('Saving...');
    }
    
    try {
      const isHostedCheckout = window.location.pathname.includes('/checkout/') &&
                               window.location.pathname.split('/').length > 2;
      const endpoint = isHostedCheckout
        ? `/webstoreapi/checkout/${encodeURIComponent(checkoutToken)}/note`
        : '/webstoreapi/checkout/note';

      const response = await fetch(endpoint, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ note })
      });

      if (!response.ok) {
        let result = {};
        try {
          result = await response.json();
        } catch (_) {
          // ignore parsing errors for non-JSON errors
        }
        console.error('Failed to update note:', result.error);
        // Mark as completed even on error (to allow retry)
        window.checkoutApiStatus.orderNote = 'completed';
        updateCheckoutButtonState();
        if (showFeedback) {
          setOrderNoteStatus(result.error || result.message || 'Save failed', 'error');
          setOrderNoteButtonLoading(false);
        }
        return false;
      } else {
        lastSavedOrderNote = note;
        // Mark as completed
        window.checkoutApiStatus.orderNote = 'completed';
        updateCheckoutButtonState();
        if (showFeedback) {
          setOrderNoteStatus('Saved', 'success');
          setOrderNoteButtonLoading(false);
        }
        return true;
      }
    } catch (error) {
      console.error('Error updating note:', error);
      // Mark as completed even on error (to allow retry)
      window.checkoutApiStatus.orderNote = 'completed';
      updateCheckoutButtonState();
      if (showFeedback) {
        setOrderNoteStatus('Save failed. Try again.', 'error');
        setOrderNoteButtonLoading(false);
      }
      return false;
    }
  }

  orderNoteSaveBtn?.addEventListener('click', async () => {
    await updateNote({ showFeedback: true });
  });

  // ==================== PAYMENT GATEWAY EVENT SYSTEM ====================
  // Note: checkoutPaymentEvents is initialized earlier in the file (around line 30)
  // to ensure it's available before payment gateway apps try to use it
  // Only re-initialize if it doesn't exist (defensive check)
  if (!window.checkoutPaymentEvents) {
    window.checkoutPaymentEvents = (() => {
    const events = {};
    
    return {
      /**
       * Emit an event to registered listeners
       * @param {string} eventName - Name of the event
       * @param {Object} data - Event data
       */
      emit: (eventName, data) => {
        debugLog('[CHECKOUT] Emitting payment event:', eventName, data);
        
        if (!events[eventName]) {
          events[eventName] = [];
        }
        
        // Call all registered handlers
        events[eventName].forEach((handler) => {
          try {
            handler(data);
          } catch (error) {
            console.error('[CHECKOUT] Error in payment event handler:', error);
          }
        });
      },
      
      /**
       * Register an event listener
       * @param {string} eventName - Name of the event
       * @param {Function} handler - Event handler function
       */
      on: (eventName, handler) => {
        if (!events[eventName]) {
          events[eventName] = [];
        }
        events[eventName].push(handler);
        debugLog('[CHECKOUT] Registered listener for payment event:', eventName);
      },
      
      /**
       * Remove an event listener
       * @param {string} eventName - Name of the event
       * @param {Function} handler - Event handler function to remove
       */
      off: (eventName, handler) => {
        if (events[eventName]) {
          events[eventName] = events[eventName].filter(h => h !== handler);
        }
      }
    };
  })();
  }

  /**
   * Payment Gateway App Registry
   * Manages registered payment gateway apps and delegates checkout submission
   */
  window.paymentGatewayApps = (() => {
    const apps = {};
    
    return {
      /**
       * Register a payment gateway app
       * @param {string} paymentMethodId - Payment method ID (e.g., 'Razorpay', 'Stripe')
       * @param {Object} handler - App handler object with handleCheckoutSubmit method
       */
      register: (paymentMethodId, handler) => {
        if (!paymentMethodId || !handler) {
          console.error('[CHECKOUT] Invalid app registration:', { paymentMethodId, handler });
          return false;
        }
        
        if (typeof handler.handleCheckoutSubmit !== 'function') {
          console.error('[CHECKOUT] App handler must implement handleCheckoutSubmit:', paymentMethodId);
          return false;
        }
        
        apps[paymentMethodId] = handler;
        debugLog('[CHECKOUT] Registered payment gateway app:', paymentMethodId);
        return true;
      },
      
      /**
       * Check if a payment method is handled by an app
       * @param {string} paymentMethodId - Payment method ID
       * @returns {boolean} True if app is registered
       */
      isGatewayMethod: (paymentMethodId) => {
        return !!apps[paymentMethodId];
      },
      
      /**
       * Handle checkout submission for a gateway payment method
       * @param {string} paymentMethodId - Payment method ID
       * @param {string} checkoutToken - Checkout token
       * @returns {Promise<Object>} Promise resolving to payment result
       */
      handleSubmit: async (paymentMethodId, checkoutToken) => {
        const app = apps[paymentMethodId];
        
        if (!app) {
          return Promise.reject(new Error(`No app registered for payment method: ${paymentMethodId}`));
        }
        
        debugLog('[CHECKOUT] Delegating checkout submission to app:', paymentMethodId);
        
        try {
          return await app.handleCheckoutSubmit(paymentMethodId, checkoutToken);
        } catch (error) {
          console.error('[CHECKOUT] App checkout submission error:', error);
          throw error;
        }
      },
      
      /**
       * Get all registered app IDs
       * @returns {Array<string>} Array of registered payment method IDs
       */
      getRegisteredApps: () => {
        return Object.keys(apps);
      }
    };
  })();

  // Emit ready event when checkout is initialized
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.checkoutPaymentEvents.emit('payment:checkout:ready', {
        checkoutToken: typeof CHECKOUT_TOKEN !== 'undefined' ? CHECKOUT_TOKEN : getCheckoutToken()
      });
    });
  } else {
    // DOM already loaded
    window.checkoutPaymentEvents.emit('payment:checkout:ready', {
      checkoutToken: typeof CHECKOUT_TOKEN !== 'undefined' ? CHECKOUT_TOKEN : getCheckoutToken()
    });
  }

  // Handle form submission
  document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (window.checkoutSubmitLock || window.checkoutInProgress) {
      return;
    }
    window.checkoutSubmitLock = true;

    // Save latest order note before checkout completion.
    const noteSaved = await updateNote({ force: true, showFeedback: true });
    if (!noteSaved) {
      alert('Unable to save order note. Please click Save Note and try again.');
      window.checkoutSubmitLock = false;
      return;
    }
    
    // CRITICAL: Set flag immediately to prevent any API calls
    window.checkoutInProgress = true;
    clearTimeout(window.shippingMethodsTimeout);
    clearTimeout(shippingAddressTimeout);
    clearTimeout(billingAddressTimeout);
    
    const submitBtn = document.getElementById('checkout-submit');
    const checkoutForm = document.getElementById('checkout-form');
    if (!checkoutForm) {
      console.error('[CHECKOUT] Checkout form not found');
      window.checkoutInProgress = false;
      window.checkoutSubmitLock = false;
      return;
    }
    const formData = new FormData(checkoutForm);
    const paymentMethod = formData.get('paymentMethod');
    
    setButtonLoading(submitBtn, true, 'Processing...');
    
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      window.checkoutInProgress = false; // Reset flag on error
      alert('Checkout session expired. Please refresh the page and try again.');
      setButtonLoading(submitBtn, false);
      window.checkoutSubmitLock = false;
      return;
    }
    
    if (!paymentMethod) {
      window.checkoutInProgress = false; // Reset flag on error
      alert('Please select a payment method.');
      setButtonLoading(submitBtn, false);
      window.checkoutSubmitLock = false;
      return;
    }
    const idempotencyKey = window.checkoutIdempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.checkoutIdempotencyKey = idempotencyKey;
    
    // Get the selected payment method's fee from the radio input
    const selectedPaymentInput = document.querySelector(`input[name="paymentMethod"][value="${paymentMethod}"]`);
    const paymentFee = selectedPaymentInput ? parseFloat(selectedPaymentInput.getAttribute('data-payment-fee') || '0') : 0;
    const paymentType = selectedPaymentInput ? (selectedPaymentInput.getAttribute('data-payment-type') || '') : '';
    
    // Emit checkout submit event for apps to listen
    window.checkoutPaymentEvents.emit('payment:checkout:submit', {
      paymentMethod: paymentMethod,
      paymentType: paymentType,
      checkoutToken: checkoutToken,
      paymentFee: paymentFee
    });
    
    // Check if this is a gateway payment method that should be handled by an app
    if (paymentType === 'PaymentGateway' && window.paymentGatewayApps.isGatewayMethod(paymentMethod)) {
      debugLog('[CHECKOUT] Gateway payment method detected, delegating to app:', paymentMethod);
      
      try {
        setButtonLoading(submitBtn, true, 'Initializing payment...');
        
        // Delegate to app for payment handling
        await window.paymentGatewayApps.handleSubmit(paymentMethod, checkoutToken);
        
        // Note: Don't reset checkoutInProgress here - app will handle payment flow
        // App should emit payment:app:complete or payment:app:error events
        debugLog('[CHECKOUT] Payment gateway app handling payment, awaiting response...');
        return;
      } catch (error) {
        console.error('[CHECKOUT] Gateway payment app error:', error);
        window.checkoutInProgress = false; // Reset flag on error
        
        const errorMessage = error.message || 'Unable to initialize payment. Please try again or contact support.';
        alert(errorMessage);
        setButtonLoading(submitBtn, false);
        window.checkoutSubmitLock = false;
        return;
      }
    }
    
    // For non-gateway payment methods, proceed with standard checkout completion
    // Directly call complete checkout API (do not re-call shipping/billing/shipping method updates here)
    try {
      // Use the payment method value (which is the id/name from API) as paymentMethodHandle
      const isHostedCheckout = window.location.pathname.includes('/checkout/') && 
                               window.location.pathname.split('/').length > 2;
      
      const endpoint = isHostedCheckout
        ? `/webstoreapi/checkout/${checkoutToken}/complete`
        : '/webstoreapi/checkout/complete';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethodHandle: paymentMethod,
          paymentFeeAmount: paymentFee,
          idempotencyKey: idempotencyKey
        })
      });
      
      const result = await response.json();
      updateCheckoutTokenFromApi(result);
      
      if (result.success && result.data) {
        // Handle array of orders from CompleteCheckoutResponse
        const orders = Array.isArray(result.data) ? result.data : [result.data];
        const orderIds = orders.map(o => o.orderId || o.orderNumber).filter(Boolean).join(',');
        if (orderIds) {
          window.location.href = `/order-confirmation?orderIds=${orderIds}`;
        } else {
          window.location.href = '/order-confirmation';
        }
      } else {
        throw new Error(resolveCheckoutErrorMessage(result, 'Checkout failed'));
      }
    } catch (error) {
      console.error('Checkout error:', error);
      window.checkoutInProgress = false; // Reset flag on error
      alert(error.message || 'Checkout failed. Please try again.');
      setButtonLoading(submitBtn, false);
      window.checkoutSubmitLock = false;
    }
  });

  // ==================== COUPON FUNCTIONALITY ====================
  
  // Global tracking for applied coupon codes to keep UI state in sync
  window.appliedCouponCodes = [];

  /**
   * Initialize applied coupon codes from initial checkout pricing data
   */
  function initializeAppliedCouponCodesFromPricing() {
    const applied = [];
    
    if (
      typeof CHECKOUT_PRICING !== 'undefined' &&
      CHECKOUT_PRICING &&
      Array.isArray(CHECKOUT_PRICING.discounts)
    ) {
      CHECKOUT_PRICING.discounts.forEach(discount => {
        const code = discount.code || discount.couponCode || discount.discountCode;
        if (code && !applied.includes(code)) {
          applied.push(code);
        }
      });
    }

    window.appliedCouponCodes = applied;
  }

  // Initialize applied coupons on first load
  initializeAppliedCouponCodesFromPricing();

  /**
   * Fetch available discount codes for checkout
   */
  async function fetchDiscountCodes() {
    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      console.warn('[COUPONS] No checkout token available');
      return;
    }

    const couponsContainer = document.getElementById('coupons-container');
    const couponsError = document.getElementById('coupons-error');
    
    if (couponsContainer) {
      couponsContainer.innerHTML = '<p class="coupons-loading">Loading available coupons...</p>';
    }
    
    if (couponsError) {
      couponsError.style.display = 'none';
    }

    try {
      const response = await fetch(`/webstoreapi/checkout/${checkoutToken}/discount-codes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch discount codes');
      }

      const discountCodes = result.data;
      displayDiscountCodes(discountCodes);
    } catch (error) {
      console.error('[COUPONS] Error fetching discount codes:', error);
      if (couponsContainer) {
        couponsContainer.innerHTML = '<p class="coupons-error">Unable to load coupons. Please try again later.</p>';
      }
      if (couponsError) {
        couponsError.textContent = error.message || 'Failed to load coupons';
        couponsError.style.display = 'block';
      }
    }
  }

  /**
   * Get currently applied coupon codes
   */
  function getAppliedCouponCodes() {
    // Prefer the normalized global list
    if (Array.isArray(window.appliedCouponCodes) && window.appliedCouponCodes.length > 0) {
      return [...window.appliedCouponCodes];
    }

    const appliedCoupons = [];

    // Fallback: derive from CHECKOUT_PRICING if available
    if (
      typeof CHECKOUT_PRICING !== 'undefined' &&
      CHECKOUT_PRICING &&
      Array.isArray(CHECKOUT_PRICING.discounts)
    ) {
      CHECKOUT_PRICING.discounts.forEach(discount => {
        const code = discount.code || discount.couponCode || discount.discountCode;
        if (code && !appliedCoupons.includes(code)) {
          appliedCoupons.push(code);
        }
      });
    }

    return appliedCoupons;
  }

  /**
   * Display available discount codes
   */
  function displayDiscountCodes(discountCodes) {
    const couponsContainer = document.getElementById('coupons-container');
    if (!couponsContainer) return;

    // Handle different response formats
    let codes = [];
    if (Array.isArray(discountCodes)) {
      codes = discountCodes;
    } else if (discountCodes && typeof discountCodes === 'object') {
      // If it's a single object, wrap it in an array
      if (discountCodes.code) {
        codes = [discountCodes];
      } else if (discountCodes.codes && Array.isArray(discountCodes.codes)) {
        codes = discountCodes.codes;
      }
    }

    if (codes.length === 0) {
      couponsContainer.innerHTML = '<p class="coupons-empty">No coupons available at this time.</p>';
      return;
    }

    const couponsList = document.createElement('div');
    couponsList.className = 'coupons-list';

    // Get currently applied coupon codes
    let appliedCodes = getAppliedCouponCodes();

    // Heuristic: if no explicit applied codes are known but there is a discount
    // on checkout pricing and only one coupon exists, treat that coupon as applied.
    if (
      appliedCodes.length === 0 &&
      typeof CHECKOUT_PRICING !== 'undefined' &&
      CHECKOUT_PRICING &&
      (
        (CHECKOUT_PRICING.totalDiscounts !== undefined && CHECKOUT_PRICING.totalDiscounts > 0) ||
        (CHECKOUT_PRICING.discount !== undefined && CHECKOUT_PRICING.discount > 0)
      ) &&
      codes.length === 1
    ) {
      const inferredCode = codes[0].code || codes[0].couponCode || codes[0].discountCode || '';
      if (inferredCode) {
        appliedCodes = [inferredCode];
        // Keep global tracking in sync with the inferred state
        window.appliedCouponCodes = [inferredCode];
      }
    }

    codes.forEach((coupon, index) => {
      const couponCode = coupon.code || coupon.couponCode || '';
      const isApplied = appliedCodes.includes(couponCode);

      const couponItem = document.createElement('div');
      couponItem.className = 'coupon-item';
      couponItem.dataset.couponCode = couponCode;

      const couponInfo = document.createElement('div');
      couponInfo.className = 'coupon-info';

      const couponCodeDiv = document.createElement('div');
      couponCodeDiv.className = 'coupon-code';
      couponCodeDiv.textContent = couponCode || 'N/A';

      const couponDescription = document.createElement('div');
      couponDescription.className = 'coupon-description';
      couponDescription.textContent = coupon.description || '';

      if (coupon.minCartAmount) {
        const minAmount = document.createElement('div');
        minAmount.className = 'coupon-min-amount';
        minAmount.textContent = `Minimum order: ${formatMoney(coupon.minCartAmount)}`;
        couponInfo.appendChild(minAmount);
      }

      couponInfo.appendChild(couponCodeDiv);
      if (coupon.description) {
        couponInfo.appendChild(couponDescription);
      }

      // Show Remove button if already applied, Apply button otherwise
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.dataset.couponCode = couponCode;
      
      if (isApplied) {
        actionButton.className = 'btn btn-danger btn-sm remove-coupon-btn';
        actionButton.textContent = 'Remove';
        actionButton.addEventListener('click', () => removeCoupon(couponCode));
      } else {
        actionButton.className = 'btn btn-primary btn-sm apply-coupon-btn';
        actionButton.textContent = 'Apply';
        actionButton.addEventListener('click', () => applyDiscountCode(couponCode));
      }

      couponItem.appendChild(couponInfo);
      couponItem.appendChild(actionButton);
      couponsList.appendChild(couponItem);
    });

    couponsContainer.innerHTML = '';
    couponsContainer.appendChild(couponsList);
  }

  /**
   * Apply discount code to checkout
   */
  async function applyDiscountCode(discountCode) {
    if (!discountCode) {
      alert('Please select a valid coupon code.');
      return;
    }

    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      alert('Checkout session not found. Please refresh the page.');
      return;
    }

    // Prevent re-applying an already applied coupon
    const alreadyAppliedCodes = getAppliedCouponCodes().map(code => String(code).toLowerCase());
    if (alreadyAppliedCodes.includes(String(discountCode).toLowerCase())) {
      alert('This coupon is already applied to your order.');
      return;
    }

    // Find and disable the specific apply button for this coupon
    const applyButtons = document.querySelectorAll('.apply-coupon-btn');
    const targetButton = Array.from(applyButtons).find(btn => btn.dataset.couponCode === discountCode);
    
    // Disable all apply buttons temporarily
    applyButtons.forEach(btn => {
      btn.disabled = true;
      if (btn === targetButton) {
        btn.textContent = 'Applying...';
      }
    });

    try {
      const response = await fetch(`/webstoreapi/checkout/${checkoutToken}/apply-discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          discountCode: discountCode
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to apply discount code');
      }

      // Update applied coupons tracking from response
      if (result.data && result.data.pricing && result.data.pricing.discounts) {
        updateAppliedCouponsTracking(result.data.pricing.discounts);
      } else {
        updateAppliedCouponsTracking([]);
      }

      // Update pricing display
      updateCheckoutPricing(result.data);

      // Refresh available coupons list to update button states
      fetchDiscountCodes();

      // Show success message
      alert(`Coupon "${discountCode}" applied successfully!`);

      // Re-enable all apply buttons (allow multiple applications)
      applyButtons.forEach(btn => {
        btn.disabled = false;
        btn.textContent = 'Apply';
      });
    } catch (error) {
      console.error('[COUPONS] Error applying discount code:', error);
      alert(error.message || 'Failed to apply coupon. Please try again.');
      
      // Re-enable buttons
      applyButtons.forEach(btn => {
        btn.disabled = false;
        btn.textContent = 'Apply';
      });
    }
  }

  /**
   * Update checkout pricing display
   */
  function updateCheckoutPricing(checkoutData) {
    if (!checkoutData || !checkoutData.pricing) return;

    const pricing = checkoutData.pricing;

    // Update subtotal
    const subtotalEl = document.querySelector('[data-summary-subtotal]');
    if (subtotalEl && pricing.subtotalPrice !== undefined) {
      subtotalEl.textContent = formatMoney(pricing.subtotalPrice);
    }

    // Update discount - ensure it's visible and properly formatted
    const discountEl = document.querySelector('[data-summary-discount]');
    const discountLine = document.querySelector('[data-summary-discount-line]');
    
    // Calculate total discounts from discounts array or use totalDiscounts
    let totalDiscounts = 0;
    if (pricing.discounts && Array.isArray(pricing.discounts) && pricing.discounts.length > 0) {
      totalDiscounts = pricing.discounts.reduce((sum, discount) => sum + (discount.amount || discount.value || 0), 0);
    } else if (pricing.totalDiscounts !== undefined) {
      totalDiscounts = pricing.totalDiscounts;
    }
    
    if (totalDiscounts > 0) {
      // Ensure discount line exists and is visible
      if (!discountLine) {
        // Create discount line if it doesn't exist
        const subtotalLine = document.querySelector('[data-summary-subtotal]')?.closest('.summary-line');
        if (subtotalLine) {
          const newDiscountLine = document.createElement('div');
          newDiscountLine.className = 'summary-line summary-discount';
          newDiscountLine.setAttribute('data-summary-discount-line', '');
          newDiscountLine.innerHTML = `
            <span class="summary-label">Discount</span>
            <span class="summary-value" data-summary-discount>-${formatMoney(totalDiscounts)}</span>
          `;
          subtotalLine.insertAdjacentElement('afterend', newDiscountLine);
        }
      } else {
        // Update existing discount line
        if (discountEl) {
          discountEl.textContent = `-${formatMoney(totalDiscounts)}`;
        }
        discountLine.style.display = 'flex';
      }
    } else {
      // Hide discount line if no discount
      if (discountLine) {
        discountLine.style.display = 'none';
      }
    }

    // Update shipping
    const shippingEl = document.querySelector('[data-summary-shipping]');
    if (shippingEl && pricing.totalShipping !== undefined) {
      shippingEl.textContent = pricing.totalShipping === 0 ? 'Free' : formatMoney(pricing.totalShipping);
    }

    // Update tax
    const taxEl = document.querySelector('[data-summary-tax]');
    if (taxEl && pricing.totalTax !== undefined) {
      taxEl.textContent = formatMoney(pricing.totalTax);
    }

    // Update payment fee - use pricing if provided, else selected method's data-payment-fee
    let paymentFee = pricing.paymentMethodFee ?? pricing.paymentFee ?? 0;
    if (paymentFee === 0) {
      const selectedRadio = document.querySelector('input[name="paymentMethod"]:checked');
      if (selectedRadio) {
        paymentFee = parseFloat(selectedRadio.getAttribute('data-payment-fee') || '0') || 0;
      }
    }
    const feeLine = document.querySelector('[data-summary-payment-fee-line]');
    const feeValueEl = document.querySelector('[data-summary-payment-fee]');
    if (feeLine && feeValueEl) {
      const currencySymbol = document.body.dataset.shopCurrencySymbol || (typeof CHECKOUT_CURRENCY_SYMBOL !== 'undefined' ? CHECKOUT_CURRENCY_SYMBOL : '₹');
      feeValueEl.textContent = paymentFee > 0 ? formatMoney(paymentFee) : currencySymbol + '0.00';
      feeLine.style.display = paymentFee > 0 ? 'flex' : 'none';
    }

    // Update total (API totalPrice typically excludes payment fee, so add it)
    const totalEl = document.querySelector('[data-summary-total]');
    if (totalEl && pricing.totalPrice !== undefined) {
      const baseTotal = parseFloat(pricing.totalPrice) || 0;
      totalEl.textContent = formatMoney(baseTotal + (paymentFee || 0));
    }
  }

  /**
   * Format money value
   */
  function formatMoney(amount) {
    if (typeof amount !== 'number') {
      amount = parseFloat(amount) || 0;
    }
    // Use shop settings if available, otherwise default format
    const currencySymbol = typeof CHECKOUT_CURRENCY_SYMBOL !== 'undefined' ? CHECKOUT_CURRENCY_SYMBOL : '₹';
    return `${currencySymbol}${amount.toFixed(2)}`;
  }

  /**
   * Remove applied coupon
   * @param {string} couponCode - The coupon code to remove
   */
  async function removeCoupon(couponCode) {
    if (!couponCode) {
      console.error('[COUPONS] No coupon code provided for removal');
      return;
    }

    const checkoutToken = getCheckoutToken();
    if (!checkoutToken) {
      alert('Checkout session not found. Please refresh the page.');
      return;
    }

    // Find the remove button for this coupon and disable it
    const removeButtons = document.querySelectorAll('.remove-coupon-btn');
    const targetButton = Array.from(removeButtons).find(btn => btn.dataset.couponCode === couponCode);
    
    if (targetButton) {
      targetButton.disabled = true;
      targetButton.textContent = 'Removing...';
    }

    try {
      const response = await fetch(`/webstoreapi/checkout/${checkoutToken}/remove-discount`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          discountCode: couponCode
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove discount code');
      }

      // Update applied coupons tracking from response
      if (result.data && result.data.pricing && result.data.pricing.discounts) {
        updateAppliedCouponsTracking(result.data.pricing.discounts);
      } else {
        // If no discounts in response, clear the tracking
        updateAppliedCouponsTracking([]);
      }

      // Update pricing display
      updateCheckoutPricing(result.data);

      // Refresh available coupons list to update button states
      fetchDiscountCodes();

      // Show success message
      alert(`Coupon "${couponCode}" removed successfully!`);
    } catch (error) {
      console.error('[COUPONS] Error removing coupon:', error);
      alert(error.message || 'Failed to remove coupon. Please try again.');
      
      // Re-enable the button
      if (targetButton) {
        targetButton.disabled = false;
        targetButton.textContent = 'Remove';
      }
    }
  }

  /**
   * Update applied coupons tracking from discounts array
   */
  function updateAppliedCouponsTracking(discounts) {
    // Normalize discounts array
    const normalizedDiscounts = Array.isArray(discounts) ? discounts : [];

    // Update CHECKOUT_PRICING if discounts are provided
    if (typeof CHECKOUT_PRICING !== 'undefined' && CHECKOUT_PRICING) {
      CHECKOUT_PRICING.discounts = normalizedDiscounts;
    }

    // Also keep the global applied coupon list in sync
    const applied = [];
    normalizedDiscounts.forEach(discount => {
      const code = discount.code || discount.couponCode || discount.discountCode;
      if (code && !applied.includes(code)) {
        applied.push(code);
      }
    });
    window.appliedCouponCodes = applied;
  }

  /**
   * Show currently applied coupons from checkout data
   */
  function showAppliedCoupon() {
    // Try to get discounts from checkout pricing data
    let discounts = null;
    
    // First, try from global CHECKOUT_PRICING variable
    if (typeof CHECKOUT_PRICING !== 'undefined' && CHECKOUT_PRICING && CHECKOUT_PRICING.discounts) {
      discounts = CHECKOUT_PRICING.discounts;
    }
    
    // If not available, try to fetch checkout data
    if (!discounts) {
      const checkoutToken = getCheckoutToken();
      if (checkoutToken) {
        // Fetch checkout to get current discounts
        fetch(`/webstoreapi/checkout/${checkoutToken}`)
          .then(res => res.text())
          .then(text => {
            // Some error responses may return HTML instead of JSON.
            // Try to parse JSON; if it fails, gracefully treat as no discounts.
            try {
              return JSON.parse(text);
            } catch (parseError) {
              console.warn('[COUPONS] Non-JSON response while fetching checkout for discounts. Treating as no discounts.', {
                message: parseError.message
              });
              return { success: false, data: null };
            }
          })
          .then(result => {
            if (result.success && result.data && result.data.pricing && result.data.pricing.discounts) {
              updateAppliedCouponsTracking(result.data.pricing.discounts);
            } else {
              updateAppliedCouponsTracking([]);
            }
            // Refresh available coupons to update button states
            fetchDiscountCodes();
          })
          .catch(error => {
            console.error('[COUPONS] Error fetching checkout for discounts:', error);
            updateAppliedCouponsTracking([]);
          });
        return;
      }
    }
    
    updateAppliedCouponsTracking(discounts || []);
  }

  // Initialize coupon functionality on page load
  document.addEventListener('DOMContentLoaded', () => {
    // Fetch discount codes when page loads
    fetchDiscountCodes();
    
    // Show applied coupons if any
    showAppliedCoupon();
  });
})();
