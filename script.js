// Supabase configuration
const SUPABASE_URL = "https://hslabyehsyzbomxbxvts.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzbGFieWVoc3l6Ym9teGJ4dnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2ODIyMjAsImV4cCI6MjA2MDI1ODIyMH0.wfq0pDWte6uwDVJHLczh-_k7GhDcECAwMTtCPpG8iWs";

// Menu items will be loaded from Supabase
let menuItems = [];
const selectedItems = new Map();
const statusMessage = document.getElementById('statusMessage');
let testMode = true;
let paymentConfirmed = false;
let currentTableNumber = getTableNumberFromURL();

// Get table number from URL parameters
function getTableNumberFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const table = urlParams.get('table');
  
  if (!table) {
    console.error('No table number in URL - using default table 0');
    return '0'; // Default table for testing
  }
  return table;
}

// Initialize elements safely
function initializeElements() {
  // Display table number
  displayTableNumber();

  // Set up test mode toggle
  const testModeToggle = document.getElementById('testModeToggle');
  if (testModeToggle) {
    testModeToggle.addEventListener('change', (e) => {
      testMode = e.target.checked;
      updateTestModeUI();
    });
  }

  // Set up view orders button
  const viewOrdersBtn = document.getElementById('viewOrdersBtn');
  if (viewOrdersBtn) {
    viewOrdersBtn.addEventListener('click', () => {
      fetchOrders(currentTableNumber);
    });
  }

  // Set up back to order button
  const backToOrderBtn = document.getElementById('backToOrderBtn');
  if (backToOrderBtn) {
    backToOrderBtn.addEventListener('click', () => {
      document.getElementById('orderSection').style.display = 'block';
      document.getElementById('ordersList').style.display = 'none';
    });
  }

  // Set up submit button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleOrderSubmission);
  }

  // Set up confirm payment button
  const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
  if (confirmPaymentBtn) {
    confirmPaymentBtn.onclick = () => {
      simulatePayment(() => {
        paymentConfirmed = true;
        submitOrderToSupabase();
        document.getElementById('paymentContainer').style.display = 'none';
      });
    };
  }
}

// Display table number at top of page
function displayTableNumber() {
  const tableDisplay = document.createElement('div');
  tableDisplay.className = 'table-number-display';
  tableDisplay.innerHTML = `Table: <strong>${currentTableNumber}</strong>`;
  document.body.insertBefore(tableDisplay, document.querySelector('h2'));
}

// Fetch menu items from Supabase
async function fetchMenuItems() {
  try {
    showStatus('Loading menu items...');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch menu items');
    }

    const data = await response.json();
    menuItems = data.map(item => ({
      id: item.id || item.name,
      name: item.name,
      emoji: item.emoji || '🍽️',
      price: item.price,
      category: item.category || 'Other'
    }));

    renderMenuButtons();
    showStatus('', '');
  } catch (error) {
    console.error('Error fetching menu items:', error);
    showStatus(`Error loading menu: ${error.message}`, 'error');
    document.getElementById('menuGrid').innerHTML =
      '<div class="error">Failed to load menu items. Please try again later.</div>';
  }
}

// Render menu buttons dynamically
function renderMenuButtons() {
  const menuGrid = document.getElementById('menuGrid');
  if (!menuGrid) return;

  menuGrid.innerHTML = '';

  menuItems.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.dataset.id = item.id;
    btn.dataset.price = item.price;
    btn.innerHTML = `
      ${item.emoji} ${item.name}
      <span class="menu-price">$${item.price.toFixed(2)}</span>
    `;

    btn.addEventListener('click', () => toggleMenuItem(item.id));

    menuGrid.appendChild(btn);
  });

  updateMenuSelectionStyles();
}

// Toggle menu item selection
function toggleMenuItem(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  if (selectedItems.has(itemId)) {
    selectedItems.delete(itemId);
  } else {
    selectedItems.set(itemId, {
      price: item.price,
      quantity: 1,
      name: item.name,
      emoji: item.emoji
    });
  }

  updateOrderSummary();
  updateMenuSelectionStyles();
}

// Update menu button selected styles
function updateMenuSelectionStyles() {
  document.querySelectorAll('.menu-btn').forEach(btn => {
    const id = btn.dataset.id;
    btn.classList.toggle('selected', selectedItems.has(id));
  });
}

// Update order summary
function updateOrderSummary() {
  const orderItemsContainer = document.getElementById('orderItems');
  if (!orderItemsContainer) return;

  let total = 0;
  let itemsHTML = '';

  selectedItems.forEach((itemData, id) => {
    const itemTotal = itemData.price * itemData.quantity;
    itemsHTML += `
      <div class="order-item">
        <span>${itemData.emoji} ${itemData.name}</span>
        <div class="quantity-controls">
          <button onclick="adjustQuantity('${id}', -1)">−</button>
          <span class="quantity-display">${itemData.quantity}</span>
          <button onclick="adjustQuantity('${id}', 1)">+</button>
          <span>$${itemTotal.toFixed(2)}</span>
        </div>
      </div>
    `;
    total += itemTotal;
  });

  orderItemsContainer.innerHTML = itemsHTML || '<div>No items selected</div>';

  const orderTotalElement = document.getElementById('orderTotal');
  if (orderTotalElement) {
    orderTotalElement.textContent = `$${total.toFixed(2)}`;
  }
}

// Adjust quantity of selected item
function adjustQuantity(itemId, change) {
  const id = Number(itemId);

  if (!selectedItems.has(id)) {
    console.error(`Item ${id} not found! Existing keys:`, Array.from(selectedItems.keys()));
    return;
  }

  const item = selectedItems.get(id);
  const newQuantity = item.quantity + change;

  if (newQuantity <= 0) {
    selectedItems.delete(id);
  } else {
    selectedItems.set(id, { ...item, quantity: newQuantity });
  }

  updateOrderSummary();
  updateMenuSelectionStyles();
}

// Show payment confirmation (test mode)
function showPaymentConfirmation(totalAmount) {
  const paymentContainer = document.getElementById('paymentContainer');
  const paymentAmountElement = document.getElementById('paymentAmount');

  if (paymentContainer && paymentAmountElement) {
    paymentAmountElement.textContent = totalAmount.toFixed(2);
    paymentContainer.style.display = 'block';
    paymentContainer.scrollIntoView({ behavior: 'smooth' });
  }

  paymentConfirmed = false;
}

// Simulate payment processing
function simulatePayment(callback) {
  const progressBar = document.getElementById('paymentProgress');
  if (progressBar) {
    progressBar.style.width = '0%';
  }
  showStatus('Simulating payment processing...');

  setTimeout(() => {
    if (progressBar) progressBar.style.width = '25%';
  }, 100);
  setTimeout(() => {
    if (progressBar) progressBar.style.width = '50%';
  }, 300);
  setTimeout(() => {
    if (progressBar) progressBar.style.width = '75%';
  }, 600);
  setTimeout(() => {
    if (progressBar) progressBar.style.width = '100%';
    setTimeout(() => {
      callback();
      if (progressBar) progressBar.style.width = '0%';
    }, 200);
  }, 900);
}

// Submit order to Supabase
async function submitOrderToSupabase() {
  // Generate a NEW session ID if this is the first order for this table
  let sessionId = localStorage.getItem(`table_${currentTableNumber}_session`);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(`table_${currentTableNumber}_session`, sessionId);
  }

  let total = 0;
  const items = [];
  const prices = [];

  selectedItems.forEach((itemData, id) => {
    const itemTotal = itemData.price;
    items.push(`${itemData.quantity}x ${itemData.name}`);
    prices.push(itemTotal.toFixed(2));
    total += itemTotal * itemData.quantity;
  });

  try {
    showStatus('Submitting order...');

    const order = {
      table: currentTableNumber,
      session_id: sessionId,
      items: items.join(", "),
      prices: prices.join(", "),
      total: total.toFixed(2),
      status: testMode ? "test_payment" : "paid",
      created_at: new Date().toISOString()
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(order)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to submit order');
    }

    const data = await response.json();
    console.log('Order submitted:', data);

    resetOrderForm();

    showStatus('Order submitted successfully!', 'success');
  } catch (error) {
    console.error('Error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
}

// Generate a more unique session ID
function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

async function fetchOrders(tableNumber) {
  try {
    showStatus('Loading your orders...');

    // Get or create session ID
    let sessionId = localStorage.getItem(`table_${tableNumber}_session`);
    if (!sessionId) {
      // No existing session - show empty state
      displayOrders([], tableNumber);
      document.getElementById('orderSection').style.display = 'none';
      document.getElementById('ordersList').style.display = 'block';
      return;
    }

    const tableDisplay = document.getElementById('currentTableDisplay');
    if (tableDisplay) tableDisplay.textContent = tableNumber;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?table=eq.${tableNumber}&session_id=eq.${sessionId}&select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }

    const orders = await response.json();
    displayOrders(orders, tableNumber);

    document.getElementById('orderSection').style.display = 'none';
    document.getElementById('ordersList').style.display = 'block';

    showStatus('', '');
  } catch (error) {
    console.error('Error:', error);
    showStatus(`Error: ${error.message}`, 'error');
    const ordersContainer = document.getElementById('ordersContainer');
    if (ordersContainer) {
      ordersContainer.innerHTML = '<div class="no-orders">Error loading orders</div>';
      ordersContainer.classList.add('no-orders');
    }
  }
}

// Display orders in the UI
function displayOrders(orders, tableNumber) {
  const ordersContainer = document.getElementById('ordersContainer');
  if (!ordersContainer) return;

  // Clear and prepare container
  ordersContainer.innerHTML = '';
  ordersContainer.classList.remove('no-orders');

  if (!orders || orders.length === 0) {
    ordersContainer.innerHTML = '<div class="no-orders">No orders found for Table ' + tableNumber + '</div>';
    ordersContainer.classList.add('no-orders');
    return;
  }

  let ordersHTML = '';

  orders.forEach(order => {
    const orderDate = new Date(order.created_at);
    const statusClass = order.status === 'paid' ? 'status-paid' :
      order.status === 'test_payment' ? 'status-test' : 'status-pending';

    ordersHTML += `
      <div class="order-card">
        <div class="order-header">
          <span class="order-time">${orderDate.toLocaleString()}</span>
          <span class="order-status ${statusClass}">${order.status.replace('_', ' ')}</span>
        </div>
        <div style="margin: 10px 0;">
          <strong>Items:</strong>
          <div>${order.items.split(', ').map(item => `• ${item}`).join('<br>')}</div>
        </div>
        <div class="order-total">
          <span>Total:</span>
          <span>$${order.total}</span>
        </div>
      </div>
    `;
  });

  ordersContainer.innerHTML = ordersHTML;
}

// Handle order submission
function handleOrderSubmission() {
  if (selectedItems.size === 0) {
    showStatus('Please select at least one menu item', 'error');
    return;
  }

  let total = 0;
  selectedItems.forEach(itemData => total += itemData.price * itemData.quantity);

  if (testMode && !paymentConfirmed) {
    showPaymentConfirmation(total);
    showStatus('Click "Confirm Payment" to complete test order', 'success');
    return;
  }

  submitOrderToSupabase();
}

// Reset order form
function resetOrderForm() {
  selectedItems.clear();
  updateOrderSummary();
  updateMenuSelectionStyles();
  paymentConfirmed = false;
}

// Show status messages
function showStatus(message, type = '') {
  if (!statusMessage) return;

  statusMessage.textContent = message;
  statusMessage.className = type;
  statusMessage.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      if (statusMessage) statusMessage.style.display = 'none';
    }, 5000);
  }
}

// Update UI based on test mode
function updateTestModeUI() {
  const indicator = document.getElementById('testModeIndicator');
  const submitBtn = document.getElementById('submitBtn');

  if (testMode) {
    if (indicator) indicator.textContent = "TEST MODE";
    if (submitBtn) {
      submitBtn.style.background = "#f39c12";
      submitBtn.textContent = "Test Payment";
    }
  } else {
    if (indicator) indicator.textContent = "LIVE MODE";
    if (submitBtn) {
      submitBtn.style.background = "#e74c3c";
      submitBtn.textContent = "Proceed to Payment";
    }
  }
}

// Initialize the application
function init() {
  initializeElements();
  fetchMenuItems();
  updateTestModeUI();
  updateOrderSummary();

  // Make adjustQuantity available globally for inline event handlers
  window.adjustQuantity = adjustQuantity;
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);