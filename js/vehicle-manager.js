// Vehicle Manager - Handles vehicle selection and storage
class VehicleManager {
    constructor() {
        this.currentVehicle = this.getStoredVehicle();
    }

    // Save vehicle to localStorage
    saveVehicle(vehicle) {
        this.currentVehicle = vehicle;
        localStorage.setItem('selectedVehicle', JSON.stringify(vehicle));
        console.log('🚗 Vehicle saved:', vehicle);
    }

    // Get vehicle from localStorage
    getStoredVehicle() {
        const stored = localStorage.getItem('selectedVehicle');
        return stored ? JSON.parse(stored) : null;
    }

    // Clear vehicle selection
    clearVehicle() {
        this.currentVehicle = null;
        localStorage.removeItem('selectedVehicle');
        console.log('🚗 Vehicle selection cleared');
    }

    // Get current vehicle
    getCurrentVehicle() {
        return this.currentVehicle;
    }

    // Check if a vehicle is selected
    hasVehicle() {
        return this.currentVehicle !== null;
    }

    // Navigate to shop with vehicle filters
    goToShopWithVehicle() {
        if (this.hasVehicle()) {
            // Create URL parameters for the vehicle
            const params = new URLSearchParams();
            params.append('make', this.currentVehicle.makeId);
            params.append('model', this.currentVehicle.modelId);
            params.append('year', this.currentVehicle.year);

            // Navigate to shop page with vehicle filters
            window.location.href = `shop.html?${params.toString()}`;
        } else {
            // Navigate to shop without filters
            window.location.href = 'shop.html';
        }
    }
}

// Initialize global vehicle manager
const vehicleManager = new VehicleManager();