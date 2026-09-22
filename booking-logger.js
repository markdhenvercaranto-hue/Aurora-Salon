(function () {
    const STORAGE_KEY = 'aura_salon_bookings';
    const CLIENT_KEY = 'aura_salon_client_name';
    const SESSION_KEY = 'aura_salon_session';
    const ACTIVE_SESSION_KEY = 'aura_salon_active_session_user';
    const USERS_KEY = 'aura_salon_users';
    const ROLES = { CLIENT: 'client', ADMIN: 'admin' };

    function getUserScopedKey(prefix, userId) {
        const normalizedId = String(userId || '').trim();
        if (!normalizedId) {
            return prefix;
        }
        return `${prefix}_${normalizedId}`;
    }

    function getCurrentSessionUserId() {
        const activeUserId = localStorage.getItem(ACTIVE_SESSION_KEY);
        if (activeUserId) {
            return String(activeUserId).trim();
        }

        try {
            const fallbackUser = localStorage.getItem(SESSION_KEY);
            if (!fallbackUser) {
                return '';
            }

            const parsedUser = JSON.parse(fallbackUser);
            return String(parsedUser?.id || parsedUser?.email || '').trim();
        } catch (error) {
            return '';
        }
    }

    function ensureSeedUsers() {
        const savedUsers = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        const users = Array.isArray(savedUsers) ? savedUsers : [];

        const seeded = [
            { id: 'admin-1', name: 'Aurora Admin', email: 'admin@aurora.com', password: 'admin123', role: ROLES.ADMIN },
            { id: 'client-1', name: 'Alice Parker', email: 'alice@aurora.com', password: 'client123', role: ROLES.CLIENT }
        ];

        seeded.forEach((seedUser) => {
            const existing = users.find((user) => user.email.toLowerCase() === seedUser.email.toLowerCase());
            if (!existing) {
                users.push(seedUser);
            }
        });

        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return users;
    }

    function getUsers() {
        return ensureSeedUsers();
    }

    function normalizeBooking(booking) {
        return {
            id: booking.id || createBookingId(),
            clientName: (booking.clientName || booking.name || '').trim(),
            service: booking.service || 'Consultation',
            date: booking.date || '',
            time: booking.time || '',
            phone: booking.phone || '',
            email: booking.email || '',
            createdAt: booking.createdAt || new Date().toISOString(),
            status: booking.status || 'upcoming'
        };
    }

    function getBookings() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const parsed = stored ? JSON.parse(stored) : [];
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.map(normalizeBooking);
        } catch (error) {
            console.error('Unable to read bookings:', error);
            return [];
        }
    }

    function saveBookings(bookings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    }

    function setCurrentClientName(name) {
        const trimmed = (name || '').trim();
        const activeUserId = getCurrentSessionUserId();
        const clientKey = activeUserId ? getUserScopedKey(CLIENT_KEY, activeUserId) : CLIENT_KEY;

        if (!trimmed) {
            localStorage.removeItem(clientKey);
            return;
        }

        localStorage.setItem(clientKey, trimmed);
    }

    function getCurrentClientName() {
        const activeUserId = getCurrentSessionUserId();
        const clientKey = activeUserId ? getUserScopedKey(CLIENT_KEY, activeUserId) : CLIENT_KEY;
        return localStorage.getItem(clientKey) || localStorage.getItem(CLIENT_KEY) || '';
    }

    function setCurrentUser(user) {
        const activeUserId = getCurrentSessionUserId();

        if (!user) {
            if (activeUserId) {
                localStorage.removeItem(getUserScopedKey(SESSION_KEY, activeUserId));
                localStorage.removeItem(getUserScopedKey(CLIENT_KEY, activeUserId));
            }
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            return;
        }

        const userId = String(user.id || user.email || '').trim();
        if (!userId) {
            return;
        }

        localStorage.setItem(ACTIVE_SESSION_KEY, userId);
        localStorage.setItem(getUserScopedKey(SESSION_KEY, userId), JSON.stringify(user));
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }

    function getCurrentUser() {
        const userId = getCurrentSessionUserId();

        if (userId) {
            try {
                const session = localStorage.getItem(getUserScopedKey(SESSION_KEY, userId));
                if (session) {
                    return JSON.parse(session);
                }
            } catch (error) {
                return null;
            }
        }

        try {
            const session = localStorage.getItem(SESSION_KEY);
            return session ? JSON.parse(session) : null;
        } catch (error) {
            return null;
        }
    }

    function loginUser({ email, password }) {
        const users = getUsers();
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const user = users.find((entry) => entry.email.toLowerCase() === normalizedEmail && entry.password === String(password || ''));

        if (!user) {
            return null;
        }

        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        setCurrentUser(sessionUser);
        setCurrentClientName(user.name);
        return sessionUser;
    }

    function logoutUser() {
        const activeUserId = getCurrentSessionUserId();
        setCurrentUser(null);

        if (activeUserId) {
            localStorage.removeItem(getUserScopedKey(SESSION_KEY, activeUserId));
            localStorage.removeItem(getUserScopedKey(CLIENT_KEY, activeUserId));
        }

        localStorage.removeItem(CLIENT_KEY);
    }

    function registerUser({ name, email, password }) {
        const users = getUsers();
        const sanitizedEmail = String(email || '').trim().toLowerCase();
        const sanitizedName = String(name || '').trim();

        if (!sanitizedName || !sanitizedEmail || !password) {
            return null;
        }

        const existing = users.find((user) => user.email.toLowerCase() === sanitizedEmail);
        if (existing) {
            return null;
        }

        const newUser = {
            id: `client-${Date.now()}`,
            name: sanitizedName,
            email: sanitizedEmail,
            password: String(password),
            role: ROLES.CLIENT
        };

        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
    }

    function getClientBookings(clientName) {
        const selectedName = (clientName || '').trim();
        if (!selectedName) return [];

        return getBookings().filter((booking) => {
            const bookingName = String(booking.clientName || booking.name || '').trim().toLowerCase();
            return bookingName === selectedName.toLowerCase();
        });
    }

    function createBookingId() {
        return 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
    }

    function addBooking(bookingData) {
        const bookings = getBookings();
        const user = getCurrentUser();
        const newBooking = {
            id: bookingData.id || createBookingId(),
            clientName: (bookingData.clientName || bookingData.name || '').trim(),
            service: bookingData.service || 'Consultation',
            date: bookingData.date,
            time: bookingData.time,
            phone: bookingData.phone || '',
            email: bookingData.email || user?.email || '',
            createdAt: bookingData.createdAt || new Date().toISOString(),
            status: bookingData.status || 'upcoming'
        };

        bookings.push(newBooking);
        saveBookings(bookings);
        return newBooking;
    }

    function updateBooking(id, updatedBooking) {
        const bookings = getBookings();
        const index = bookings.findIndex((booking) => String(booking.id) === String(id));

        if (index === -1) {
            return null;
        }

        const merged = {
            ...bookings[index],
            clientName: (updatedBooking.clientName || updatedBooking.name || bookings[index].clientName || '').trim(),
            service: updatedBooking.service || bookings[index].service,
            date: updatedBooking.date || bookings[index].date,
            time: updatedBooking.time || bookings[index].time,
            phone: updatedBooking.phone ?? bookings[index].phone,
            email: updatedBooking.email ?? bookings[index].email,
            status: updatedBooking.status || bookings[index].status || 'upcoming'
        };

        bookings[index] = merged;
        saveBookings(bookings);
        return merged;
    }

    function deleteBooking(id) {
        const bookings = getBookings().filter((booking) => String(booking.id) !== String(id));
        saveBookings(bookings);
        return bookings;
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00');
        return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function hasPermission(action, booking = null) {
        const user = getCurrentUser();
        if (!user) return false;

        if (user.role === ROLES.ADMIN) {
            if (action === 'view_booking') {
                return true;
            }
            return false;
        }

        if (action === 'view_booking') {
            return user.role === ROLES.CLIENT || user.role === ROLES.ADMIN;
        }

        if (action === 'create_booking') {
            return user.role === ROLES.CLIENT;
        }

        if (action === 'edit_booking' || action === 'delete_booking') {
            if (!booking) return user.role === ROLES.CLIENT;
            const bookingOwnerName = String(booking.clientName || '').trim().toLowerCase();
            const bookingOwnerEmail = String(booking.email || '').trim().toLowerCase();
            const userName = String(user.name || '').trim().toLowerCase();
            const userEmail = String(user.email || '').trim().toLowerCase();
            return bookingOwnerName === userName || bookingOwnerEmail === userEmail;
        }

        return false;
    }

    function getVisibleBookingsForCurrentUser() {
        const user = getCurrentUser();
        if (!user) return [];

        if (user.role === ROLES.ADMIN || user.role === ROLES.CLIENT) {
            return getBookings();
        }

        return [];
    }

    window.bookingLogger = {
        STORAGE_KEY,
        CLIENT_KEY,
        SESSION_KEY,
        USERS_KEY,
        ROLES,
        getUsers,
        getBookings,
        saveBookings,
        getCurrentClientName,
        setCurrentClientName,
        getCurrentUser,
        setCurrentUser,
        loginUser,
        logoutUser,
        registerUser,
        getClientBookings,
        addBooking,
        updateBooking,
        deleteBooking,
        formatDate,
        hasPermission,
        getVisibleBookingsForCurrentUser,
        ensureSeedUsers
    };
})();
