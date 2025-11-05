
const CONFIG = {
development: {
        baseURL: 'http://localhost:8888',
        useMockData: false, // ← Change to false
        debug: true
    },
    production: {
        baseURL: 'https://your-live-odoo.com',
        useMockData: false,
        debug: false
    },
    offline: {
        baseURL: '',
        useMockData: true,
        debug: true
    }
};

// Set current environment
const CURRENT_ENV = 'development';

// Apply configuration
const currentConfig = CONFIG[CURRENT_ENV];
console.log(`Frontend running in ${CURRENT_ENV} mode`);
console.log(`API Base URL: ${currentConfig.baseURL}`);
console.log(`Using Mock Data: ${currentConfig.useMockData}`);