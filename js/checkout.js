document.addEventListener('alpine:init', () => {
    Alpine.data('checkoutStore', () => ({
        adminWhatsApp: '6281234567890',
        cart: [],
        customer: {
            name: '',
            phone: '',
            address: '',
            district: '',
            city: '',
            province: '',
            postalCode: '',
            note: ''
        },
        errors: {},
        isSubmitting: false,
        toast: {
            show: false,
            message: '',
            type: 'success'
        },

        init() {
            try {
                const storedCart = localStorage.getItem('vansCart');
                if (storedCart) {
                    this.cart = JSON.parse(storedCart);
                } else {
                    this.cart = [];
                }
            } catch (error) {
                console.error("Error parsing cart data from localStorage", error);
                this.cart = [];
                this.showToast('Gagal memuat keranjang', 'error');
            }
        },

        formatRupiah(value) {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(value);
        },

        get cartCount() {
            return this.cart.length; 
        },

        get cartTotal() {
            return this.cart.reduce((total, item) => total + item.price, 0);
        },

        validateForm() {
            this.errors = {};
            let isValid = true;

            if (this.cart.length === 0) {
                this.showToast('Keranjang Anda kosong!', 'error');
                isValid = false;
            }
            if (!this.customer.name.trim()) {
                this.errors.name = 'Nama lengkap wajib diisi';
                isValid = false;
            }
            if (!this.customer.phone.trim()) {
                this.errors.phone = 'Nomor WhatsApp wajib diisi';
                isValid = false;
            } else {
                const cleanPhone = this.normalizePhone(this.customer.phone);
                if (cleanPhone.length < 9) {
                    this.errors.phone = 'Nomor WhatsApp tidak valid';
                    isValid = false;
                }
            }
            if (!this.customer.address.trim()) {
                this.errors.address = 'Alamat lengkap wajib diisi';
                isValid = false;
            }
            if (!this.customer.district.trim()) {
                this.errors.district = 'Kecamatan wajib diisi';
                isValid = false;
            }
            if (!this.customer.city.trim()) {
                this.errors.city = 'Kota/Kabupaten wajib diisi';
                isValid = false;
            }
            if (!this.customer.province.trim()) {
                this.errors.province = 'Provinsi wajib diisi';
                isValid = false;
            }

            return isValid;
        },

        normalizePhone(phone) {
            let cleaned = phone.replace(/[^\d+]/g, '');
            if (cleaned.startsWith('0')) {
                cleaned = '62' + cleaned.substring(1);
            }
            return cleaned;
        },

        showToast(message, type = 'success') {
            this.toast.message = message;
            this.toast.type = type;
            this.toast.show = true;

            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
        },

        generateWhatsAppMessage() {
            let message = `Halo Vans Bekas ID, saya ingin melakukan pemesanan.\n\n`;
            
            message += `========================\n`;
            message += `DATA CUSTOMER\n`;
            message += `========================\n`;
            message += `Nama: ${this.customer.name}\n`;
            message += `No. WhatsApp: ${this.normalizePhone(this.customer.phone)}\n`;
            message += `Alamat: ${this.customer.address}\n`;
            message += `Kecamatan: ${this.customer.district}\n`;
            message += `Kota/Kabupaten: ${this.customer.city}\n`;
            message += `Provinsi: ${this.customer.province}\n`;
            
            if (this.customer.postalCode && this.customer.postalCode.trim() !== '') {
                message += `Kode Pos: ${this.customer.postalCode}\n`;
            }
            
            message += `\n========================\n`;
            message += `DETAIL PESANAN\n`;
            message += `========================\n`;
            
            this.cart.forEach((item, index) => {
                message += `${index + 1}. ${item.name}\n`;
                message += `   - Model: ${item.model}\n`;
                message += `   - Size: ${item.size}\n`;
                message += `   - Kondisi: ${item.condition}\n`;
                message += `   - Qty: 1\n`;
                message += `   - Harga: ${this.formatRupiah(item.price)}\n`;
                message += `   - Subtotal: ${this.formatRupiah(item.price)}\n`;
                if(index < this.cart.length - 1) message += `\n`;
            });
            
            message += `\n========================\n`;
            message += `RINGKASAN\n`;
            message += `========================\n`;
            message += `Total Item: ${this.cartCount}\n`;
            message += `Estimasi Total: ${this.formatRupiah(this.cartTotal)}\n`;
            
            if (this.customer.note && this.customer.note.trim() !== '') {
                message += `\nCatatan:\n${this.customer.note}\n`;
            }
            
            message += `\nMohon info ketersediaan barang dan total ongkir. Terima kasih.`;
            
            return message;
        },

        submitOrder() {
            if (this.cart.length === 0) {
                this.showToast('Keranjang masih kosong', 'warning');
                return;
            }
            
            if (!this.validateForm()) {
                this.showToast('Lengkapi data pemesanan terlebih dahulu', 'error');
                return;
            }
            
            this.isSubmitting = true;
            this.showToast('Membuka WhatsApp...', 'success');
            
            const textMessage = this.generateWhatsAppMessage();
            const encodedMessage = encodeURIComponent(textMessage);
            const waUrl = `https://wa.me/${this.adminWhatsApp}?text=${encodedMessage}`;
            
            window.open(waUrl, '_blank');
            
            setTimeout(() => {
                this.isSubmitting = false;
            }, 500);
        },

        goBackToShop() {
            window.location.href = 'shop.html';
        },
        
        clearCartAfterConfirmation() {
            localStorage.removeItem('vansCart');
            this.cart = [];
        }
    }));
});
