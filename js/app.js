document.addEventListener('alpine:init', () => {
    Alpine.data('storeApp', () => ({
        // ---- STATE CATALOG ----
        products: [],
        search: '',
        selectedSize: '',
        selectedCondition: '',
        selectedStatus: '',
        sortBy: 'newest',
        
        // ---- STATE CART ----
        cart: [],
        isCartOpen: false,
        
        // ---- STATE UI ----
        selectedProduct: null,
        isModalOpen: false,
        isMobileMenuOpen: false,
        activeImage: '',
        isSubmitting: false,
        
        // ---- STATE NOTIFIKASI ----
        notification: {
            show: false,
            message: '',
            type: 'success', // success, error, warning
            timeout: null
        },

        get filteredProducts() {
            let result = this.products.filter(p => {
                const searchMatch = p.name.toLowerCase().includes(this.search.toLowerCase()) || 
                                  p.model.toLowerCase().includes(this.search.toLowerCase());
                const sizeMatch = !this.selectedSize || p.size === this.selectedSize;
                const statusMatch = !this.selectedStatus || p.status === this.selectedStatus;
                const conditionMatch = !this.selectedCondition || p.condition === this.selectedCondition;
                return searchMatch && sizeMatch && statusMatch && conditionMatch;
            });

            // Sorting
            if (this.sortBy === 'price_asc') {
                result.sort((a, b) => a.price - b.price);
            } else if (this.sortBy === 'price_desc') {
                result.sort((a, b) => b.price - a.price);
            } else if (this.sortBy === 'newest') {
                result.sort((a, b) => (b.id || 0) - (a.id || 0));
            }

            return result;
        },

        resetFilters() {
            this.search = '';
            this.selectedSize = '';
            this.selectedCondition = '';
            this.selectedStatus = '';
            this.sortBy = 'newest';
        },

        openProduct(product) {
            this.selectedProduct = product;
            this.activeImage = product.image;
            this.isModalOpen = true;
            document.body.style.overflow = 'hidden';
        },

        closeProduct() {
            this.isModalOpen = false;
            document.body.style.overflow = 'auto';
            setTimeout(() => { this.selectedProduct = null; }, 300);
        },

        // ---- STATE CUSTOMER & LOKASI ----
        customer: {
            name: '',
            phone: '',
            address: '',
            note: '',
            lat: null,
            lng: null
        },
        errors: {},
        adminWhatsApp: '6281234567890',

        // State Map Internal
        map: null,
        marker: null,
        isLocating: false,
        isGeocoding: false,
        mapError: '',

        init() {
            // Load Dummy Data
            if (typeof DUMMY_PRODUCTS !== 'undefined') {
                this.products = DUMMY_PRODUCTS;
            }
            // Load Cart
            this.loadCart();
        },

        /* ==================== CART LOGIC ==================== */
        loadCart() {
            try {
                const stored = localStorage.getItem('vansCart');
                if (stored) {
                    this.cart = JSON.parse(stored);
                }
            } catch (err) {
                this.cart = [];
            }
        },

        saveCart() {
            localStorage.setItem('vansCart', JSON.stringify(this.cart));
        },

        addToCart(product) {
            if (product.status === 'SOLD') {
                this.showToast('Maaf, produk ini sudah habis terjual.', 'error');
                return;
            }

            const item = this.cart.find(i => i.id === product.id);
            if (item) {
                item.qty++;
            } else {
                this.cart.push({ ...product, qty: 1 });
            }

            this.saveCart();
            this.showToast('Produk ditambahkan ke keranjang!', 'success');
        },

        removeFromCart(id) {
            this.cart = this.cart.filter(item => item.id !== id);
            this.saveCart();
            if (this.cart.length === 0) {
                this.isCartOpen = false;
            }
        },

        incrementQty(id) {
            const item = this.cart.find(i => i.id === id);
            if (item) {
                item.qty++;
                this.saveCart();
            }
        },

        decrementQty(id) {
            const item = this.cart.find(i => i.id === id);
            if (item) {
                if (item.qty > 1) {
                    item.qty--;
                } else {
                    this.removeFromCart(id);
                }
                this.saveCart();
            }
        },

        clearCart() {
            this.cart = [];
            this.saveCart();
        },

        get cartCount() {
            return this.cart.reduce((total, item) => total + (item.qty || 1), 0);
        },

        get cartTotal() {
            return this.cart.reduce((total, item) => total + (item.price * (item.qty || 1)), 0);
        },

        /* ==================== TOAST ==================== */
        showToast(message, type = 'success') {
            if (this.notification.timeout) clearTimeout(this.notification.timeout);
            
            this.notification.message = message;
            this.notification.type = type;
            this.notification.show = true;

            this.notification.timeout = setTimeout(() => {
                this.notification.show = false;
            }, 3000); 
        },

        closeToast() {
            this.notification.show = false;
        },

        /* ==================== INLINE MAP PICKER ==================== */
        initMap() {
            // Kita bungkus di $nextTick agar element mapInline sudah dirender oleh Alpine
            this.$nextTick(() => {
                const mapEl = document.getElementById('mapInline');
                if (!mapEl) return;

                // Default Cianjur
                const defaultLat = -6.816667;
                const defaultLng = 107.150002;

                this.map = L.map('mapInline').setView([defaultLat, defaultLng], 14);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap'
                }).addTo(this.map);

                // Event Klik Map
                this.map.on('click', (e) => {
                    this.setMarker(e.latlng.lat, e.latlng.lng);
                });

                // Jika sudah ada lat/lng di state (misal load dari localstorage nanti) 
                // Kita load marker, tapi untuk sekarang start kosong
            });
        },

        setMarker(lat, lng) {
            if (this.marker) {
                this.marker.setLatLng([lat, lng]);
            } else {
                this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
                this.marker.on('dragend', () => {
                    const pos = this.marker.getLatLng();
                    this.updateLocation(pos.lat, pos.lng);
                });
            }
            this.map.panTo([lat, lng]);
            this.updateLocation(lat, lng);
        },

        updateLocation(lat, lng) {
            this.customer.lat = lat;
            this.customer.lng = lng;
            this.reverseGeocode(lat, lng);
        },

        async reverseGeocode(lat, lng) {
            this.isGeocoding = true;
            this.mapError = '';
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'id' }
                });
                const data = await response.json();
                if (data && data.display_name) {
                    this.customer.address = data.display_name;
                } else {
                    this.mapError = 'Alamat tidak ditemukan.';
                }
            } catch (err) {
                this.mapError = 'Gagal menghubungi server alamat.';
            } finally {
                this.isGeocoding = false;
            }
        },

        useCurrentLocation() {
            if (!navigator.geolocation) {
                this.showToast('Geolocation tidak didukung browser ini.', 'error');
                return;
            }
            this.isLocating = true;
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.isLocating = false;
                    this.setMarker(pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                    this.isLocating = false;
                    this.showToast('Gagal mengambil lokasi. Pastikan izin GPS aktif.', 'error');
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        },

        resetLocation() {
            if (this.marker) {
                this.map.removeLayer(this.marker);
                this.marker = null;
            }
            this.customer.lat = null;
            this.customer.lng = null;
            this.customer.address = '';
        },

        /* ==================== CHECKOUT ==================== */
        validateForm() {
            this.errors = {};
            let isValid = true;

            if (!this.customer.name.trim()) {
                this.errors.name = 'Nama lengkap wajib diisi.';
                isValid = false;
            }
            if (!this.customer.phone.trim()) {
                this.errors.phone = 'No WhatsApp wajib diisi.';
                isValid = false;
            }
            if (!this.customer.address || !this.customer.lat) {
                this.errors.address = 'Silakan pilih titik lokasi pengiriman di peta.';
                isValid = false;
            }

            return isValid;
        },

        formatPrice(price) {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(price);
        },

        submitToWhatsApp() {
            if (!this.validateForm()) {
                this.showToast('Lengkapi data yang ditandai merah.', 'error');
                return;
            }

            this.isSubmitting = true;
            
            // Format Pesanan
            let msg = `Halo Vans Bekas ID, saya ingin memesan produk berikut:\n\n`;
            msg += `========================\n`;
            msg += `DETAIL PESANAN\n`;
            msg += `========================\n`;
            
            this.cart.forEach((item, index) => {
                msg += `${index + 1}. Nama Produk: ${item.name}\n`;
                msg += `   Ukuran: ${item.size}\n`;
                msg += `   Qty: ${item.qty}\n`;
                msg += `   Harga: ${this.formatPrice(item.price)}\n`;
                msg += `   Subtotal: ${this.formatPrice(item.price * item.qty)}\n\n`;
            });

            msg += `Total Pesanan: ${this.formatPrice(this.cartTotal)}\n\n`;
            
            msg += `========================\n`;
            msg += `DATA CUSTOMER\n`;
            msg += `========================\n`;
            msg += `Nama: ${this.customer.name}\n`;
            msg += `No WhatsApp: ${this.customer.phone}\n`;
            msg += `Alamat: ${this.customer.address}\n`;
            msg += `Koordinat: ${this.customer.lat}, ${this.customer.lng}\n`;
            msg += `Link Maps: https://www.google.com/maps?q=${this.customer.lat},${this.customer.lng}\n`;
            
            if (this.customer.note) {
                msg += `Catatan: ${this.customer.note}\n`;
            }

            msg += `\nTerima kasih.`;

            const encodedMsg = encodeURIComponent(msg);
            const waUrl = `https://wa.me/${this.adminWhatsApp}?text=${encodedMsg}`;
            
            window.open(waUrl, '_blank');
            
            // Clear cart and redirect
            setTimeout(() => {
                this.clearCart();
                window.location.href = 'index.html';
            }, 1500);
        }
    }));
});
