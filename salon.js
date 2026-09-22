window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

const bookingModal = document.getElementById('bookingModal');
const bookingForm = document.getElementById('bookingForm');
const bookingModalTitle = document.getElementById('bookingModalTitle');
const closeBookingButton = document.querySelector('.close-btn');
const authForm = document.getElementById('authForm');
const authUserDisplay = document.getElementById('authUserDisplay');
const adminLoginToggle = document.getElementById('adminLoginToggle');
const clientLoginToggle = document.getElementById('clientLoginToggle');
const headerLogoutBtn = document.getElementById('headerLogoutBtn');
const adminLoginModal = document.getElementById('adminLoginModal');
let editingBookingId = null;

function showCustomAlert(message) {
    let overlay = document.getElementById('customAlertOverlay');

    if (overlay && overlay.querySelector('.custom-alert-close')) {
        overlay.remove();
        overlay = null;
    }

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'customAlertOverlay';
        overlay.innerHTML = `
            <div class="custom-alert" role="alertdialog" aria-modal="true">
                <div class="custom-alert-header">
                    <span>Notice</span>
                </div>
                <div class="custom-alert-body">
                    <p></p>
                </div>
                <div class="custom-alert-actions">
                    <button type="button" class="custom-alert-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.custom-alert-ok').addEventListener('click', () => {
            overlay.classList.remove('is-visible');
        });
    }

    const messageText = overlay.querySelector('.custom-alert-body p');
    if (messageText) {
        messageText.textContent = message;
    }

    overlay.classList.add('is-visible');
    const okButton = overlay.querySelector('.custom-alert-ok');
    if (okButton) {
        okButton.focus();
    }
}

function showCustomConfirm(message, onConfirm, onCancel) {
    let overlay = document.getElementById('customConfirmOverlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'customConfirmOverlay';
        overlay.className = 'custom-confirm-overlay';
        overlay.innerHTML = `
            <div class="custom-confirm" role="dialog" aria-modal="true" aria-labelledby="customConfirmTitle">
                <div class="custom-confirm-header">
                    <span id="customConfirmTitle">Confirmation</span>
                </div>
                <div class="custom-confirm-body">
                    <p></p>
                </div>
                <div class="custom-confirm-actions">
                    <button type="button" class="custom-confirm-secondary">Cancel</button>
                    <button type="button" class="custom-confirm-primary">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const messageText = overlay.querySelector('.custom-confirm-body p');
    if (messageText) {
        messageText.textContent = message;
    }

    const cancelButton = overlay.querySelector('.custom-confirm-secondary');
    const confirmButton = overlay.querySelector('.custom-confirm-primary');

    if (cancelButton) {
        cancelButton.onclick = () => {
            overlay.classList.remove('is-visible');
            if (typeof onCancel === 'function') onCancel();
        };
    }

    if (confirmButton) {
        confirmButton.onclick = () => {
            overlay.classList.remove('is-visible');
            if (typeof onConfirm === 'function') onConfirm();
        };
    }

    overlay.classList.add('is-visible');
    if (confirmButton) {
        confirmButton.focus();
    }
}

window.alert = function (message) {
    showCustomAlert(message ?? '');
};

function isAdminLoginRoute() {
    const hash = window.location.hash.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    return hash === '#/admin/login' || hash === '#admin-login' || hash === '#admin' || params.get('admin') === 'login' || params.get('view') === 'admin';
}

function isClientLoginRoute() {
    const hash = window.location.hash.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    return hash === '#/client/login' || hash === '#client-login' || hash === '#client' || params.get('client') === 'login' || params.get('view') === 'client';
}

function getCurrentRouteRole() {
    if (isAdminLoginRoute()) return 'admin';
    if (isClientLoginRoute()) return 'client';
    return null;
}

function openLoginModal(role = 'admin') {
    if (!adminLoginModal) return;

    const roleValue = role === 'client' ? 'client' : 'admin';
    const authRole = document.getElementById('authRole');
    const card = document.getElementById('adminLoginCard');
    if (authRole) {
        authRole.value = roleValue;
    }
    if (card) {
        card.setAttribute('data-role', roleValue);
    }

    const title = document.querySelector('#adminLoginModal h2');
    if (title) {
        title.textContent = roleValue === 'admin' ? 'Admin Login' : 'Client Login';
    }

    adminLoginModal.classList.add('is-visible');
    adminLoginModal.setAttribute('aria-hidden', 'false');

    if (roleValue === 'admin' && !isAdminLoginRoute()) {
        window.location.hash = '#/admin/login';
    }
    if (roleValue === 'client' && !isClientLoginRoute()) {
        window.location.hash = '#/client/login';
    }

    const emailInput = document.getElementById('authEmail');
    if (emailInput) emailInput.focus();
}

function closeAdminLoginModal() {
    if (!adminLoginModal) return;
    adminLoginModal.classList.remove('is-visible');
    adminLoginModal.setAttribute('aria-hidden', 'true');
}

function syncAuthUi() {
    const sessionUser = bookingLogger.getCurrentUser();
    const authRole = document.getElementById('authRole');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const currentRouteRole = getCurrentRouteRole();

    const loginButtonsVisible = !sessionUser;
    if (adminLoginToggle) {
        adminLoginToggle.style.display = loginButtonsVisible ? 'inline-flex' : 'none';
    }
    if (clientLoginToggle) {
        clientLoginToggle.style.display = loginButtonsVisible ? 'inline-flex' : 'none';
    }
    if (headerLogoutBtn) {
        headerLogoutBtn.style.display = sessionUser ? 'inline-flex' : 'none';
    }

    document.querySelectorAll('.book-now-btn').forEach((button) => {
        const isAdmin = sessionUser && sessionUser.role === bookingLogger.ROLES.ADMIN;
        button.style.display = isAdmin ? 'none' : 'inline-flex';
    });

    if (authRole && currentRouteRole) {
        authRole.value = currentRouteRole;
    }

    if (!currentRouteRole && !(sessionUser && sessionUser.role)) {
        closeAdminLoginModal();
    } else if (currentRouteRole) {
        openLoginModal(currentRouteRole);
    }

    if (!authUserDisplay) return;

    if (!sessionUser) {
        authUserDisplay.textContent = 'Not signed in';
        if (authRole) authRole.value = 'client';
        if (authEmail) authEmail.value = '';
        if (authPassword) authPassword.value = '';
        return;
    }

    authUserDisplay.textContent = `${sessionUser.name} (${sessionUser.role})`;

    if (authEmail) authEmail.value = sessionUser.email || '';
    if (authPassword) authPassword.value = '';
}

function openBookingModal(booking = null) {
    if (!bookingModal || !bookingForm) return;

    const currentUser = bookingLogger.getCurrentUser();
    if (!currentUser) {
        alert('Please sign in before booking an appointment.');
        return;
    }

    if (currentUser.role === bookingLogger.ROLES.ADMIN) {
        alert('Admins cannot book appointments. Please sign in as a client to create a booking.');
        return;
    }

    if (booking) {
        editingBookingId = booking.id;
        bookingModalTitle.textContent = 'Edit Appointment';
        document.getElementById('bookingClientName').value = booking.clientName || booking.name || '';
        document.getElementById('bookingService').value = booking.service || 'Consultation';
        document.getElementById('bookingDate').value = booking.date || '';
        document.getElementById('bookingTime').value = booking.time || '';
        document.getElementById('bookingPhone').value = booking.phone || '';
        document.getElementById('bookingEmail').value = booking.email || '';
        bookingForm.querySelector('.form-submit').textContent = 'Save Changes';
    } else {
        editingBookingId = null;
        bookingModalTitle.textContent = 'Book Your Appointment';
        bookingForm.reset();
        bookingForm.querySelector('.form-submit').textContent = 'Confirm Booking';

        if (currentUser.role === bookingLogger.ROLES.CLIENT) {
            document.getElementById('bookingClientName').value = currentUser.name || '';
            document.getElementById('bookingEmail').value = currentUser.email || '';
        }
    }

    bookingModal.style.display = 'flex';
}

function closeBookingModal() {
    if (!bookingModal || !bookingForm) return;

    bookingModal.style.display = 'none';
    bookingForm.reset();
    editingBookingId = null;
    bookingForm.querySelector('.form-submit').textContent = 'Confirm Booking';
    bookingModalTitle.textContent = 'Book Your Appointment';
}

function handleAuthSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const roleSelect = document.getElementById('authRole');

    if (!emailInput || !passwordInput || !roleSelect) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const role = getCurrentRouteRole() || roleSelect.value;
    const user = bookingLogger.loginUser({ email, password });

    if (!user) {
        alert('Authentication failed. Use the demo credentials shown below.');
        return;
    }

    const roleMatches = user.role === role;

    if (!roleMatches) {
        bookingLogger.logoutUser();
        alert('Role mismatch. Please choose the correct role for the provided account.');
        syncAuthUi();
        return;
    }

    syncAuthUi();
    closeAdminLoginModal();
    window.location.hash = '';
    if (typeof renderDashboard === 'function') renderDashboard();
}

function handleLogout() {
    bookingLogger.logoutUser();
    syncAuthUi();
    closeAdminLoginModal();
    window.location.hash = '';
    if (typeof renderDashboard === 'function') renderDashboard();
}

function handleBookingSubmit(event) {
    event.preventDefault();

    const currentUser = bookingLogger.getCurrentUser();
    if (!currentUser) {
        alert('Authentication required. Please sign in first.');
        return;
    }

    const clientName = document.getElementById('bookingClientName').value.trim();
    const service = document.getElementById('bookingService').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const phone = document.getElementById('bookingPhone').value.trim();
    const email = document.getElementById('bookingEmail').value.trim();

    if (!clientName || !date || !time) {
        alert('Please complete your name, date, and time.');
        return;
    }

    const selectedDateTime = new Date(`${date}T${time}`);
    const now = new Date();

    if (selectedDateTime < now) {
        alert('Please choose a future appointment time.');
        return;
    }

    const payload = {
        clientName,
        service,
        date,
        time,
        phone,
        email: email || currentUser.email || ''
    };

    if (editingBookingId) {
        const existingBooking = bookingLogger.getBookings().find((entry) => String(entry.id) === String(editingBookingId));
        if (!bookingLogger.hasPermission('edit_booking', existingBooking)) {
            alert('You are not authorized to edit this appointment.');
            return;
        }
        bookingLogger.updateBooking(editingBookingId, payload);
    } else {
        if (!bookingLogger.hasPermission('create_booking')) {
            alert('You are not authorized to create bookings.');
            return;
        }
        bookingLogger.addBooking(payload);
    }

    bookingLogger.setCurrentClientName(clientName);
    closeBookingModal();

    if (typeof renderDashboard === 'function') {
        renderDashboard();
    }
}

document.querySelectorAll('.book-now-btn').forEach((button) => {
    button.addEventListener('click', () => openBookingModal());
});

if (closeBookingButton) {
    closeBookingButton.addEventListener('click', closeBookingModal);
}

if (adminLoginToggle) {
    adminLoginToggle.addEventListener('click', () => {
        openLoginModal('admin');
    });
}

if (clientLoginToggle) {
    clientLoginToggle.addEventListener('click', () => {
        openLoginModal('client');
    });
}

if (headerLogoutBtn) {
    headerLogoutBtn.addEventListener('click', handleLogout);
}

if (adminLoginModal) {
    adminLoginModal.addEventListener('click', (event) => {
        if (event.target === adminLoginModal) {
            closeAdminLoginModal();
        }
    });
}

if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
}


if (bookingModal) {
    bookingModal.addEventListener('click', (event) => {
        if (event.target === bookingModal) {
            closeBookingModal();
        }
    });
}

if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookingSubmit);
}

window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.syncAuthUi = syncAuthUi;
window.handleLogout = handleLogout;

document.addEventListener('DOMContentLoaded', () => {
    syncAuthUi();
    const currentRouteRole = getCurrentRouteRole();
    if (currentRouteRole) {
        openLoginModal(currentRouteRole);
    }
    if (typeof renderDashboard === 'function') {
        renderDashboard();
    }
});

window.addEventListener('hashchange', () => {
    const routeRole = getCurrentRouteRole();
    syncAuthUi();
    if (routeRole) {
        openLoginModal(routeRole);
    } else {
        closeAdminLoginModal();
    }
});
