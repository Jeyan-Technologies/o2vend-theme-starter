  (() => {
    'use strict';
    
    // Get product data - prefer global PRODUCT_DATA, fallback to DOM element
    let productData = {};
    if (typeof PRODUCT_DATA !== 'undefined' && PRODUCT_DATA) {
      productData = PRODUCT_DATA;
    } else {
      const productDataEl = document.getElementById('productData');
      productData = productDataEl ? JSON.parse(productDataEl.textContent) : {};
    }
    
    // Ensure productData has required arrays initialized
    if (!productData.combinations) {
      productData.combinations = [];
    }
    if (!productData.variants && !productData.variations) {
      // Try to get from global PRODUCT_VARIANTS
      if (typeof PRODUCT_VARIANTS !== 'undefined' && PRODUCT_VARIANTS) {
        productData.variants = PRODUCT_VARIANTS;
        productData.variations = PRODUCT_VARIANTS;
      } else {
        productData.variants = [];
        productData.variations = [];
      }
    } else if (!productData.variants && productData.variations) {
      productData.variants = productData.variations;
    } else if (!productData.variations && productData.variants) {
      productData.variations = productData.variants;
    }
    if (!productData.subscriptions) {
      productData.subscriptions = [];
    }
    
    // Process combinations to add group metadata
    if (productData.combinations && Array.isArray(productData.combinations)) {
      productData.combinations.forEach(c => {
        try {
          const gd = c.group?.groupDetail;

          c.groupName = gd?.groupName || "Default";
          c.minimumSelectable = gd?.minimumSelectable || 1;
          c.maximumSelectable = gd?.maximumSelectable || 1;
          c.isOptional = gd?.isOptional || false;
        } catch (err) {
          c.groupName = "Default";
          c.minimumSelectable = 1;
          c.maximumSelectable = 1;
          c.isOptional = false;
        }
      });
    }
    // Product state
    let selectedOptions = {};
    let currentVariant = null;
    let currentImageIndex = 0;
    let baseMainImageUrls = [];
    let baseThumbnailImageUrls = [];
    let moneyFormat = typeof SHOP_CURRENCY_SYMBOL !== 'undefined' ? SHOP_CURRENCY_SYMBOL : '₹';
    // DOM elements
    let mainImages, thumbnails, productForm, addToCartBtn, quantityInput, priceElement, priceCompareElement;
    let optionsContainer, galleryModal, galleryModalImage, galleryModalClose;
    let galleryModalPrev, galleryModalNext, galleryModalCounter, galleryZoomBtn, cartMessage;
    
    // Helper function to format money
    function formatMoney(cents) {
        return moneyFormat + (cents).toFixed(2);
    }

    function isCallForPricingEnabled(item) {
      if (!item) return false;
      const value = item.showCallForPricing;
      return value === true || value === 'true' || value === 1 || value === '1';
    }

    function normalizeImageUrl(image) {
      if (!image) return '';
      if (typeof image === 'string') return image;
      if (typeof image !== 'object') return '';
      return image.url || image.Url || image.src || image.Src || image.imageUrl || image.ImageUrl || '';
    }

    function refreshGalleryElements() {
      mainImages = document.querySelectorAll('.gallery-main-image');
      thumbnails = document.querySelectorAll('.gallery-thumbnail');
    }

    function renderGalleryImages(imageUrls) {
      const urls = (imageUrls || []).filter(Boolean);
      if (urls.length === 0) return;

      const galleryMain = document.querySelector('.gallery-main');
      if (!galleryMain) return;

      // Remove existing gallery images/placeholder and rebuild from the active image set.
      galleryMain.querySelectorAll('.gallery-main-image, .gallery-placeholder').forEach(node => node.remove());

      const zoomBtn = document.getElementById('galleryZoomBtn');
      const firstChildAfterImages = zoomBtn || null;
      const productName = productData?.name || productData?.title || 'Product';

      urls.forEach((url, index) => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = `${productName} - ${index + 1}`;
        img.className = `gallery-main-image${index === 0 ? ' active' : ''}`;
        img.dataset.index = String(index);
        img.loading = index === 0 ? 'eager' : 'lazy';
        img.decoding = 'async';
        if (index === 0) {
          img.setAttribute('fetchpriority', 'high');
        }
        if (index === 0) {
          img.id = 'mainProductImage';
        }
        galleryMain.insertBefore(img, firstChildAfterImages);
      });

      let thumbnailsContainer = document.getElementById('galleryThumbnails');
      if (urls.length > 1) {
        if (!thumbnailsContainer) {
          thumbnailsContainer = document.createElement('div');
          thumbnailsContainer.id = 'galleryThumbnails';
          thumbnailsContainer.className = 'gallery-thumbnails';
          const galleryParent = galleryMain.parentElement;
          if (galleryParent) {
            galleryParent.appendChild(thumbnailsContainer);
          }
        }

        thumbnailsContainer.innerHTML = '';
        urls.slice(0, 8).forEach((url, index) => {
          const thumb = document.createElement('button');
          thumb.type = 'button';
          thumb.className = `gallery-thumbnail${index === 0 ? ' active' : ''}`;
          thumb.dataset.image = url;
          thumb.dataset.index = String(index);
          thumb.setAttribute('aria-label', `View image ${index + 1}`);

          const thumbImg = document.createElement('img');
          thumbImg.src = url;
          thumbImg.alt = `${productName} - ${index + 1}`;
          thumbImg.loading = 'lazy';

          thumb.appendChild(thumbImg);
          thumbnailsContainer.appendChild(thumb);
        });
      } else if (thumbnailsContainer) {
        thumbnailsContainer.remove();
      }

      refreshGalleryElements();
      switchToImage(0);
    }

    function restoreBaseGalleryImages() {
      const baseUrls = baseMainImageUrls.length > 0 ? baseMainImageUrls : baseThumbnailImageUrls;
      if (baseUrls.length === 0) return;
      renderGalleryImages(baseUrls);
    }

    function applyVariantGalleryImages(images) {
      const variantUrls = (images || []).map(normalizeImageUrl).filter(Boolean);
      if (variantUrls.length === 0) {
        restoreBaseGalleryImages();
        return;
      }
      renderGalleryImages(variantUrls);
    }
    
    // Consolidated helper: Parse additionalData
    function parseAdditionalData(additionalData) {
      if (!additionalData) return {};
      try {
        return typeof additionalData === "string" 
          ? JSON.parse(additionalData) 
          : additionalData;
      } catch (e) {
        console.warn("Error parsing additionalData:", e);
        return {};
      }
    }
    
    // Consolidated helper: Format date
    function formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Consolidated helper: Get subscription settings
    function getSubscriptionSettings(addData) {
      const isScheduleByCustomer = addData.settings?.isScheduleByCustomer ?? true;
      const isProductChoiceEnabled = addData.settings?.isProductChoiceEnabled ?? true;
      const allProductsRequired = !isScheduleByCustomer || !isProductChoiceEnabled;
      const hasPredefinedFrequency = !isScheduleByCustomer && (addData.frequency || addData.frequencyData);
      
      return {
        isScheduleByCustomer,
        isProductChoiceEnabled,
        allProductsRequired,
        hasPredefinedFrequency,
        predefinedFrequency: addData.frequency || {},
        predefinedFrequencyData: addData.frequencyData || {}
      };
    }
    
    let bundleSelections = {};
    let selectedSubscription = null;
    
    // Helper function to show subscription validation errors
    function showSubscriptionError(message) {
      const errorContainer = document.getElementById("subscriptionValidationMsg");
      if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = message ? "block" : "none";
      }
    }
    
    // Helper function to clear subscription errors
    function clearSubscriptionError() {
      showSubscriptionError("");
    }
    
    // Helper function to show combination validation errors
    function showCombinationError(message) {
      const errorContainer = document.getElementById("combinationValidationMsg");
      if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = message ? "block" : "none";
        // Auto-hide after 5 seconds
        if (message) {
          setTimeout(() => {
            showCombinationError("");
          }, 5000);
        }
      }
    }
    
    // Helper function to calculate shipping start date based on shippingDays only
    function calculateShippingStartDate(shippingDays) {
      const now = new Date();
      const shippingStartDate = new Date();
      
      // Simply add shippingDays to today's date
      // If shippingDays = 1, start date = tomorrow
      // If shippingDays = 2, start date = today + 2 days, etc.
      shippingStartDate.setDate(now.getDate() + shippingDays);
      shippingStartDate.setHours(0, 0, 0, 0);
      
      return shippingStartDate;
    }
    
    // Helper function to calculate correct end date based on start date, expected orders count, and frequency
    function calculateCorrectEndDate(startDateStr, expectedOrdersCount, addData) {
      if (!startDateStr || !expectedOrdersCount) return null;
      
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      
      const predefinedFrequencyData = addData.frequencyData || {};
      const predefinedFrequency = addData.frequency || {};
      
      // Get frequency from predefined data
      const freqOption = predefinedFrequency.selectedOption || predefinedFrequencyData.selectedOption || 'daily';
      let freqOptionNormalized = freqOption.toLowerCase();
      let selectedFreq = 'Daily';
      
      if (predefinedFrequencyData.isDailyFrequency) {
        selectedFreq = 'Daily';
      } else if (predefinedFrequencyData.isWeeklyFrequency) {
        selectedFreq = 'Weekly';
      } else if (predefinedFrequencyData.isMonthlyFrequency) {
        selectedFreq = 'Monthly';
      } else if (predefinedFrequencyData.isAlterNativeFrequency) {
        selectedFreq = 'Alternate Days';
      }
      
      // Get frequency details
      let freqDetails = {};
      if (selectedFreq === 'Weekly') {
        freqDetails.days = predefinedFrequencyData.weeklyFreVals || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      } else if (selectedFreq === 'Alternate Days') {
        freqDetails.days = predefinedFrequencyData.weeklyFreVal || 2;
      } else if (selectedFreq === 'Monthly') {
        freqDetails.day = predefinedFrequencyData.day || 1;
      }
      
      // Calculate end date based on frequency and expected orders count
      let endDate = new Date(startDate);
      
      if (selectedFreq === 'Daily') {
        // Daily: end date = start date + (expectedOrdersCount - 1) days
        endDate.setDate(startDate.getDate() + (expectedOrdersCount - 1));
      } else if (selectedFreq === 'Alternate Days') {
        // Alternate Days: calculate backwards from expected count
        const step = freqDetails.days || 2;
        let currentDate = new Date(startDate);
        let count = 0;
        while (count < expectedOrdersCount) {
          count++;
          if (count < expectedOrdersCount) {
            currentDate.setDate(currentDate.getDate() + step);
          }
        }
        endDate = currentDate;
      } else if (selectedFreq === 'Weekly') {
        // Weekly: find the date that gives us exactly expectedOrdersCount occurrences
        const selectedDays = freqDetails.days || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        let currentDate = new Date(startDate);
        let count = 0;
        
        // Find the end date that gives us exactly expectedOrdersCount
        while (count < expectedOrdersCount) {
          let day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][currentDate.getDay()];
          if (selectedDays.includes(day)) {
            count++;
            if (count === expectedOrdersCount) {
              endDate = new Date(currentDate);
              break;
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
          
          // Safety check to prevent infinite loop
          if (currentDate.getTime() - startDate.getTime() > 365 * 24 * 60 * 60 * 1000) {
            return null;
          }
        }
      } else if (selectedFreq === 'Monthly') {
        // Monthly: calculate based on day of month
        const dom = freqDetails.day || 1;
        let currentDate = new Date(startDate);
        
        // Set to first occurrence of the day in start month
        currentDate.setDate(dom);
        if (currentDate < startDate) {
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(dom);
        }
        
        let count = 0;
        while (count < expectedOrdersCount) {
          const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
          const validDay = Math.min(dom, lastDayOfMonth);
          const validDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), validDay);
          
          if (validDate >= startDate) {
            count++;
            if (count === expectedOrdersCount) {
              endDate = validDate;
              break;
            }
          }
          
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(validDay);
          
          // Safety check
          if (currentDate.getTime() - startDate.getTime() > 365 * 24 * 60 * 60 * 1000) {
            return null;
          }
        }
      }
      
      return endDate;
    }
    
    // Helper function to parse time string (e.g., "14:30", "2:30 PM", or ISO date string)
    function parseTimeString(timeStr) {
      if (!timeStr) return null;
      
      // Handle ISO date strings (e.g., "1970-01-01T07:32:00+00:00" or "1970-01-01T07:32:00.000Z")
      if (timeStr.includes('T') || timeStr.includes('Z') || timeStr.includes('+')) {
        try {
          const date = new Date(timeStr);
          if (!isNaN(date.getTime())) {
            return {
              hours: date.getUTCHours(),
              minutes: date.getUTCMinutes()
            };
          }
        } catch (e) {
          // Fall through to other parsing methods
        }
      }
      
      // Try HH:MM format first
      const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (match24) {
        return {
          hours: parseInt(match24[1], 10),
          minutes: parseInt(match24[2], 10)
        };
      }
      
      // Try 12-hour format with AM/PM
      const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match12) {
        let hours = parseInt(match12[1], 10);
        const minutes = parseInt(match12[2], 10);
        const ampm = match12[3].toUpperCase();
        
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        return { hours, minutes };
      }
      
      return null;
    }
    
    // Helper function to format time for display
    function formatTimeDisplay(timeStr) {
      const time = parseTimeString(timeStr);
      if (!time) return timeStr;
      
      const hours = time.hours;
      const minutes = time.minutes;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      
      return `${displayHours}:${displayMinutes} ${ampm}`;
    }
    
    // Initialize shipping methods dropdown
    function initializeShippingMethods() {
      const shippingSelect = document.getElementById('shippingMethod');
      const shippingDetailsDiv = document.getElementById('shippingMethodDetails');
      
      if (!shippingSelect) return;
      
      // Clear existing options except "Select"
      while (shippingSelect.options.length > 1) {
        shippingSelect.remove(1);
      }
      
      // Get shipping methods from productData
      const shippingMethods = productData.shippingMethods || [];
      
      if (shippingMethods.length === 0) {
        // No shipping methods available
        shippingSelect.innerHTML = '<option value="">No shipping methods available</option>';
        return;
      }
      
      // Populate dropdown with shipping methods
      shippingMethods.forEach((method, index) => {
        try {
          // Parse the data JSON string if it's a string
          let methodData = {};
          if (method.data) {
            if (typeof method.data === 'string') {
              methodData = JSON.parse(method.data);
            } else {
              methodData = method.data;
            }
          }
          
          const description = methodData.description || `Shipping Method ${index + 1}`;
          const shippingDays = methodData.shippingDays || 1;
          const deliveryDays = methodData.deliveryDays || 0;
          const shippingTiming = methodData.shippingTiming || '';
          const deliveryTiming = methodData.deliveryTiming || '';
          const orderCutOffTiming = methodData.orderCutOffTiming || '';
          
          // Create option element
          const option = document.createElement('option');
          option.value = method.shippingClassId || index;
          option.textContent = description;
          option.dataset.shippingDays = shippingDays;
          option.dataset.deliveryDays = deliveryDays;
          option.dataset.shippingTiming = shippingTiming;
          option.dataset.deliveryTiming = deliveryTiming;
          option.dataset.orderCutOffTiming = orderCutOffTiming;
          option.dataset.methodIndex = index;
          
          shippingSelect.appendChild(option);
        } catch (error) {
          console.warn('Error parsing shipping method data:', error, method);
        }
      });
      
      // Add change handler to update start date and end date
      shippingSelect.addEventListener('change', () => {
        const selectedOption = this.options[this.selectedIndex];
        
        if (!selectedOption || !selectedOption.value) {
          if (shippingDetailsDiv) {
            shippingDetailsDiv.style.display = 'none';
          }
          return;
        }
        
        const shippingDays = parseInt(selectedOption.dataset.shippingDays) || 1;
        
        // Calculate shipping start date (only based on shippingDays)
        const shippingStartDate = calculateShippingStartDate(shippingDays);
        
        // Update start date input field
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) {
          // Temporarily enable if disabled to set value (for predefined subscriptions)
          const wasStartDisabled = startDateInput.disabled;
          const wasEndDisabled = endDateInput ? endDateInput.disabled : false;
          
          if (wasStartDisabled) {
            startDateInput.disabled = false;
          }
          startDateInput.value = formatDate(shippingStartDate);
          if (wasStartDisabled) {
            startDateInput.disabled = true;
          }
          
          // Check if this is a predefined subscription - if so, calculate end date
          const addData = parseAdditionalData(productData.additionalData);
          const subSettings = getSubscriptionSettings(addData);
          const expectedOrdersCount = subSettings.hasPredefinedFrequency ? (subSettings.predefinedFrequency.ordersCount) : null;
          
          // For predefined subscriptions, calculate end date based on start date and ordersCount
          if (expectedOrdersCount !== null && expectedOrdersCount !== undefined && endDateInput) {
            const correctEndDate = calculateCorrectEndDate(
              startDateInput.value,
              expectedOrdersCount,
              addData
            );
            
            if (correctEndDate) {
              if (wasEndDisabled) {
                endDateInput.disabled = false;
              }
              endDateInput.value = formatDate(correctEndDate);
              if (wasEndDisabled) {
                endDateInput.disabled = true;
              }
            }
          }
          
          // Trigger change event to recalculate deliverables if it's a subscription
          if (typeof calculateDeliverables === 'function') {
            setTimeout(() => {
              calculateDeliverables();
            }, 100);
          }
        }
        
        // Hide shipping details div (no need to show delivery info)
        if (shippingDetailsDiv) {
          shippingDetailsDiv.style.display = 'none';
        }
      });
      
      // Auto-select shipping method based on shippingClassId for predefined subscriptions
      const addData = parseAdditionalData(productData.additionalData);
      const subSettings = getSubscriptionSettings(addData);
      const shippingClassId = addData.settings?.shippingClassId;
      
      // If predefined subscription and shippingClassId exists, auto-select matching shipping method
      if (!subSettings.isScheduleByCustomer && shippingClassId !== null && shippingClassId !== undefined) {
        // Find matching shipping method
        for (let i = 0; i < shippingSelect.options.length; i++) {
          const option = shippingSelect.options[i];
          if (option.value == shippingClassId || parseInt(option.value) === parseInt(shippingClassId)) {
            shippingSelect.selectedIndex = i;
            // Trigger change event to auto-set dates
            shippingSelect.dispatchEvent(new Event('change'));
            break;
          }
        }
      }
    }
    
    // Helper function to show user-friendly success/error messages
    // Delegate to the global Theme notification system so that
    // product detail uses the same bottom-center toast as other entry points.
    function showUserMessage(message, type = 'success') {
      if (window.Theme && typeof window.Theme.showNotification === 'function') {
        window.Theme.showNotification(message, type, 3000);
        return;
      }

      // Fallback to inline cartMessage banner if Theme is not available
      const cartMessage = document.getElementById('cartMessage');
      const cartMessageText = cartMessage ? cartMessage.querySelector('.cart-message-text') : null;
      
      if (cartMessage && cartMessageText) {
        cartMessageText.textContent = message;
        
        // Update styling based on message type
        if (type === 'success') {
          cartMessage.style.color = '#059669';
          cartMessage.style.backgroundColor = 'transparent';
          cartMessage.style.border = 'none';
        } else if (type === 'error') {
          cartMessage.style.color = '#b70000';
          cartMessage.style.backgroundColor = '#ffe6e6';
          cartMessage.style.border = '1px solid #b70000';
          cartMessage.style.borderRadius = '4px';
          cartMessage.style.padding = '12px';
        }
        
        cartMessage.style.display = 'block';
        
        // Auto-hide after appropriate time
        const hideDelay = type === 'success' ? 3000 : 5000;
        setTimeout(() => {
          cartMessage.style.display = 'none';
        }, hideDelay);
      }
    }

    function openLoginModal() {
      if (window.Theme && typeof window.Theme.openLoginModal === 'function') {
        window.Theme.openLoginModal();
        return true;
      }
      if (window.CartManager && typeof window.CartManager.openLoginModal === 'function') {
        window.CartManager.openLoginModal();
        return true;
      }
      const loginTrigger = document.querySelector('[data-login-modal-trigger]');
      if (loginTrigger) {
        loginTrigger.click();
        return true;
      }
      return false;
    }
    
    // Validate subscription before submission
    function validateSubscription() {
      // Check if this is a subscription product
      if (productData.productType != 90) {
        return { valid: true };
      }
      
      // Check if at least one subscription item is selected (only if customer can choose)
      const addData = parseAdditionalData(productData.additionalData);
      const subSettings = getSubscriptionSettings(addData);
      
      // If customer can choose products, validate selection
      if (!subSettings.allProductsRequired) {
        const selectedSubs = document.querySelectorAll(".subscription-item.selected");
        if (!selectedSubs || selectedSubs.length === 0) {
          return { 
            valid: false, 
            message: "Please select at least one subscription item" 
          };
        }
        
        // Check minimum subscription items requirement
        const minSelectable = addData.minimumSelectable || addData.settings?.minimumSelectable || addData.settings?.minSubscriptionProducts || 1;
        if (selectedSubs.length < minSelectable) {
          return { 
            valid: false, 
            message: `Please select at least ${minSelectable} subscription item(s)` 
          };
        }
      }
      
      // Check if frequency is selected (skip if predefined)
      if (!subSettings.hasPredefinedFrequency) {
        if (!selectedFrequency) {
          return { 
            valid: false, 
            message: "Please select a subscription frequency" 
          };
        }
        
        // Check if weekly frequency has at least one day selected
        if (selectedFrequency === "Weekly") {
          if (!frequencyDetails.days || frequencyDetails.days.length === 0) {
            return { 
              valid: false, 
              message: "Please select at least one day for weekly delivery" 
            };
          }
        }
      }
      
      // Validate dates
      const dateValidation = validateDates();
      if (!dateValidation.valid) {
        return dateValidation;
      }
      
      // If there's a predefined frequency with ordersCount, validate that calculated count matches
      const expectedOrdersCount = subSettings.hasPredefinedFrequency ? (subSettings.predefinedFrequency.ordersCount) : null;
      if (expectedOrdersCount !== null && expectedOrdersCount !== undefined) {
        const liveOrderCount = document.querySelector(".liveOrderCount");
        const calculatedCount = liveOrderCount ? parseInt(liveOrderCount.textContent) : 0;
        if (calculatedCount !== expectedOrdersCount) {
          return {
            valid: false,
            message: `The selected dates result in ${calculatedCount} deliveries, but this subscription requires exactly ${expectedOrdersCount} deliveries. Please adjust your dates.`
          };
        }
      }
      
      return { valid: true };
    }
    
    // Helper function to validate dates
    function validateDates() {
      const startDateInput = document.getElementById("startDate");
      const endDateInput = document.getElementById("endDate");
      
      if (!startDateInput || !endDateInput) return { valid: true };
      
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if start date is provided
      if (!startDate) {
        return { valid: false, message: "Please select a start date" };
      }
      
      // Check if end date is provided
      if (!endDate) {
        return { valid: false, message: "Please select an end date" };
      }
      
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      
      // Check if start date is in the past
      if (start < today) {
        return { valid: false, message: "Start date cannot be in the past" };
      }
      
      // Check if end date is before start date
      if (end < start) {
        return { valid: false, message: "End date must be after start date" };
      }
      
      return { valid: true };
    }
    
    // Set minimum date to today for date inputs
    function initializeDateInputs() {
      const startDateInput = document.getElementById("startDate");
      const endDateInput = document.getElementById("endDate");
      
      // Check if we have predefined frequency data with dates
      const addData = parseAdditionalData(productData.additionalData);
      const subSettings = getSubscriptionSettings(addData);
      const ordersCount = subSettings.predefinedFrequencyData.ordersCount || subSettings.predefinedFrequency.ordersCount;
      
      // If predefined subscription, disable date inputs
      if (!subSettings.isScheduleByCustomer) {
        if (startDateInput) {
          startDateInput.disabled = true;
          startDateInput.style.backgroundColor = '#f5f5f5';
          startDateInput.style.cursor = 'not-allowed';
          startDateInput.setAttribute('readonly', 'readonly');
        }
        if (endDateInput) {
          endDateInput.disabled = true;
          endDateInput.style.backgroundColor = '#f5f5f5';
          endDateInput.style.cursor = 'not-allowed';
          endDateInput.setAttribute('readonly', 'readonly');
        }
      }
      
      // For predefined subscriptions, dates will be auto-set when shipping method is selected
      // No need to set dates here - they will be set by the shipping method change handler
      
      if (startDateInput && !startDateInput.disabled) {
        // Use local date formatting to avoid timezone issues
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        startDateInput.setAttribute('min', todayStr);
        startDateInput.addEventListener('change', () => {
          const validation = validateDates();
          if (!validation.valid) {
            showSubscriptionError(validation.message);
            return;
          }
          
          // Update end date min to be start date
          if (endDateInput && this.value) {
            endDateInput.setAttribute('min', this.value);
          }
          
          // Check if this is a predefined subscription - if so, recalculate end date
          const addData = parseAdditionalData(productData.additionalData);
          const subSettings = getSubscriptionSettings(addData);
          const expectedOrdersCount = subSettings.hasPredefinedFrequency ? (subSettings.predefinedFrequency.ordersCount) : null;
          
          // For predefined subscriptions, recalculate end date to match deliverables
          if (expectedOrdersCount !== null && expectedOrdersCount !== undefined && endDateInput) {
            const correctEndDate = calculateCorrectEndDate(
              this.value,
              expectedOrdersCount,
              addData
            );
            
            if (correctEndDate) {
              endDateInput.value = formatDate(correctEndDate);
            }
          }
          
          clearSubscriptionError();
          calculateDeliverables();
        });
      }
      
      if (endDateInput && !endDateInput.disabled) {
        endDateInput.addEventListener('change', () => {
          const validation = validateDates();
          if (!validation.valid) {
            showSubscriptionError(validation.message);
            return;
          }
          
          // Check if this is a predefined subscription that requires exact deliverables
          const addData = parseAdditionalData(productData.additionalData);
          const subSettings = getSubscriptionSettings(addData);
          const expectedOrdersCount = subSettings.hasPredefinedFrequency ? (subSettings.predefinedFrequency.ordersCount) : null;
          
          // For predefined subscriptions, enforce exact deliverables count
          if (expectedOrdersCount !== null && expectedOrdersCount !== undefined) {
            // Calculate deliverables with current dates
            calculateDeliverables();
            
            // Wait a moment for calculation to complete, then check
            setTimeout(() => {
              const liveOrderCount = document.querySelector(".liveOrderCount");
              const calculatedCount = liveOrderCount ? parseInt(liveOrderCount.textContent) : 0;
              
              if (calculatedCount !== expectedOrdersCount) {
                // End date doesn't match required deliverables - reset it
                const correctEndDate = calculateCorrectEndDate(
                  startDateInput.value,
                  expectedOrdersCount,
                  addData
                );
                
                if (correctEndDate) {
                  endDateInput.value = formatDate(correctEndDate);
                  
                  // Recalculate with correct end date
                  calculateDeliverables();
                  
                  // Show validation message
                  showSubscriptionError(`End Date must match ${expectedOrdersCount} deliveries. The date has been adjusted.`);
                } else {
                  showSubscriptionError(`End Date must match ${expectedOrdersCount} deliveries. Please adjust your dates.`);
                }
              } else {
                clearSubscriptionError();
              }
            }, 50);
          } else {
            // Not a predefined subscription, allow normal calculation
            clearSubscriptionError();
            calculateDeliverables();
          }
        });
      }
    }
    
    function renderSubscriptionUI() {
  const container = document.getElementById("subscriptionPlanContainer");
  if (!container || !productData.subscriptions) {
    container.innerHTML = "<p>No subscription items available.</p>";
    return;
  }

  const subscriptions = productData.subscriptions;

  const addData = parseAdditionalData(productData.additionalData);

  // Check for minimumSelectable in additionalSettings (try root level first, then settings)
  const minSelectable = addData.minimumSelectable || addData.settings?.minimumSelectable || addData.settings?.minSubscriptionProducts || 1;
  const maxSelectable = addData.maximumSelectable || addData.settings?.maximumSelectable || addData.settings?.maxSubscriptionProducts || 1;
  const quantityChangeAllowed = addData.settings?.isQuantityChangeAllowed ?? true;
  const subSettings = getSubscriptionSettings(addData);

  container.innerHTML = "";
  let selectedCount = 0;
  
  // Show info message if all products are required (will be updated with frequency details later)
  const infoMessageEl = document.getElementById("subscriptionInfoMessage");
  if (infoMessageEl && subSettings.allProductsRequired) {
    // Build product list with quantities
    let productList = subscriptions.map(sub => {
      const qty = sub.quantity || minSelectable;
      return `${sub.name || 'Product'} (Qty: ${qty})`;
    }).join(', ');
    
    // Initial message (will be updated with frequency details)
    infoMessageEl.innerHTML = `
      <div class="info-message-content">
        <strong>You will get the below products in this subscription with their respective quantities:</strong><br>
        ${productList}
      </div>
    `;
    infoMessageEl.style.display = "block";
  } else if (infoMessageEl) {
    infoMessageEl.style.display = "none";
  }

  subscriptions.forEach((sub) => {
    let quantity = sub.quantity || minSelectable;

    const subDiv = document.createElement("div");
    subDiv.className = "subscription-item";
    subDiv.dataset.subId = sub.productId;

    // If all products are required, checkbox should be checked and disabled
    const isRequired = subSettings.allProductsRequired;
    
    const checkboxClass = isRequired ? 'sub-select sub-select-required' : 'sub-select';
    subDiv.innerHTML = `
      <div class="subscription-item-content">
        <input 
          type="checkbox" 
          class="${checkboxClass}"
          aria-label="${isRequired ? 'Included' : 'Select'} ${sub.name || 'subscription item'}"
          id="sub-checkbox-${sub.productId}"
          ${isRequired ? 'checked disabled' : ''}
        >
        <div>
         <input type="hidden" class="sub-id" value="${sub.productId}">
          <h4 class="subscription-item-title">${sub.name}${isRequired ? ' <span class="subscription-included">(Included)</span>' : ''}</h4>
          <div class="subscription-spec">${sub.specification || ''}</div>
          <div class="subscription-item-meta">
            Price: <span class="sub-price">${formatMoney(sub.prices.price)}</span>
          </div>
        </div>
      </div>

      <div class="subscription-item-right">
        <div class="subscription-item-actions">
          <button 
            type="button" 
            class="qty-btn minus"
            aria-label="Decrease quantity for ${sub.name || 'item'}"
          >&minus;</button>
          <span class="qty-value" aria-live="polite">${quantity}</span>
          <button 
            type="button" 
            class="qty-btn plus"
            aria-label="Increase quantity for ${sub.name || 'item'}"
          >+</button>
        </div>
        <div class="subscription-item-meta">
          Total: <span class="sub-total">${formatMoney(sub.prices.price * quantity)}</span>
        </div>
      </div>
    `;

    const qtyValueEl = subDiv.querySelector(".qty-value");
    const totalEl = subDiv.querySelector(".sub-total");
    const plusBtn = subDiv.querySelector(".plus");
    const minusBtn = subDiv.querySelector(".minus");
    const checkbox = subDiv.querySelector(".sub-select");

    const updateTotal = () => {
      totalEl.textContent = formatMoney(sub.prices.price * quantity);
      updateSubscriptionPriceUI();
    };

    

    //=====================================
    // QUANTITY BEHAVIOR
    //=====================================
    if (quantityChangeAllowed === false) {
      // â— disable buttons completely
      plusBtn.disabled = true;
      minusBtn.disabled = true;
    }
    else {
      plusBtn.addEventListener("click", () => {
        // Sanitize: ensure quantity is a positive integer
        quantity = Math.max(1, Math.floor(quantity) + 1);
        qtyValueEl.textContent = quantity;
        updateTotal();
      });

      minusBtn.addEventListener("click", () => {
        // Sanitize: ensure quantity doesn't go below minimum
        const newQuantity = Math.max(minSelectable, Math.floor(quantity) - 1);
        if (newQuantity < quantity) {
          quantity = newQuantity;
          qtyValueEl.textContent = quantity;
          updateTotal();
        }
      });
    }
    //=====================================
    // CHECKBOX SELECTION (line items)
    //=====================================
    
    // If all products are required, mark as selected and don't allow changes
    if (isRequired) {
      checkbox.checked = true;
      subDiv.classList.add("selected");
      selectedCount++;
    } else {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          if (selectedCount >= maxSelectable) {
            checkbox.checked = false;
            showSubscriptionError(`You can select only ${maxSelectable} subscription item${maxSelectable > 1 ? 's' : ''}.`);
            return;
          }
          selectedCount++;
          subDiv.classList.add("selected");
          clearSubscriptionError();
        } else {
          selectedCount--;
          subDiv.classList.remove("selected");
        }
        updateSubscriptionPriceUI();
      });
    }

    container.appendChild(subDiv);
  });

  // Auto-select items based on isScheduleByCustomer
  if (subSettings.allProductsRequired) {
    // If isScheduleByCustomer is false, select ALL items
    const subscriptionItems = container.querySelectorAll(".subscription-item");
    subscriptionItems.forEach(item => {
      const checkbox = item.querySelector(".sub-select");
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        item.classList.add("selected");
        selectedCount++;
      }
    });
    if (subscriptionItems.length > 0) {
      updateSubscriptionPriceUI();
    }
  } else if (minSelectable > 0 && subscriptions.length > 0) {
    // Otherwise, auto-select minimum required items
    const subscriptionItems = container.querySelectorAll(".subscription-item");
    let selected = 0;
    for (let i = 0; i < subscriptionItems.length && selected < minSelectable; i++) {
      const checkbox = subscriptionItems[i].querySelector(".sub-select");
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        subscriptionItems[i].classList.add("selected");
        selected++;
        selectedCount++;
      }
    }
    if (selected > 0) {
      updateSubscriptionPriceUI();
    }
  }

  // Check if frequency is predefined (isScheduleByCustomer is false and frequency exists)
  if (subSettings.hasPredefinedFrequency) {
    // Use predefined frequency data
    const predefinedFrequency = subSettings.predefinedFrequency;
    const predefinedFrequencyData = subSettings.predefinedFrequencyData;
    
    // Set frequency from predefined data
    const freqOption = predefinedFrequency.selectedOption || predefinedFrequencyData.selectedOption || 'daily';
    let freqOptionNormalized = freqOption.toLowerCase();
    
    // Map frequency options
    if (freqOptionNormalized === 'daily' || predefinedFrequencyData.isDailyFrequency) {
      selectedFrequency = 'Daily';
    } else if (freqOptionNormalized === 'weekly' || predefinedFrequencyData.isWeeklyFrequency) {
      selectedFrequency = 'Weekly';
    } else if (freqOptionNormalized === 'monthly' || predefinedFrequencyData.isMonthlyFrequency) {
      selectedFrequency = 'Monthly';
    } else if (freqOptionNormalized === 'alternate' || freqOptionNormalized === 'alternate days' || predefinedFrequencyData.isAlterNativeFrequency) {
      selectedFrequency = 'Alternate Days';
    } else {
      selectedFrequency = freqOption.charAt(0).toUpperCase() + freqOption.slice(1);
    }
    
    // Use ordersCount from frequencyData if available
    const ordersCount = predefinedFrequencyData.ordersCount || predefinedFrequency.ordersCount;
    
    // Set frequencyDetails for calculation
    // Handle Weekly frequency - ensure days array is properly set
    let weeklyDays = null;
    if (selectedFrequency === 'Weekly') {
      // weeklyFreVals should be an array of day names, or we default to all days
      if (predefinedFrequencyData.weeklyFreVals && Array.isArray(predefinedFrequencyData.weeklyFreVals) && predefinedFrequencyData.weeklyFreVals.length > 0) {
        weeklyDays = predefinedFrequencyData.weeklyFreVals;
      } else {
        // Default to all days if not specified (once per week)
        weeklyDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      }
    }
    
    frequencyDetails = {
      type: selectedFrequency,
      days: weeklyDays || (selectedFrequency === 'Alternate Days' ? (predefinedFrequencyData.weeklyFreVal || 2) : null),
      day: predefinedFrequencyData.day || (selectedFrequency === 'Monthly' ? (predefinedFrequencyData.day || 1) : null)
    };
    
    // Display frequency UI with predefined selection
    // Render frequency UI with default selection from predefined data
    renderFrequencyUI(selectedFrequency, frequencyDetails);
    
    // Update info message with frequency details
    updateSubscriptionInfoMessage(selectedFrequency, ordersCount, frequencyDetails);
    
    // Calculate deliverables based on dates (will validate against ordersCount)
    setTimeout(() => {
      calculateDeliverables();
    }, 100);
  } else {
    // Render frequency UI for customer selection
    renderFrequencyUI();
  }
  
  initializeDateInputs();
}

// Helper function to update subscription info message with frequency details
function updateSubscriptionInfoMessage(frequency, ordersCount, frequencyDetails) {
  const infoMessageEl = document.getElementById("subscriptionInfoMessage");
  if (!infoMessageEl || infoMessageEl.style.display === "none") return;
  
  const addData = parseAdditionalData(productData.additionalData);
  
  const subSettings = getSubscriptionSettings(addData);
  
  if (subSettings.allProductsRequired && productData.subscriptions) {
    // Build product list with quantities
    const minSelectable = addData.minimumSelectable || addData.settings?.minimumSelectable || addData.settings?.minSubscriptionProducts || 1;
    let productList = productData.subscriptions.map(sub => {
      const qty = sub.quantity || minSelectable;
      return `${sub.name || 'Product'} (Qty: ${qty})`;
    }).join(', ');
    
    // Build frequency text with details
    let frequencyText = '';
    if (frequency) {
      let frequencyDetail = '';
      if (frequencyDetails) {
        if (frequency === 'Alternate Days' && frequencyDetails.days) {
          frequencyDetail = ` (every ${frequencyDetails.days} days)`;
        } else if (frequency === 'Weekly' && frequencyDetails.days && Array.isArray(frequencyDetails.days) && frequencyDetails.days.length > 0) {
          frequencyDetail = ` (${frequencyDetails.days.join(', ')} each week)`;
        } else if (frequency === 'Monthly' && frequencyDetails.day) {
          frequencyDetail = ` (day ${frequencyDetails.day} of each month)`;
        }
      }      
      
    }
    
    infoMessageEl.innerHTML = `
      <div class="info-message-content">
        <strong>You will get the below products in this subscription with their respective quantities:</strong><br>
      </div>
    `;
  }
}



    let selectedFrequency = null;
    let frequencyDetails = {};

    function renderFrequencyUI(defaultFrequency, defaultFrequencyDetails) {
      const container = document.getElementById("frequencyContainer");
      if (!container) return;
      container.innerHTML = "";

      const frequencyOptions = ["Daily", "Alternate Days", "Weekly", "Monthly"];

      const title = document.createElement("h4");
      title.innerHTML = "Select Subscription Frequency: <span class='required-indicator'>*</span>";
      title.style.marginBottom = "10px";
      container.appendChild(title);

      const frequencyOptionsContainer = document.createElement("div");
      frequencyOptionsContainer.style.display = "flex";
      frequencyOptionsContainer.style.flexWrap = "wrap";
      frequencyOptionsContainer.style.gap = "10px";
      container.appendChild(frequencyOptionsContainer);

      const detailsContainer = document.createElement("div");
      detailsContainer.id = "frequencyDetailsContainer";
      detailsContainer.style.marginTop = "15px";
      container.appendChild(detailsContainer);

      // Check if this is a predefined frequency (read-only)
      const isPredefined = defaultFrequency !== null && defaultFrequency !== undefined;
      
      frequencyOptions.forEach(option => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = option;
        btn.className = "freq-ui";
        btn.setAttribute("aria-label", `Select ${option} frequency`);

        // Pre-select if this is the default frequency
        if (isPredefined && option === defaultFrequency) {
          btn.classList.add("selected");
          selectedFrequency = option;
          // Set frequencyDetails from predefined data
          if (defaultFrequencyDetails) {
            frequencyDetails = JSON.parse(JSON.stringify(defaultFrequencyDetails));
          }
        }

        // If predefined, disable buttons (read-only display)
        if (isPredefined) {
          btn.disabled = true;
          btn.style.opacity = option === defaultFrequency ? "1" : "0.5";
          btn.style.cursor = "not-allowed";
        } else {
          // Allow selection for non-predefined frequencies
          btn.addEventListener("click", () => {
            selectedFrequency = option;
            frequencyDetails = {};

            frequencyOptionsContainer.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            renderFrequencyDetails(option, detailsContainer);
            calculateDeliverables();
          });
        }

        frequencyOptionsContainer.appendChild(btn);
      });

      // Render frequency details if default frequency is set
      if (isPredefined && defaultFrequency) {
        renderFrequencyDetails(defaultFrequency, detailsContainer, defaultFrequencyDetails, isPredefined);
      }
    }

function renderFrequencyDetails(frequency, container, predefinedDetails, isPredefined) {
  container.innerHTML = "";

  if (frequency === "Daily") {
    container.innerHTML = `<p>Occurs every day.</p>`;
    if (!isPredefined) {
      frequencyDetails.type = "Daily";
    }

  } else if (frequency === "Alternate Days") {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "10px";

    const label = document.createElement("span");
    label.textContent = "Every";

    const input = document.createElement("input");
    input.type = "number";
    input.min = 1;
    input.value = predefinedDetails?.days || 2;
    input.className = "freq-ui";
    input.style.width = "60px";
    input.style.textAlign = "center";
    input.setAttribute("aria-label", "Number of days between deliveries");
    
    if (isPredefined) {
      input.disabled = true;
      input.style.backgroundColor = "#f5f5f5";
      input.style.cursor = "not-allowed";
    } else {
      input.addEventListener("input", () => {
        frequencyDetails.type = "Alternate Days";
        frequencyDetails.days = parseInt(input.value) || 2;
        calculateDeliverables();
      });
    }

    const text = document.createElement("span");
    text.textContent = "days";

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(text);
    container.appendChild(wrapper);
    
    if (!isPredefined) {
      frequencyDetails.type = "Alternate Days";
      frequencyDetails.days = parseInt(input.value) || 2;
    }

  } else if (frequency === "Weekly") {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const wrapper = document.createElement("div");
    wrapper.className = "weekly-days";

    // Use predefined days if available, otherwise empty array
    const predefinedDays = predefinedDetails?.days || [];
    if (!isPredefined) {
      frequencyDetails.days = [];
    }

    days.forEach(day => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = day;
      btn.className = "freq-ui";
      btn.setAttribute("aria-label", `Select ${day} for weekly delivery`);
      
      // Pre-select days from predefined data
      if (isPredefined && predefinedDays.includes(day)) {
        btn.classList.add("selected");
        if (!frequencyDetails.days) frequencyDetails.days = [];
        if (!frequencyDetails.days.includes(day)) {
          frequencyDetails.days.push(day);
        }
      }
      
      if (isPredefined) {
        btn.disabled = true;
        btn.style.opacity = predefinedDays.includes(day) ? "1" : "0.5";
        btn.style.cursor = "not-allowed";
      } else {
        btn.addEventListener("click", () => {
          if (frequencyDetails.days.includes(day)) {
            frequencyDetails.days = frequencyDetails.days.filter(d => d !== day);
            btn.classList.remove("selected");
          } else {
            frequencyDetails.days.push(day);
            btn.classList.add("selected");
          }
          calculateDeliverables();
        });
      }

      wrapper.appendChild(btn);
    });

    container.appendChild(wrapper);

  } else if (frequency === "Monthly") {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "10px";

    const label = document.createElement("span");
    label.textContent = "Day of month:";

    const input = document.createElement("input");
    input.type = "number";
    input.min = 1;
    input.max = 31;
    input.value = predefinedDetails?.day || 1;
    input.className = "freq-ui";
    input.style.width = "60px";
    input.style.textAlign = "center";
    input.setAttribute("aria-label", "Day of month for monthly delivery");
    
    if (isPredefined) {
      input.disabled = true;
      input.style.backgroundColor = "#f5f5f5";
      input.style.cursor = "not-allowed";
    } else {
      input.addEventListener("input", () => {
        frequencyDetails.type = "Monthly";
        frequencyDetails.day = parseInt(input.value) || 1;
        calculateDeliverables();
      });
    }

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
    
    if (!isPredefined) {
      frequencyDetails.type = "Monthly";
      frequencyDetails.day = parseInt(input.value) || 1;
    }
  }
}

// -------------------------------------
// DELIVERY COUNT CALCULATOR
// -------------------------------------
function calculateDeliverables() {
  try {
    // Check if we have predefined frequency with ordersCount
    const addData = parseAdditionalData(productData.additionalData);
    
    const subSettings = getSubscriptionSettings(addData);
    
    // Check if there's a predefined ordersCount to validate against
    const expectedOrdersCount = subSettings.hasPredefinedFrequency ? (subSettings.predefinedFrequency.ordersCount) : null;
    
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    
    if (!startDateInput || !endDateInput) return;
    
    const start = startDateInput.value;
    const end = endDateInput.value;

    // Validate dates before calculating
    const dateValidation = validateDates();
    if (!dateValidation.valid) {
      showSubscriptionError(dateValidation.message);
      const liveOrderCount = document.querySelector(".liveOrderCount");
      if (liveOrderCount) liveOrderCount.textContent = "0";
      return;
    }
    
    clearSubscriptionError();

    // If predefined frequency, always get selectedFrequency from predefined data
    let currentSelectedFrequency = selectedFrequency;
    if (subSettings.hasPredefinedFrequency) {
      // Always use predefined frequency data to ensure accuracy
      const predefinedFrequencyData = subSettings.predefinedFrequencyData;
      const freqOption = subSettings.predefinedFrequency.selectedOption || predefinedFrequencyData.selectedOption || 'daily';
      let freqOptionNormalized = freqOption.toLowerCase();
      if (predefinedFrequencyData.isDailyFrequency) {
        currentSelectedFrequency = 'Daily';
      } else if (predefinedFrequencyData.isWeeklyFrequency) {
        currentSelectedFrequency = 'Weekly';
      } else if (predefinedFrequencyData.isMonthlyFrequency) {
        currentSelectedFrequency = 'Monthly';
      } else if (predefinedFrequencyData.isAlterNativeFrequency) {
        currentSelectedFrequency = 'Alternate Days';
      } else {
        // Fallback to option name
        currentSelectedFrequency = freqOption.charAt(0).toUpperCase() + freqOption.slice(1);
      }
    }

    if (!start || !end || !currentSelectedFrequency) {
      const liveOrderCount = document.querySelector(".liveOrderCount");
      if (liveOrderCount) liveOrderCount.textContent = "0";
      return;
    }

  let count = 0;
  let startDate = new Date(start);
  let endDate = new Date(end);

  // Normalize to midnight
  startDate.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);

  // Get frequencyDetails for predefined frequencies if not set globally
  let currentFrequencyDetails = frequencyDetails || {};
  if (subSettings.hasPredefinedFrequency && (!currentFrequencyDetails || Object.keys(currentFrequencyDetails).length === 0)) {
    const predefinedFrequencyData = subSettings.predefinedFrequencyData;
    // Handle Weekly frequency - ensure days array is properly set
    let weeklyDays = null;
    if (currentSelectedFrequency === 'Weekly') {
      // weeklyFreVals should be an array of day names, or we default to all days
      if (predefinedFrequencyData.weeklyFreVals && Array.isArray(predefinedFrequencyData.weeklyFreVals) && predefinedFrequencyData.weeklyFreVals.length > 0) {
        weeklyDays = predefinedFrequencyData.weeklyFreVals;
      } else {
        // Default to all days if not specified
        weeklyDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      }
    }
    
    currentFrequencyDetails = {
      type: currentSelectedFrequency,
      days: weeklyDays || (currentSelectedFrequency === 'Alternate Days' ? (predefinedFrequencyData.weeklyFreVal || 2) : null),
      day: predefinedFrequencyData.day || (currentSelectedFrequency === 'Monthly' ? (predefinedFrequencyData.day || 1) : null)
    };
  }
  
  // Also ensure frequencyDetails is set globally for future calculations
  if (subSettings.hasPredefinedFrequency && (!frequencyDetails || Object.keys(frequencyDetails).length === 0)) {
    frequencyDetails = currentFrequencyDetails;
  }

  // ----------------------------------------
  // DAILY = every single day including both ends
  // ----------------------------------------
  if (currentSelectedFrequency === "Daily") {
    count = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  }

  // ----------------------------------------
  // ALTERNATE DAYS
  // Deliver every X days from start
  // Including starting day
  // ----------------------------------------
  else if (currentSelectedFrequency === "Alternate Days") {
    let step = currentFrequencyDetails.days || 2;

    for (let d = new Date(startDate), i = 0; d <= endDate; d.setDate(d.getDate() + step), i++) {
      count++;
    }
  }

  // ----------------------------------------
  // WEEKLY
  // Selected specific days of week
  // ----------------------------------------
  else if (currentSelectedFrequency === "Weekly") {
    let selectedDays = currentFrequencyDetails.days || [];
    
    // If no days specified, default to all days (once per week = 7 days)
    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      selectedDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    }

    // Count occurrences of selected days within the date range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      let day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
      if (selectedDays.includes(day)) count++;
    }
  }

  // ----------------------------------------
  // MONTHLY
  // Day of month (e.g. 5 â†’ 5th every month)
  // Handles invalid dates (e.g., Feb 31) by using last day of month
  // ----------------------------------------
  else if (currentSelectedFrequency === "Monthly") {
    let dom = currentFrequencyDetails.day || 1;

    // Start from the first occurrence of the day in the start month
    let currentDate = new Date(startDate);
    currentDate.setDate(dom);
    
    // If the date is before start date, move to next month
    if (currentDate < startDate) {
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(dom);
    }

    // Count occurrences until we exceed end date
    while (currentDate <= endDate) {
      // Check if date is valid (handles cases like Feb 31)
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const validDay = Math.min(dom, lastDayOfMonth);
      
      // Create valid date
      const validDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), validDay);
      
      if (validDate >= startDate && validDate <= endDate) {
        count++;
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(validDay);
    }
  }

    const liveOrderCount = document.querySelector(".liveOrderCount");
    if (liveOrderCount) {
      liveOrderCount.textContent = count;
    }
    
    // If there's an expected order count, validate against it
    if (expectedOrdersCount !== null && expectedOrdersCount !== undefined) {
      if (count !== expectedOrdersCount) {
        showSubscriptionError(`The selected dates result in ${count} deliveries, but this subscription requires exactly ${expectedOrdersCount} deliveries. Please adjust your dates.`);
      } else {
        // Clear any previous errors when count matches
        clearSubscriptionError();
      }
    } else {
      // If no expected count, clear any errors
      clearSubscriptionError();
    }
    
    updateSubscriptionPriceUI();
  } catch (error) {
    console.error("Error calculating deliverables:", error);
    showSubscriptionError("Error calculating delivery count. Please check your dates.");
    const liveOrderCount = document.querySelector(".liveOrderCount");
    if (liveOrderCount) liveOrderCount.textContent = "0";
  }
}


function updateSubscriptionPriceUI() {
  try {
    let total = 0;
    const liveOrderCountEl = document.querySelector(".liveOrderCount");
    let deliverables = liveOrderCountEl ? parseInt(liveOrderCountEl.textContent) || 1 : 1;
    
    // Parse additionalData if needed
    const additionalData = parseAdditionalData(productData.additionalData);
    
    let items = [];
    // Must explicitly check IsSubscriptionPrice
    if (additionalData.IsSubscriptionPrice === true) {
      const subSettings = getSubscriptionSettings(additionalData);

      // If isScheduleByCustomer is false, include ALL subscription products
      if (subSettings.allProductsRequired) {
        // Get all subscription products from productData
        const allSubscriptions = productData.subscriptions || [];
        allSubscriptions.forEach(sub => {
          const quantity = sub.quantity || 1;
          const price = parseFloat(sub.prices?.price || sub.price || 0);
          const subId = parseInt(sub.productId || sub.id || 0);
          
          if (subId > 0 && price >= 0) {
            items.push({
              id: subId,
              name: sub.name || '',
              quantity: quantity,
              price: price,
              orderTotal: price * quantity
            });
            total += price * quantity;
          }
        });
        
        // For predefined subscriptions, check if orderTotal is already provided
        // If orderTotal exists, it's already the total for all deliveries, don't multiply
        const predefinedOrderTotal = additionalData.subscriptionDetails?.orderTotal;
        if (predefinedOrderTotal) {
          // Use the predefined orderTotal directly (already includes all deliveries)
          deliverables = Math.max(1, deliverables);
          total = total * deliverables;
          total = total;
        } else {
          // If no predefined orderTotal, calculate from perOrderPrice if available
          const perOrderPrice = additionalData.settings?.perOrderPrice;
          if (perOrderPrice) {
            total = parseFloat(perOrderPrice) || total;
            // Multiply by deliverables only if using perOrderPrice
            deliverables = Math.max(1, deliverables);
            total = total * deliverables;
          } else {
            // Fallback: multiply calculated total by deliverables
            deliverables = Math.max(1, deliverables);
            total = total * deliverables;
          }
        }
      } else {
        // â›³ find ALL selected subscriptions (customer can choose)
        const selectedSubs = document.querySelectorAll(".subscription-item.selected");
        
        selectedSubs.forEach(subItem => {
          const idEl = subItem.querySelector(".sub-id");
          const priceEl = subItem.querySelector(".sub-price");
          const qtyEl = subItem.querySelector(".qty-value");
          const nameEl = subItem.querySelector("h4");

          // Sanitize and validate inputs
          let price = parseFloat(priceEl.textContent.replace(/[^\d.-]/g, '')) || 0;
          let qty = Math.max(1, parseInt(qtyEl.textContent) || 1); // Ensure positive integer
          let subId = parseInt(idEl.value) || 0;
          let name = nameEl ? nameEl.textContent.replace(/\s*\(Included\)/g, '').trim() : '';

          if (subId > 0 && price >= 0 && qty > 0) {
            items.push({
              id: subId,
              name: name,
              quantity: qty,
              price: price,
              orderTotal: price * qty
            });
            total += price * qty;
          }
        });
        
        // For customer-selectable subscriptions, multiply by deliverables
        deliverables = Math.max(1, deliverables);
        total = total * deliverables;
      }

    } else {
      total = productData.price || 0;
      // For non-subscription products, multiply by deliverables
      deliverables = Math.max(1, deliverables);
      total = total * deliverables;
    }
    
    if (priceElement) {
      priceElement.textContent = formatMoney(total);
    }
    updateSubscriptionData(items, deliverables, total);
  } catch (error) {
    console.error("Error updating subscription price UI:", error);
    showSubscriptionError("Error calculating price. Please refresh the page.");
  }
}

function updateSubscriptionData(items, deliverables, priceTotal) {
  try {
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    
    if (!startDateInput || !endDateInput) return;

    let startDate = startDateInput.value;
    let endDate = endDateInput.value;

    // Validate and sanitize dates
    if (!startDate || !endDate) return;

    // ensure ISO dates
    let isoStart = startDate ? new Date(startDate).toISOString() : null;
    let isoEnd = endDate ? new Date(endDate).toISOString() : null;
    
    // Validate dates are valid
    if (isoStart && isNaN(new Date(isoStart).getTime())) {
      console.warn("Invalid start date");
      return;
    }
    if (isoEnd && isNaN(new Date(isoEnd).getTime())) {
      console.warn("Invalid end date");
      return;
    }

  // Get original settings from additionalData to preserve isScheduleByCustomer and other settings
  let originalAddData = {};
  try {
    const originalDataEl = document.getElementById('productData');
    if (originalDataEl) {
      const originalProductData = JSON.parse(originalDataEl.textContent);
      originalAddData = parseAdditionalData(originalProductData.additionalData);
    }
  } catch (e) {
    console.warn("Error parsing original additionalData:", e);
  }

  let subscriptionPayload = {
    QuantityVariation: [],
    IsCombinationPrice: false,

    settings: {
      isScheduleByCustomer: originalAddData.settings?.isScheduleByCustomer ?? true,
      typeOfOrder: originalAddData.settings?.typeOfOrder ?? 10,
      // Set shipping class based on order count (deliverables)
      // Use original shippingClassId if available, otherwise calculate based on order count
      // Default to 3 if no order count, otherwise use order count (capped at reasonable max)
      shippingClassId: originalAddData.settings?.shippingClassId || (deliverables > 0 ? Math.max(3, Math.min(deliverables, 50)) : 3),
      offersSetting: originalAddData.settings?.offersSetting || [],
      perOrderPrice: deliverables > 0 ? priceTotal / deliverables : priceTotal,
      nextBillDate: originalAddData.settings?.nextBillDate || null,
      startDate: isoStart,
      endDate: isoEnd,
      isProductChoiceEnabled: originalAddData.settings?.isProductChoiceEnabled ?? true,
      isQuantityChangeAllowed: originalAddData.settings?.isQuantityChangeAllowed ?? true,
      minSubscriptionProducts: originalAddData.settings?.minSubscriptionProducts ?? 1,
      maxSubscriptionProducts: originalAddData.settings?.maxSubscriptionProducts ?? 100
    },

    subscriptionDetails: {
      shippingFeeAmount: originalAddData.subscriptionDetails?.shippingFeeAmount || 0,
      paymentFeeAmount: originalAddData.subscriptionDetails?.paymentFeeAmount || 0,
      roundOff: originalAddData.subscriptionDetails?.roundOff || 0,
      discountAmount: originalAddData.subscriptionDetails?.discountAmount || 0,
      subscriptionCoupon: originalAddData.subscriptionDetails?.subscriptionCoupon || {},
      orderTotal: priceTotal.toFixed(2)
    },

    IsSubscriptionPrice: true,

    paymentSettings: {
      detectPaymentFromLP: true,
      createInvoiceWithoutPayment: true
    },

    QuantityManualInput: false,

    items: items,

    frequency: originalAddData.frequency || {
      selectedOption: selectedFrequency?.toLowerCase(),
      timeFre: originalAddData.frequency?.timeFre || null,
      ordersCount: deliverables
    },
    frequencyData: {
      ...(originalAddData.frequencyData || {}),
      selectedOption: selectedFrequency?.toLowerCase() || originalAddData.frequencyData?.selectedOption,
      ordersCount: deliverables || originalAddData.frequencyData?.ordersCount || originalAddData.frequency?.ordersCount,
      startDate: isoStart || originalAddData.frequencyData?.startDate,
      endDate: isoEnd || originalAddData.frequencyData?.endDate,
      isDailyFrequency: (selectedFrequency == "Daily") || originalAddData.frequencyData?.isDailyFrequency || false,
      isWeeklyFrequency: (selectedFrequency == "Weekly") || originalAddData.frequencyData?.isWeeklyFrequency || false,
      isAlterNativeFrequency: (selectedFrequency == "Alternate Days") || originalAddData.frequencyData?.isAlterNativeFrequency || false,
      isMonthlyFrequency: (selectedFrequency == "Monthly") || originalAddData.frequencyData?.isMonthlyFrequency || false,
      isYearlyFrequency: originalAddData.frequencyData?.isYearlyFrequency || false
    }
  };

    // ðŸ§  replace original product additional data
    productData.additionalData = subscriptionPayload;

    console.log("UPDATED additionalData:", subscriptionPayload);
  } catch (error) {
    console.error("Error updating subscription data:", error);
    showSubscriptionError("Error updating subscription settings. Please try again.");
  }
}


  function toggleComboSelection(btn) {
      const group = btn.dataset.group;
      const productId = btn.dataset.productId;
      const item = productData.combinations.find(x => x.productId == productId);

      if (!bundleSelections[group]) bundleSelections[group] = [];

      const selected = bundleSelections[group];

      // deselect
      if (selected.includes(productId)) {
        bundleSelections[group] = selected.filter(x => x !== productId);
        btn.classList.remove("selected");
        updateBundlePriceUI();
        return;
      }

      // ENFORCE MAX RULE
      if (selected.length >= item.maximumSelectable) {
        showCombinationError(`You can select only ${item.maximumSelectable} item${item.maximumSelectable > 1 ? 's' : ''} from "${item.groupName}".`);
        return;
      }

      // select
      bundleSelections[group].push(productId);
      btn.classList.add("selected");

      updateBundlePriceUI();
    }

    //-------------------------------
    // VALIDATE BEFORE CART ADDING
    //-------------------------------
    function validateBundle() {
      for (const group in bundleSelections) {
        const items = productData.combinations.filter(x => x.groupName == group);
        const min = items[0].minimumSelectable;
        const selectedCount = bundleSelections[group].length;

        if (selectedCount < min) {
          showCombinationError(`Please select at least ${min} item${min > 1 ? 's' : ''} from "${group}".`);
          return false;
        }
      }
      return true;
    }

  function updateBundlePriceUI() {
    let total = 0;
    const items = [];

    // Don't interfere with subscription products (productType == 90)
    const isSubscriptionProduct = productData.productType == 90;
    
    // Parse additionalData (string â†’ JSON)
    const additionalData = parseAdditionalData(productData.additionalData);

    // Check if this is a combination product
    const hasCombinations = productData.combinations && productData.combinations.length > 0;
    
    if (hasCombinations && Object.keys(bundleSelections).length > 0) {
      // Combination-based pricing - build Items array
      for (const g in bundleSelections) {
        bundleSelections[g].forEach(productId => {
          const item = productData.combinations.find(c => c.productId == productId);
          if (item) {
            const quantity = item.quantity || 1;
            total += item.prices.price * quantity;
            
            // Add to Items array for additionalSettings
            items.push({
              Id: parseInt(item.productId),
              Name: item.name || '',
              Price: parseFloat(item.prices.price || 0),
              Quantity: parseInt(quantity)
            });
          }
        });
      }
      
      // Only update additionalData for combination products (not subscription products)
      if (!isSubscriptionProduct) {
        // Update additionalData with only Items structure
        productData.additionalData = {
          Items: items
        };
      }
    } else if (hasCombinations && !isSubscriptionProduct) {
      // Use main product price
      total = productData.prices.price || 0;
      
      // Clear additionalData if no combinations selected (only for non-subscription products)
      productData.additionalData = {
        Items: []
      };
    } else {
      // Use main product price or existing pricing logic
      if (additionalData.IsCombinationPrice === true && hasCombinations) {
        // Combination-based pricing from existing data
        for (const g in bundleSelections) {
          bundleSelections[g].forEach(productId => {
            const item = productData.combinations.find(c => c.productId == productId);
            if (item) {
              total += item.prices.price * (item.quantity || 1);
            }
          });
        }
      } else {
        // Use main product price
        total = productData.prices.price || 0;
      }
    }

    if (priceElement) {
      priceElement.textContent = formatMoney(total);
    }
  }

    // Build option groups from variants
    function buildOptionGroups() {
      const variants = productData.variations || productData.variants || [];
      const combinations = productData.combinations || [];
      const subscriptions = productData.subscriptions || [];
      if ((!variants || variants.length === 0) && (!combinations || combinations.length === 0) && (!subscriptions || subscriptions.length === 0)) return null;
      
      if(combinations && combinations.length > 0){
        renderCombinationUI();
      }

      if(subscriptions && subscriptions.length > 0){
        renderSubscriptionUI();
      }
      if (variants || variants.length > 0) {
            const optionGroups = {};
            
            // Process each variation
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
                  optionGroups[mappedName].values.set(value, {
                    value: value,
                    available: variation.inStock !== false && variation.available !== false,
                    images: variation.images || [],
                    combinationId: combinations.length > 0 ? combinations[0].productId : variation.productId
                  });
                }
              });
            });
            
            return optionGroups;
      }
    }
    
    // Render option groups
    function renderOptionGroups() {
      const optionGroups = buildOptionGroups();
      if (!optionGroups || Object.keys(optionGroups).length === 0) return;
      
      optionsContainer.innerHTML = '';
      const variants = productData.variations || productData.variants || [];

      // Initialize option selections from a real variant so multi-option products
      // (e.g. Color + Size) start with a valid combination.
      const initialVariant = variants.find(v => v && v.inStock !== false && v.available !== false) || variants[0];
      if (initialVariant && Array.isArray(initialVariant.options)) {
        initialVariant.options.forEach(opt => {
          const optName = (opt.optionName || 'Option').toLowerCase().replace(/[^a-z]/g, '');
          let mappedName = optName;
          if (optName.includes('color') || optName.includes('colour')) {
            mappedName = 'color';
          } else if (optName.includes('size')) {
            mappedName = 'size';
          }
          if (!selectedOptions[mappedName]) {
            selectedOptions[mappedName] = opt.value || '';
          }
        });
      }
      
      // Sort options: color first, then size, then others
      const sortedKeys = Object.keys(optionGroups).sort((a, b) => {
        const order = { color: 1, size: 2 };
        return (order[a] || 99) - (order[b] || 99);
      });
      
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
        
        // Convert Map values to an array
        const valuesArray = Array.from(group.values.values());
        valuesArray.forEach((valueObj, index) => {
          if (!selectedOptions[key] && valueObj.available) {
            selectedOptions[key] = valueObj.value;
          } else if (!selectedOptions[key] && index === 0) {
            selectedOptions[key] = valueObj.value;
          }
          
          const button = document.createElement('button');
          button.type = 'button';
          // Add .product-option-btn class so global click handler can detect these buttons
          button.className = `option-value option-value-${group.type} product-option-btn ${(selectedOptions[key] === valueObj.value) ? 'selected' : ''} ${!valueObj.available ? 'disabled' : ''}`;
          button.dataset.optionKey = key;
          button.dataset.optionValue = valueObj.value;
          button.dataset.combinationId = valueObj.combinationId;
          button.dataset.available = valueObj.available;
          
          if (group.type === 'color') {
            // Color swatch
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
      
      // Find initial variant
      findMatchingVariant();
    }

  
    function renderCombinationUI() {
      const combos = productData.combinations || [];
      if (combos.length === 0) return;

      const grouped = {};
      combos.forEach(c => {
        if (!grouped[c.groupName]) grouped[c.groupName] = [];
        grouped[c.groupName].push(c);
      });

      const container = document.getElementById("comboContainer");
      container.innerHTML = "";

      Object.keys(grouped).forEach(groupName => {
        const items = grouped[groupName];

        const header = document.createElement("div");
        header.className = "combo-group-header";
        header.innerHTML = `<strong>${groupName}</strong> (Select ${items[0].minimumSelectable}-${items[0].maximumSelectable})`;
        container.appendChild(header);

        const groupDiv = document.createElement("div");
        groupDiv.className = "combo-group";

        items.forEach(item => {
          const card = document.createElement("div");
          card.className = "combo-card";
          card.dataset.group = groupName;
          card.dataset.productId = item.productId;
          card.dataset.price = item.prices.price;

          card.innerHTML = `
          <div class="combo-image">
            <img src="${item.thumbnailImage1.url}" alt="${item.name}" />
            <div class="combo-checkbox">
              <label>
                <input type="checkbox" />
                <span class="checkbox-custom"></span>
              </label>
            </div>
          </div>
          <div class="combo-info">
            <span class="combo-name">${item.name} Ã— 1</span>
            <span class="combo-price">${formatMoney(item.prices.price)}</span>
          </div>`;

          card.addEventListener("click", () => toggleComboSelection(card));
          groupDiv.appendChild(card);
        });

      container.appendChild(groupDiv);
      });

      // â¬‡ï¸ AUTO SELECT MINIMUM REQUIRED CARDS IN EACH GROUP
      Object.keys(grouped).forEach(groupName => {
        const items = grouped[groupName];
        const minSelectable = items[0]?.minimumSelectable || 1;
        
        // Get all cards for this group
        const groupCards = Array.from(container.querySelectorAll(`.combo-card[data-group="${groupName}"]`));
        
        // Select minimum required items
        let selected = 0;
        for (let i = 0; i < groupCards.length && selected < minSelectable; i++) {
          const card = groupCards[i];
          if (card && !card.classList.contains("selected")) {
            card.classList.add("selected");
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) {
              checkbox.checked = true;
            }

            if (!bundleSelections[groupName]) bundleSelections[groupName] = [];
            bundleSelections[groupName].push(card.dataset.productId);
            selected++;
          }
        }
      });

    updateBundlePriceUI();
  }

    
    // Find matching variant based on selected options
    function findMatchingVariant() {
      const variants = productData.variations || productData.variants || [];
      
      // If no variants, use base product
      if (variants.length === 0) {
        currentVariant = {
          productId: productData.productId,
          price: productData.price,
          mrp: productData.mrp,
          showCallForPricing: productData.showCallForPricing,
          inStock: productData.inStock,
          available: productData.available
        };
        updateVariantUI();
        return;
      }
      
      // Find matching variation
      for (const variation of variants) {
        const options = variation.options || [];
        let matches = true;
        
        for (const [key, value] of Object.entries(selectedOptions)) {
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
          currentVariant = {
            productId: variation.productId,
            price: (variation.prices && variation.prices.price) || productData.price,
            mrp: (variation.prices && variation.prices.mrp) || productData.mrp,
            showCallForPricing: variation.showCallForPricing,
            inStock: variation.inStock !== false,
            available: variation.available !== false,
            images: variation.images || [],
            stockQuantity: variation.stockQuantity || 0
          };
          updateVariantUI();
          return;
        }
      }
      
      // If no match found, use first variation
      if (variants.length > 0) {
        const firstVar = variants[0];
        currentVariant = {
          productId: firstVar.productId,
          price: (firstVar.prices && firstVar.prices.price) || productData.price,
          mrp: (firstVar.prices && firstVar.prices.mrp) || productData.mrp,
          showCallForPricing: firstVar.showCallForPricing,
          inStock: firstVar.inStock !== false,
          available: firstVar.available !== false,
          images: firstVar.images || [],
          stockQuantity: firstVar.stockQuantity || 0
        };
      } else {
        currentVariant = {
          productId: productData.productId,
          price: productData.price,
          mrp: productData.mrp,
          showCallForPricing: productData.showCallForPricing,
          inStock: productData.inStock,
          available: productData.available
        };
      }
      
      updateVariantUI();
    }
    
    // Update UI based on selected variant
    // Update product attributes based on current variant
    function updateAttributesUI() {
      if (!currentVariant) return;

      try {
        const variants = productData.variations || productData.variants || [];
        const matchingVariant = variants.find(v => v.productId === currentVariant.productId);

        // Select all attribute cards
        const attributeCards = document.querySelectorAll('.attributes-card[data-attribute-name]');
        if (!attributeCards || attributeCards.length === 0) return;

        // Build map of possible attribute values from the variant
        const attributeValueMap = {};

        if (matchingVariant) {
          // variantAttributes
          if (matchingVariant.variantAttributes && Array.isArray(matchingVariant.variantAttributes)) {
            matchingVariant.variantAttributes.forEach(a => {
              const name = a.name || a.attributeName;
              if (name) attributeValueMap[name] = a.value;
            });
          }

          // options
          if (matchingVariant.options && Array.isArray(matchingVariant.options)) {
            matchingVariant.options.forEach(o => {
              const name = o.optionName || o.name;
              if (name) attributeValueMap[name] = o.value;
            });
          }

          // attributes root
          if (matchingVariant.attributes && Array.isArray(matchingVariant.attributes)) {
            matchingVariant.attributes.forEach(a => {
              const name = a.name || a.attributeName;
              if (name) attributeValueMap[name] = a.value;
            });
          }

          // additionalData
          if (matchingVariant.additionalData) {
            let add = matchingVariant.additionalData;
            if (typeof add === 'string') {
              try { add = JSON.parse(add); } catch(e) { add = null; }
            }
            if (add && add.attributes && Array.isArray(add.attributes)) {
              add.attributes.forEach(a => {
                const name = a.name || a.attributeName;
                if (name) attributeValueMap[name] = a.value;
              });
            }
          }
        }

        // Update DOM cards
        attributeCards.forEach(card => {
          const name = card.getAttribute('data-attribute-name');
          const base = card.getAttribute('data-base-value');
          const valueEl = card.querySelector('.attribute-value-text');
          if (!valueEl) return;

          // exact or case-insensitive match
          let newVal = null;
          if (attributeValueMap[name]) newVal = attributeValueMap[name];
          else {
            for (const k in attributeValueMap) {
              if (k && k.toLowerCase() === (name || '').toLowerCase()) { newVal = attributeValueMap[k]; break; }
            }
          }

          if (newVal !== null && newVal !== undefined) {
            valueEl.textContent = newVal;
            valueEl.setAttribute('data-current-value', newVal);
          } else if (base !== null && base !== undefined) {
            valueEl.textContent = base;
            valueEl.setAttribute('data-current-value', base);
          }
        });
      } catch (err) {
        console.error('Error updating attributes UI', err);
      }
    }
    
    function updateVariantUI() {
      if (!currentVariant) return;
      
      // Update price
      if (priceElement) {
        const showCallForPricing = isCallForPricingEnabled(currentVariant) || isCallForPricingEnabled(productData);
        if (showCallForPricing) {
          priceElement.textContent = 'Call for pricing';
        } else {
          const currentPrice = Number(currentVariant.price || 0);
          priceElement.textContent = formatMoney(currentPrice);
        }
      }

      if (priceCompareElement) {
        const showCallForPricing = isCallForPricingEnabled(currentVariant) || isCallForPricingEnabled(productData);
        if (showCallForPricing) {
          priceCompareElement.style.display = 'none';
        } else {
          const currentPrice = Number(currentVariant.price || 0);
          const currentMrp = Number(currentVariant.mrp || 0);
          if (currentMrp > currentPrice) {
            priceCompareElement.textContent = formatMoney(currentMrp);
            priceCompareElement.style.display = '';
          } else {
            priceCompareElement.style.display = 'none';
          }
        }
      }
      
      // Update availability
      if (addToCartBtn) {
        addToCartBtn.disabled = !currentVariant.available;
        const btnText = addToCartBtn.querySelector('.btn-text');
        if (btnText) {
          if(productData.productType == 90){
            btnText.textContent =  'Subscribe';
          }else{
            btnText.textContent = currentVariant.available ? 'Add to Cart' : 'Out of Stock';
          }
        }
      }
      
      if (currentVariant.images && currentVariant.images.length > 0) {
        applyVariantGalleryImages(currentVariant.images);
      } else {
        restoreBaseGalleryImages();
      }
      
      // Update quantity max
      if (quantityInput && currentVariant.stockQuantity) {
        quantityInput.max = currentVariant.stockQuantity;
      }
      
      // Update product attributes based on variant
      updateAttributesUI();
    }
    
    // Switch to image by index
    function switchToImage(index) {
      if (!mainImages || mainImages.length === 0) return;
      
      mainImages.forEach((img, i) => {
        if (i === index) {
          img.classList.add('active');
          currentImageIndex = index;
        } else {
          img.classList.remove('active');
        }
      });
      
      updateThumbnails();
    }
    
    // Update thumbnails active state
    function updateThumbnails() {
      if (!thumbnails || thumbnails.length === 0) return;
      thumbnails.forEach((thumb, index) => {
        if (parseInt(thumb.dataset.index) === currentImageIndex) {
          thumb.classList.add('active');
        } else {
          thumb.classList.remove('active');
        }
      });
    }

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".product-option-btn");
      if (!btn) return;

      const key = btn.dataset.optionKey;
      const value = btn.dataset.optionValue;

      // Update selected option state
      if (key && value !== undefined) {
        selectedOptions[key] = value;
      }

      // Toggle selected styling within this option group
      document.querySelectorAll(`.product-option-btn[data-option-key="${key}"]`)
        .forEach(b => b.classList.remove("selected"));

      btn.classList.add("selected");

      // Recalculate matching variant and refresh UI (price, stock, images, attributes, etc.)
      findMatchingVariant();
    });
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
      // Initialize DOM elements
      refreshGalleryElements();
      baseMainImageUrls = Array.from(mainImages || []).map(img => img?.getAttribute('src') || img?.src || '').filter(Boolean);
      baseThumbnailImageUrls = Array.from(thumbnails || []).map(thumb => {
        const thumbImg = thumb.querySelector('img');
        return thumb?.dataset?.image || thumbImg?.getAttribute('src') || thumbImg?.src || '';
      }).filter(Boolean);
      productForm = document.getElementById('productForm');
      addToCartBtn = document.getElementById('addToCartBtn');
      quantityInput = document.getElementById('quantity');
      priceElement = document.getElementById('productPrice');
      priceCompareElement = document.querySelector('.price-compare');
      optionsContainer = document.getElementById('productOptionsContainer');
      galleryModal = document.getElementById('galleryModal');
      galleryModalImage = document.getElementById('galleryModalImage');
      galleryModalClose = document.getElementById('galleryModalClose');
      galleryModalPrev = document.getElementById('galleryModalPrev');
      galleryModalNext = document.getElementById('galleryModalNext');
      galleryModalCounter = document.getElementById('galleryModalCounter');
      galleryZoomBtn = document.getElementById('galleryZoomBtn');
      cartMessage = document.getElementById('cartMessage');
      
      // Render option groups
      renderOptionGroups();
      
      // Initialize shipping methods
      initializeShippingMethods();
      
      // Initialize Product Attributes Tabs
      const attributeTabLinks = document.querySelectorAll('.attributes-tab-link');
      attributeTabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const tabId = e.currentTarget.getAttribute('data-tab');
          
          // Remove active class from all links and panes
          attributeTabLinks.forEach(l => l.classList.remove('active'));
          document.querySelectorAll('.attributes-tab-pane').forEach(pane => pane.classList.remove('active'));
          
          // Add active class to clicked link and corresponding pane
          e.currentTarget.classList.add('active');
          e.currentTarget.setAttribute('aria-selected', 'true');
          
          const activePane = document.getElementById(tabId);
          if (activePane) {
            activePane.classList.add('active');
          }
        });
      });
      
      // Image Gallery Thumbnails (delegated, supports dynamic thumbnail rebuild)
      document.addEventListener('click', (e) => {
        const thumbnail = e.target.closest('.gallery-thumbnail');
        if (!thumbnail) return;
        const imageIndex = parseInt(thumbnail.dataset.index, 10);
        if (Number.isFinite(imageIndex)) {
          switchToImage(imageIndex);
        }
      });
      
      // Option selection
      document.addEventListener('click', (e) => {
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
        selectedOptions[optionKey] = optionValue;
        
        // Find matching variant
        findMatchingVariant();
        
        // Explicitly update attributes immediately
        setTimeout(() => {
          updateAttributesUI();
        }, 50);
      });
      
      // Quantity Controls
      const decreaseBtn = document.querySelector('.quantity-decrease');
      const increaseBtn = document.querySelector('.quantity-increase');
      
      if (decreaseBtn && quantityInput) {
        decreaseBtn.addEventListener('click', () => {
          const val = parseInt(quantityInput.value) || 1;
          if (val > 1) {
            quantityInput.value = val - 1;
          }
        });
      }
      
      if (increaseBtn && quantityInput) {
        increaseBtn.addEventListener('click', () => {
          const val = parseInt(quantityInput.value) || 1;
          const max = parseInt(quantityInput.max) || 99;
          if (val < max) {
            quantityInput.value = val + 1;
          }
        });
      }
      
      // Add to Cart
      if (productForm && addToCartBtn) {
        productForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          if (addToCartBtn.disabled || addToCartBtn.classList.contains('loading')) return;
          
          const productId = currentVariant ? currentVariant.productId : productData.productId;
          const quantity = quantityInput != null && quantityInput.value != null && quantityInput.value != ""? parseInt(quantityInput.value)  : 1;
          
          addToCartBtn.classList.add('loading');
          const btnText = addToCartBtn.querySelector('.btn-text');
          if (btnText) {
            btnText.textContent = 'Adding...';
          }
          
          try {
            // Validate subscription before submission
            if (productData.productType == 90) {
              const validation = validateSubscription();
              if (!validation.valid) {
                showSubscriptionError(validation.message);
                addToCartBtn.classList.remove('loading');
                if (btnText) {
                  btnText.textContent = productData.productType == 90 ? 'Subscribe' : 'Add to Cart';
                }
                return;
              }
              clearSubscriptionError();
            }
            
            // Validate combination products before submission
            const hasCombinations = productData.combinations && productData.combinations.length > 0;
            if (hasCombinations) {
              const bundleValidation = validateBundle();
              if (!bundleValidation) {
                addToCartBtn.classList.remove('loading');
                if (btnText) {
                  btnText.textContent = 'Add to Cart';
                }
                return;
              }
            }

            // Store variation image in localStorage before adding to cart
            if (currentVariant && currentVariant.images && currentVariant.images.length > 0) {
              const firstVariantImage = currentVariant.images[0];
              const variantImageUrl = typeof firstVariantImage === 'string' 
                ? firstVariantImage 
                : (firstVariantImage.url || firstVariantImage.Url || firstVariantImage);
              
              if (variantImageUrl) {
                // Store variation image for this productId
                const imageKey = `variantImage_${productId}`;
                try {
                  localStorage.setItem(imageKey, variantImageUrl);
                } catch (e) {
                  console.warn('Failed to store variant image in localStorage:', e);
                }
              }
            }

            let bodyData = {
              productId: parseInt(productId),
              quantity: quantity
            };

            // If product type is subscription â†’ attach Additional Settings
            if (productData.productType == 90) {
              try {
                bodyData.additionalSettings = typeof(productData.additionalData) == "string" 
                  ? productData.additionalData 
                  : JSON.stringify(productData.additionalData);
              } catch(e) {
                console.warn("Invalid additionalData JSON");
                showSubscriptionError("Error preparing subscription data. Please try again.");
                addToCartBtn.classList.remove('loading');
                if (btnText) {
                  btnText.textContent = productData.productType == 90 ? 'Subscribe' : 'Add to Cart';
                }
                return;
              }
            }
            // If product has combinations (and is NOT a subscription) â†’ attach Additional Settings with Items array
            else {
              const hasCombinations = productData.combinations && productData.combinations.length > 0;
              if (hasCombinations) {
                try {
                  // Ensure bundle selections are up to date
                  updateBundlePriceUI();
                  
                  // Get the Items array from additionalData
                  const combinationData = productData.additionalData || {};
                  const items = combinationData.Items || [];
                  
                  // Only include additionalSettings if there are selected items
                  if (items.length > 0) {
                    bodyData.additionalSettings = JSON.stringify({
                      Items: items
                    });
                  }
                } catch(e) {
                  console.warn("Error preparing combination data:", e);
                  addToCartBtn.classList.remove('loading');
                  if (btnText) {
                    btnText.textContent = 'Add to Cart';
                  }
                  return;
                }
              }
            }

            const response = await fetch('/webstoreapi/carts/add', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify(bodyData)
            });

            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            let data = {};

            if (isJson) {
              data = await response.json();
            } else if (!response.ok) {
              // Non-JSON error response (often auth/session middleware HTML response)
              if (response.status === 401 || response.status === 403 || response.status === 404) {
                openLoginModal();
                if (btnText) {
                  btnText.textContent = productData.productType == 90 ? 'Subscribe' : 'Add to Cart';
                }
                addToCartBtn.classList.remove('loading');
                return;
              }
              throw new Error('Failed to add to cart');
            }

            const responseMessage = String(data.error || data.message || '').toLowerCase();
            const looksAuthError =
              data.requiresAuth ||
              response.status === 401 ||
              response.status === 403 ||
              response.status === 404 ||
              responseMessage.includes('auth') ||
              responseMessage.includes('login') ||
              responseMessage.includes('sign in') ||
              responseMessage.includes('unauthorized') ||
              responseMessage.includes('forbidden') ||
              responseMessage.includes('session');

            if (looksAuthError) {
              openLoginModal();
              if (btnText) {
                btnText.textContent = productData.productType == 90 ? 'Subscribe' : 'Add to Cart';
              }
              addToCartBtn.classList.remove('loading');
              return;
            }
            
            if (data.success) {
              // Fetch cart count after successful add to ensure instant update (like other pages)
              // Use CartManager to get cart count, which uses /carts/quantity API
              let cartCount = 0;
              try {
                if (window.CartManager && typeof window.CartManager.getCartCount === 'function') {
                  // Force refresh to get the latest count after adding item
                  cartCount = await window.CartManager.getCartCount(true);
                  // Update cart data with the fetched count
                  data.data = data.data || {};
                  data.data.itemCount = cartCount;
                  // Dispatch cart updated event to update all badges instantly
                  if (window.CartManager && typeof window.CartManager.dispatchCartUpdated === 'function') {
                    window.CartManager.dispatchCartUpdated({ itemCount: cartCount, cart: data.data });
                  }
                } else {
                  // Fallback to direct fetch if CartManager not available
                  const countResponse = await fetch('/webstoreapi/carts/quantity', {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { 'Accept': 'application/json' }
                  });
                  if (countResponse.ok) {
                    const countData = await countResponse.json();
                    if (countData.success && countData.data) {
                      cartCount = countData.data.cartQuantity || 0;
                      data.data = data.data || {};
                      data.data.itemCount = cartCount;
                      // Fallback: update badges manually if CartManager not available
                      const countElements = document.querySelectorAll('[data-cart-count]');
                      countElements.forEach(element => {
                        element.textContent = cartCount;
                        element.setAttribute('data-cart-count', cartCount.toString());
                        if (cartCount > 0) {
                          element.removeAttribute('style');
                        } else {
                          const isDrawerTitle = element.closest('.cart-drawer-title');
                          if (!isDrawerTitle) {
                            element.style.display = 'none';
                          }
                        }
                      });
                    }
                  }
                }
              } catch (e) {
                console.warn('Failed to fetch cart count after add:', e);
                // If we have itemCount in the response, use it as fallback
                if (data.data && (data.data.itemCount !== undefined || data.data.items)) {
                  cartCount = data.data.itemCount || (data.data.items ? data.data.items.length : 0);
                }
              }
              
              // Show success message - match widget format
              const successMessage = productData.productType == 90 
                ? 'Subscription added to cart successfully!' 
                : 'Product added to cart!';
              showUserMessage(successMessage, 'success');
              
              if (btnText) {
                btnText.textContent = productData.productType == 90 ? 'Subscribe' : 'Add to Cart';
              }
              addToCartBtn.classList.remove('loading');
              
              // Clear any validation errors
              clearSubscriptionError();
              showCombinationError("");
              
              // Update cart UI with the latest data (includes total and count)
              if (window.Theme && typeof window.Theme.updateCartUI === 'function') {
                window.Theme.updateCartUI(data.data);
              } else if (window.theme && typeof window.theme.updateCartUI === 'function') {
                window.theme.updateCartUI(data.data);
              }
            } else {
              throw new Error(data.error || 'Failed to add to cart');
            }
          } catch (error) {
            console.error('Error adding to cart:', error);

            const errorMessage = String(error.message || '').toLowerCase();
            const isAuthCookiePresent =
              document.cookie.includes('O2VENDIsUserLoggedin=true') ||
              document.cookie.includes('O2VENDIsUserLoggedin=1') ||
              document.cookie.includes('O2VENDUserToken=');
            const looksAuthError =
              errorMessage.includes('auth') ||
              errorMessage.includes('login') ||
              errorMessage.includes('sign in') ||
              errorMessage.includes('unauthorized') ||
              errorMessage.includes('forbidden') ||
              errorMessage.includes('session');

            if (looksAuthError || !isAuthCookiePresent) {
              openLoginModal();
            } else {
              // Show user-friendly error message for non-auth failures
              showUserMessage(error.message || 'Failed to add item to cart. Please try again.', 'error');
            }
            
            if (btnText) {
              btnText.textContent = productData.productType == 90 ? 'Subscribe' : 'Add to Cart';
            }
            addToCartBtn.classList.remove('loading');
          }
        });
      }
      
      // Full Screen Gallery
      if (galleryZoomBtn && galleryModal) {
        const getCurrentGalleryImageUrls = () => {
          if (thumbnails && thumbnails.length > 0) {
            const thumbUrls = Array.from(thumbnails)
              .filter(thumb => thumb.style.display !== 'none')
              .map(thumb => thumb.dataset.image || thumb.querySelector('img')?.src || '')
              .filter(Boolean);
            if (thumbUrls.length > 0) return thumbUrls;
          }
          if (mainImages && mainImages.length > 0) {
            return Array.from(mainImages)
              .filter(img => img.style.display !== 'none')
              .map(img => img.getAttribute('src') || img.src || '')
              .filter(Boolean);
          }
          const images = productData.images || [];
          return images.map(img => typeof img === 'string' ? img : (img.url || img.Url || '')).filter(Boolean);
        };

        if (getCurrentGalleryImageUrls().length > 0) {
          galleryZoomBtn.style.display = 'flex';
          
          galleryZoomBtn.addEventListener('click', () => {
            const imageUrls = getCurrentGalleryImageUrls();
            if (imageUrls.length === 0) return;
            currentImageIndex = 0;
            galleryModalImage.src = imageUrls[currentImageIndex];
            updateGalleryModal(imageUrls);
            galleryModal.classList.add('active');
            document.body.style.overflow = 'hidden';
          });
          
          galleryModalPrev.addEventListener('click', () => {
            const imageUrls = getCurrentGalleryImageUrls();
            if (imageUrls.length === 0) return;
            if (currentImageIndex > 0) {
              currentImageIndex--;
            } else {
              currentImageIndex = imageUrls.length - 1;
            }
            galleryModalImage.src = imageUrls[currentImageIndex];
            updateGalleryModal(imageUrls);
          });
          
          galleryModalNext.addEventListener('click', () => {
            const imageUrls = getCurrentGalleryImageUrls();
            if (imageUrls.length === 0) return;
            if (currentImageIndex < imageUrls.length - 1) {
              currentImageIndex++;
            } else {
              currentImageIndex = 0;
            }
            galleryModalImage.src = imageUrls[currentImageIndex];
            updateGalleryModal(imageUrls);
          });
          
          function updateGalleryModal(imageUrls) {
            if (!imageUrls || imageUrls.length === 0) {
              galleryModalCounter.textContent = '0 / 0';
              return;
            }
            galleryModalCounter.textContent = `${currentImageIndex + 1} / ${imageUrls.length}`;
          }
        } else {
          if (galleryZoomBtn) galleryZoomBtn.style.display = 'none';
        }
        
        galleryModalClose.addEventListener('click', () => {
          galleryModal.classList.remove('active');
          document.body.style.overflow = '';
        });
        
        galleryModal.addEventListener('click', (e) => {
          if (e.target === galleryModal || e.target.classList.contains('gallery-modal-overlay')) {
            galleryModal.classList.remove('active');
            document.body.style.overflow = '';
          }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
          if (!galleryModal.classList.contains('active')) return;
          
          if (e.key === 'Escape') {
            galleryModal.classList.remove('active');
            document.body.style.overflow = '';
          } else if (e.key === 'ArrowLeft' && galleryModalPrev) {
            galleryModalPrev.click();
          } else if (e.key === 'ArrowRight' && galleryModalNext) {
            galleryModalNext.click();
          }
        });
      }
    });
  })();
