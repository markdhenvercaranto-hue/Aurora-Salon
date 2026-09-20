window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Ensure bookings are saved before page unload
window.addEventListener('beforeunload', () => {
    if (typeof bookingLogger !== 'undefined') {
        const bookings = bookingLogger.getBookings();
        if (bookings.length > 0) {
            console.log('💾 Saving bookings before page unload: ' + bookings.length + ' bookings');
            bookingLogger.saveBookings(bookings);
        }
    }
});

const modal = document.getElementById('bookingModal');

const bookButtons = document.querySelectorAll('a[href="#book"], .cta-btn:not([type="submit"])');
bookButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
    });
});

function closeBooking() {
    modal.style.display = 'none';
}

function showConfirmation(bookingData, bookingId, serviceText) {
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationDetails = document.getElementById('confirmationDetails');
    
    // Format the details with customer name at top
    const detailsHTML = `
        <div class="confirmation-detail-item">
            <span class="confirmation-detail-label">Name</span>
            <span class="confirmation-detail-value">${bookingData.name}</span>
        </div>
        <div class="confirmation-detail-item">
            <span class="confirmation-detail-label">Service</span>
            <span class="confirmation-detail-value">${serviceText}</span>
        </div>
        <div class="confirmation-detail-item">
            <span class="confirmation-detail-label">Date</span>
            <span class="confirmation-detail-value">${new Date(bookingData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div class="confirmation-detail-item">
            <span class="confirmation-detail-label">Time</span>
            <span class="confirmation-detail-value">${bookingData.time}</span>
        </div>
        <div class="confirmation-detail-item">
            <span class="confirmation-detail-label">Booking ID</span>
            <span class="confirmation-detail-value id">${bookingId}</span>
        </div>
    `;
    
    confirmationDetails.innerHTML = detailsHTML;
    confirmationModal.classList.add('show');
}

function closeConfirmation() {
    const confirmationModal = document.getElementById('confirmationModal');
    confirmationModal.classList.remove('show');
    
    // Ensure both modals are hidden after animation
    setTimeout(() => {
        confirmationModal.style.display = 'none';
        modal.style.display = 'none';  // Also close the booking modal
        
        // Force dashboard refresh after modals close
        console.log('🔄 Force refreshing dashboard...');
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
    }, 300);
}

window.onclick = function(event) {
    if (event.target === modal) {
        closeBooking();
    }
}

function handleBooking(event) {
    event.preventDefault();
    
    const customerNameInput = document.getElementById('customerName');
    const serviceSelect = document.getElementById('service');
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    const customerName = customerNameInput.value.trim();
    const chosenService = serviceSelect.value;
    const chosenServiceText = serviceSelect.options[serviceSelect.selectedIndex].text;
    const chosenDate = dateInput.value;
    const chosenTime = timeInput.value;

    // Validate all fields are filled
    if (!customerName || !chosenService || !chosenDate || !chosenTime) {
        alert('❌ Please fill in all fields');
        return;
    }

    // Validate name is not too short
    if (customerName.length < 2) {
        alert('❌ Please enter a valid name');
        return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(chosenDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        alert('❌ Please select a future date');
        return;
    }

    try {
        // Log the booking using BookingLogger
        const bookingData = {
            name: customerName,
            service: chosenService,
            date: chosenDate,
            time: chosenTime
        };
        
        const loggedBooking = bookingLogger.logBooking(bookingData);
        
        // Verify booking was saved
        const savedBookings = bookingLogger.getBookings();
        console.log('✅ Verification: ' + savedBookings.length + ' total bookings in storage');
        
        // Show custom confirmation modal
        showConfirmation(bookingData, loggedBooking.id, chosenServiceText);

        // Reset booking form
        document.getElementById('salonBookingForm').reset();
        closeBooking();
        
        // Refresh dashboard
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        
        console.log('✅ Booking successfully logged:', loggedBooking);
    } catch (error) {
        console.error('❌ Error logging booking:', error);
        alert('❌ Error confirming booking. Please try again.');
    }
}
