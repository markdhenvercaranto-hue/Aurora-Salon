// Enhanced Storage System with localStorage + IndexedDB fallback
const enhancedStorage = {
    DB_NAME: 'AuraSalonDB',
    STORE_NAME: 'bookings',
    
    initDB() {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(this.DB_NAME, 1);
                
                request.onerror = () => {
                    console.error('❌ IndexedDB initialization failed');
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    console.log('✅ IndexedDB ready');
                    resolve(request.result);
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                        db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    }
                };
            } catch (e) {
                reject(e);
            }
        });
    },
    
    saveToIndexedDB(bookings) {
        return enhancedStorage.initDB().then(db => {
            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(this.STORE_NAME);
                    store.clear();
                    bookings.forEach(booking => store.add(booking));
                    transaction.oncomplete = () => resolve(true);
                    transaction.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }).catch(() => Promise.resolve(false));
    },
    
    loadFromIndexedDB() {
        return enhancedStorage.initDB().then(db => {
            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction([this.STORE_NAME], 'readonly');
                    const store = transaction.objectStore(this.STORE_NAME);
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => resolve([]);
                } catch (e) {
                    resolve([]);
                }
            });
        }).catch(() => Promise.resolve([]));
    }
};

// BookingLogger - Manages booking data storage and retrieval
// Uses localStorage with enhanced error handling and IndexedDB fallback
const bookingLogger = {
    STORAGE_KEY: 'aura_salon_bookings',
    
    // Check if localStorage is available and writable
    isLocalStorageAvailable() {
        try {
            const test = '__test_' + Date.now();
            localStorage.setItem(test, test);
            const value = localStorage.getItem(test);
            localStorage.removeItem(test);
            
            if (value === test) {
                console.log('✅ localStorage is fully functional');
                return true;
            }
        } catch (e) {
            console.error('❌ localStorage is not available:', e.message);
        }
        return false;
    },
    
    // Initialize or retrieve bookings from localStorage
    getBookings() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            const bookings = data ? JSON.parse(data) : [];
            console.log('📊 Retrieved ' + bookings.length + ' bookings from storage');
            return bookings;
        } catch (e) {
            console.error('❌ Error retrieving bookings:', e);
            return [];
        }
    },
    
    // Save bookings to both localStorage and IndexedDB
    saveBookings(bookings) {
        try {
            const jsonData = JSON.stringify(bookings);
            localStorage.setItem(this.STORAGE_KEY, jsonData);
            
            // Verify the save was successful
            const retrieved = localStorage.getItem(this.STORAGE_KEY);
            if (retrieved === jsonData) {
                console.log('💾 Bookings saved to localStorage (' + bookings.length + ' bookings)');
            } else {
                console.error('❌ localStorage verification failed');
            }
        } catch (e) {
            console.error('❌ Error saving to localStorage:', e);
        }
        
        // Also save to IndexedDB as backup
        enhancedStorage.saveToIndexedDB(bookings).catch(() => {});
    },
    
    // Log a new booking
    logBooking(bookingData) {
        const bookings = this.getBookings();
        
        // Create booking object with ID and timestamp
        const booking = {
            id: this.generateId(),
            name: bookingData.name,
            service: bookingData.service,
            date: bookingData.date,
            time: bookingData.time,
            timestamp: new Date().toISOString(),
            status: 'Confirmed'
        };
        
        // Add to bookings array
        bookings.push(booking);
        
        // Save to localStorage
        this.saveBookings(bookings);
        
        console.log('📝 Booking logged:', booking);
        return booking;
    },
    
    // Generate unique booking ID
    generateId() {
        return 'BK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    },
    
    // Get all bookings
    getAllBookings() {
        return this.getBookings();
    },
    
    // Get bookings for a specific date
    getBookingsByDate(date) {
        return this.getBookings().filter(booking => booking.date === date);
    },
    
    // Delete a booking by ID
    deleteBooking(bookingId) {
        let bookings = this.getBookings();
        bookings = bookings.filter(booking => booking.id !== bookingId);
        this.saveBookings(bookings);
        console.log('🗑️ Booking deleted:', bookingId);
        return true;
    },
    
    // Clear all bookings
    clearAllBookings() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🗑️ All bookings cleared');
    },
    
    // Get booking statistics
    getStatistics() {
        const bookings = this.getBookings();
        return {
            totalBookings: bookings.length,
            byService: this.groupByService(bookings),
            upcomingBookings: this.getUpcomingBookings(bookings)
        };
    },
    
    // Group bookings by service
    groupByService(bookings) {
        return bookings.reduce((acc, booking) => {
            acc[booking.service] = (acc[booking.service] || 0) + 1;
            return acc;
        }, {});
    },
    
    // Get upcoming bookings only
    getUpcomingBookings(bookings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return bookings.filter(booking => new Date(booking.date) >= today);
    }
};