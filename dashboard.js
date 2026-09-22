function renderDashboard() {
    const list = document.getElementById('bookingsList');
    const emptyState = document.getElementById('emptyBookingsMessage');
    const upcomingCount = document.getElementById('upcomingBookingsCount');
    const pastCount = document.getElementById('pastBookingsCount');

    if (!list || !emptyState || !upcomingCount || !pastCount) return;

    const sessionUser = bookingLogger.getCurrentUser();
    if (!sessionUser) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.textContent = 'Please sign in to view your bookings.';
        upcomingCount.textContent = '0';
        pastCount.textContent = '0';
        return;
    }

    const currentClient = sessionUser.name || bookingLogger.getCurrentClientName();
    const visibleBookings = bookingLogger.getVisibleBookingsForCurrentUser();
    const filteredBookings = (() => {
        if (sessionUser.role === bookingLogger.ROLES.ADMIN) {
            return visibleBookings;
        }

        if (sessionUser.role === bookingLogger.ROLES.CLIENT) {
            if (!currentClient) return visibleBookings;
            return visibleBookings.filter((booking) => (booking.clientName || '').toLowerCase() === currentClient.toLowerCase() || (booking.email || '').toLowerCase() === (sessionUser.email || '').toLowerCase());
        }

        return visibleBookings;
    })();

    const now = new Date();
    const upcoming = [];
    const past = [];

    filteredBookings.forEach((booking) => {
        const bookingDate = new Date(`${booking.date}T${booking.time || '00:00'}`);
        if (bookingDate >= now) {
            upcoming.push(booking);
        } else {
            past.push(booking);
        }
    });

    upcomingCount.textContent = String(upcoming.length);
    pastCount.textContent = String(past.length);

    if (!filteredBookings.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.textContent = sessionUser.role === bookingLogger.ROLES.ADMIN
            ? 'No bookings found for this search.'
            : 'No appointments found for this client yet.';
        return;
    }

    emptyState.style.display = 'none';
    const sortedBookings = [...filteredBookings].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

    list.innerHTML = sortedBookings.map((booking) => {
        const bookingDate = new Date(`${booking.date}T${booking.time || '00:00'}`);
        const isUpcoming = bookingDate >= now;
        const statusLabel = isUpcoming ? 'Upcoming' : 'Past';
        const clientDisplayName = booking.clientName || booking.name || 'Client';
        const sessionUser = bookingLogger.getCurrentUser();
        const canEdit = sessionUser && bookingLogger.hasPermission('edit_booking', booking);
        const canDelete = sessionUser && bookingLogger.hasPermission('delete_booking', booking);

        return `
            <article class="booking-card ${isUpcoming ? 'upcoming' : 'past'}">
                <div class="booking-top-row">
                    <div>
                        <p class="booking-id">${booking.id}</p>
                        <h3>${clientDisplayName}</h3>
                    </div>
                    <span class="booking-status ${isUpcoming ? 'upcoming' : 'past'}">${statusLabel}</span>
                </div>
                <div class="booking-details">
                    <span>${booking.service}</span>
                    <span>${bookingLogger.formatDate(booking.date)}</span>
                    <span>${booking.time || 'Flexible time'}</span>
                    ${booking.phone ? `<span>${booking.phone}</span>` : ''}
                    ${booking.email ? `<span>${booking.email}</span>` : ''}
                </div>
                <div class="booking-actions">
                    ${canEdit ? '<button type="button" class="mini-btn edit-booking" data-id="' + booking.id + '">Edit</button>' : ''}
                    ${canDelete ? '<button type="button" class="mini-btn cancel-booking" data-id="' + booking.id + '">Cancel</button>' : ''}
                </div>
            </article>
        `;
    }).join('');

    document.querySelectorAll('.edit-booking').forEach((button) => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            const booking = filteredBookings.find((item) => String(item.id) === String(id));
            if (booking && bookingLogger.hasPermission('edit_booking', booking)) {
                window.openBookingModal(booking);
            } else {
                alert('You are not authorized to edit this appointment.');
            }
        });
    });

    document.querySelectorAll('.cancel-booking').forEach((button) => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            const booking = filteredBookings.find((item) => String(item.id) === String(id));
            if (!booking || !bookingLogger.hasPermission('delete_booking', booking)) {
                alert('You are not authorized to cancel this appointment.');
                return;
            }

            showCustomConfirm('Cancel this appointment?', () => {
                bookingLogger.deleteBooking(id);
                renderDashboard();
            });
        });
    });
}

function initializeDashboard() {
    renderDashboard();
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
