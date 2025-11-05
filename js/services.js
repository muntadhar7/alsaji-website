// Services page functionality
let currentStep = 0;
const steps = [
    { title: 'Select Service Type', description: 'Choose the service you need' },
    { title: 'Vehicle Information', description: 'Tell us about your vehicle' },
    { title: 'Select Branch', description: 'Choose where to perform the service' },
    { title: 'Date & Time', description: 'Schedule your appointment' },
    { title: 'Confirmation', description: 'Review and confirm your booking' }
];

document.addEventListener('DOMContentLoaded', function() {
    setupServiceEvents();
    updateStepDisplay();
});

function setupServiceEvents() {
    // Service selection
    document.querySelectorAll('.service-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.service-option').forEach(opt => {
                opt.style.border = '1px solid var(--w1)';
            });
            this.style.border = '2px solid var(--red)';
            document.getElementById('nextStep').disabled = false;
        });
    });

    // Navigation buttons
    document.getElementById('nextStep').addEventListener('click', nextStep);
    document.getElementById('backStep').addEventListener('click', previousStep);
}

function nextStep() {
    if (currentStep < steps.length - 1) {
        currentStep++;
        updateStepDisplay();
    }
}

function previousStep() {
    if (currentStep > 0) {
        currentStep--;
        updateStepDisplay();
    }
}

function updateStepDisplay() {
    // Update step indicators
    const stepsContainer = document.getElementById('steps');
    if (stepsContainer) {
        stepsContainer.innerHTML = steps.map((step, index) => `
            <div class="chip" style="background:${index <= currentStep ? 'var(--w2)' : '#fff'}">
                ${step.title}
            </div>
        `).join('');
    }

    // Update step content
    const stepText = document.getElementById('stepText');
    const stepTitle = document.getElementById('stepTitle');

    if (stepText) stepText.textContent = `Step ${currentStep + 1} of ${steps.length}`;
    if (stepTitle) stepTitle.textContent = steps[currentStep].title;

    // Update navigation buttons
    const backBtn = document.getElementById('backStep');
    const nextBtn = document.getElementById('nextStep');

    if (backBtn) backBtn.disabled = currentStep === 0;
    if (nextBtn) {
        nextBtn.textContent = currentStep === steps.length - 1 ? 'Confirm Booking' : 'Next';
        nextBtn.disabled = currentStep === 0; // Disable until service selected
    }

    // Update step content based on current step
    updateStepContent();
}

function updateStepContent() {
    // This would update the main content area based on the current step
    // For now, we'll just show a placeholder
    console.log(`Current step: ${currentStep}`);
}