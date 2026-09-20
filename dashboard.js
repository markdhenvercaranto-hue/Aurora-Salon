// Dashboard functionality for displaying and managing bookings

let currentFilter = 'all';

// Service display names
const serviceNames = {
    'cut': 'Design & Cut',
    'color': 'Aesthetic Color',
    'therapy': 'Revitalizing Therapy'
};

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Dashboard initializing...');
    
    // Check if localStorage is available
    const storageOK = bookingLogger.isLocalStorageAvailable();
    if (!storageOK) {
        console.error('❌ WARNING: localStorage is not available. Bookings will not persist.');
        alert('⚠️ Warning: Browser storage is not available. Bookings may not persist between sessions.');
    } else {
        console.log('✅ Browser storage is available and working');
    }
    
    // Load and display bookings
    const allBookings = bookingLogger.getAllBookings();
    console.log('🎯 Dashboard loaded. Found ' + allBookings.length + ' bookings');
    console.log('Bookings data:', allBookings);
    
    updateDashboard();
    setupFilterButtons();
    
    // Auto-save every 5 seconds as backup
    setInterval(() => {
        const currentBookings = bookingLogger.getBookings();
        if (currentBookings.length > 0) {
            bookingLogger.saveBookings(currentBookings);
        }
    }, 5000);
});

// Setup filter button click handlers
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Update filter
            currentFilter = btn.dataset.filter;
            renderBookings();
        });
    });
}

// Update entire dashboard
function updateDashboard() {
    updateStats();
    renderBookings();
}

// Update statistics cards
function updateStats() {
    const bookings = bookingLogger.getAllBookings();
    const stats = bookingLogger.getStatistics();
    
    // Total bookings
    document.getElementById('totalBookingsCount').textContent = stats.totalBookings;
    
    // Upcoming bookings
    document.getElementById('upcomingBookingsCount').textContent = stats.upcomingBookings.length;
    
    // Most popular service
    const byService = stats.byService;
    let popularService = '—';
    let maxCount = 0;
    
    for (const [service, count] of Object.entries(byService)) {
        if (count > maxCount) {
            maxCount = count;
            popularService = serviceNames[service] || service;
        }
    }
    document.getElementById('popularService').textContent = popularService;
}

// Render bookings list based on current filter
function renderBookings() {
    const bookings = bookingLogger.getAllBookings();
    const bookingsList = document.getElementById('bookingsList');
    const noBookingsMessage = document.getElementById('noBookingsMessage');
    
    // Filter bookings
    let filteredBookings = bookings;
    
    if (currentFilter === 'upcoming') {
        filteredBookings = bookingLogger.getUpcomingBookings(bookings);
    } else if (currentFilter === 'past') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filteredBookings = bookings.filter(booking => new Date(booking.date) < today);
    }
    
    // Clear current list
    bookingsList.innerHTML = '';
    
    // Show/hide no bookings message
    if (filteredBookings.length === 0) {
        bookingsList.style.display = 'none';
        noBookingsMessage.style.display = currentFilter === 'all' && bookings.length === 0 ? 'block' : 'none';
        return;
    }
    
    bookingsList.style.display = 'flex';
    noBookingsMessage.style.display = 'none';
    
    // Sort bookings by date
    const sortedBookings = filteredBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Create booking cards
    sortedBookings.forEach(booking => {
        const bookingCard = createBookingCard(booking);
        bookingsList.appendChild(bookingCard);
    });
}

// Create a single booking card element
function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'booking-card';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.date);
    const isPast = bookingDate < today;
    
    if (isPast) {
        card.classList.add('past');
    }
    
    const serviceDisplayName = serviceNames[booking.service] || booking.service;
    const formattedDate = new Date(booking.date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const statusClass = isPast ? 'past' : '';
    
    card.innerHTML = `
        <div class="booking-details">
            <div class="booking-id">${booking.id}</div>
            <div class="booking-customer-name">${booking.name || 'Guest'}</div>
            <div class="booking-service">${serviceDisplayName}</div>
            <div class="booking-info">
                <span>📅 ${formattedDate}</span>
                <span>🕐 ${booking.time}</span>
            </div>
        </div>
        <div class="booking-actions">
            <span class="booking-status ${statusClass}">${isPast ? 'Completed' : 'Confirmed'}</span>
            <button class="btn-delete" onclick="deleteBookingHandler('${booking.id}')">Delete</button>
        </div>
    `;
    
    return card;
}

// Handle booking deletion
function deleteBookingHandler(bookingId) {
    if (confirm('Are you sure you want to delete this booking?')) {
        bookingLogger.deleteBooking(bookingId);
        updateDashboard();
    }
}

// Listen for bookings changes (when a new booking is added)
// This will automatically update the dashboard
const observer = setInterval(() => {
    const currentBookings = bookingLogger.getAllBookings();
    // The dashboard will refresh when renderBookings is called after new bookings
}, 500);
