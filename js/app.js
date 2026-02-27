/**
 * Alketeb Lavage - Car Wash Photo Capture App
 * Captures vehicle and license plate photos and sends to n8n webhooks
 */

// Webhook URL - single endpoint for all data
const WEBHOOK_URL = 'https://n8n.srv987649.hstgr.cloud/webhook/Lavage';

// App State
const state = {
    photoVoiture: null,
    photoMatricule: null,
    currentPhotoType: null,
    stream: null
};

// DOM Elements
const elements = {
    // Buttons
    btnPhotoVoiture: document.getElementById('btnPhotoVoiture'),
    btnPhotoMatricule: document.getElementById('btnPhotoMatricule'),
    btnValider: document.getElementById('btnValider'),
    btnRestart: document.getElementById('btnRestart'),
    btnCapture: document.getElementById('btnCapture'),
    btnCloseCamera: document.getElementById('btnCloseCamera'),
    retakeVoiture: document.getElementById('retakeVoiture'),
    retakeMatricule: document.getElementById('retakeMatricule'),

    // Preview elements
    previewVoiture: document.getElementById('previewVoiture'),
    previewMatricule: document.getElementById('previewMatricule'),
    imgVoiture: document.getElementById('imgVoiture'),
    imgMatricule: document.getElementById('imgMatricule'),

    // Camera elements
    cameraModal: document.getElementById('cameraModal'),
    cameraVideo: document.getElementById('cameraVideo'),
    cameraHint: document.getElementById('cameraHint'),
    photoCanvas: document.getElementById('photoCanvas'),

    // Other elements
    washType: document.getElementById('washType'),
    statusMessage: document.getElementById('statusMessage')
};

// Camera hints for each photo type
const CAMERA_HINTS = {
    voiture: 'Prenez une photo de la voiture',
    matricule: 'Prenez une photo de la plaque d\'immatriculation'
};

/**
 * Initialize the application
 */
function init() {
    // Bind event listeners
    elements.btnPhotoVoiture.addEventListener('click', () => openCamera('voiture'));
    elements.btnPhotoMatricule.addEventListener('click', () => openCamera('matricule'));
    elements.btnCapture.addEventListener('click', capturePhoto);
    elements.btnCloseCamera.addEventListener('click', closeCamera);
    elements.btnValider.addEventListener('click', submitPhotos);
    elements.btnRestart.addEventListener('click', restartApp);
    elements.retakeVoiture.addEventListener('click', () => retakePhoto('voiture'));
    elements.retakeMatricule.addEventListener('click', () => retakePhoto('matricule'));
    elements.washType.addEventListener('change', updateSubmitButton);

    // Update submit button state when photos or wash type change
    updateSubmitButton();
}

/**
 * Open camera modal for the specified photo type
 * @param {string} type - 'voiture' or 'matricule'
 */
async function openCamera(type) {
    state.currentPhotoType = type;
    elements.cameraHint.textContent = CAMERA_HINTS[type];

    try {
        // Request camera access with rear camera preference
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        elements.cameraVideo.srcObject = state.stream;

        // Show camera modal
        elements.cameraModal.classList.remove('hidden');

        // Wait for video to be ready
        await new Promise((resolve) => {
            elements.cameraVideo.onloadedmetadata = resolve;
        });

        await elements.cameraVideo.play();

    } catch (error) {
        console.error('Camera access error:', error);
        showStatus('Impossible d\'accéder à la caméra. Veuillez autoriser l\'accès.', 'error');
        closeCamera();
    }
}

/**
 * Close camera modal and stop video stream
 */
function closeCamera() {
    // Stop all video tracks
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }

    elements.cameraVideo.srcObject = null;
    elements.cameraModal.classList.add('hidden');
    state.currentPhotoType = null;
}

/**
 * Capture photo from video stream
 */
function capturePhoto() {
    if (!state.currentPhotoType || !state.stream) return;

    const video = elements.cameraVideo;
    const canvas = elements.photoCanvas;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 JPEG
    const imageData = canvas.toDataURL('image/jpeg', 0.85);

    // Store photo based on type
    if (state.currentPhotoType === 'voiture') {
        state.photoVoiture = imageData;
        elements.imgVoiture.src = imageData;
        elements.previewVoiture.classList.remove('hidden');
    } else if (state.currentPhotoType === 'matricule') {
        state.photoMatricule = imageData;
        elements.imgMatricule.src = imageData;
        elements.previewMatricule.classList.remove('hidden');
    }

    // Close camera and update UI
    closeCamera();
    updateSubmitButton();
}

/**
 * Clear a photo and allow retaking
 * @param {string} type - 'voiture' or 'matricule'
 */
function retakePhoto(type) {
    if (type === 'voiture') {
        state.photoVoiture = null;
        elements.imgVoiture.src = '';
        elements.previewVoiture.classList.add('hidden');
    } else if (type === 'matricule') {
        state.photoMatricule = null;
        elements.imgMatricule.src = '';
        elements.previewMatricule.classList.add('hidden');
    }

    updateSubmitButton();
    openCamera(type);
}

/**
 * Update submit button state based on captured photos and wash type
 */
function updateSubmitButton() {
    const hasAllPhotos = state.photoVoiture && state.photoMatricule;
    const hasWashType = elements.washType.value !== '';
    elements.btnValider.disabled = !(hasAllPhotos && hasWashType);
}

/**
 * Submit photos to the webhook
 */
async function submitPhotos() {
    if (!state.photoVoiture || !state.photoMatricule) {
        showStatus('Veuillez prendre les deux photos', 'error');
        return;
    }

    const washType = elements.washType.value;

    if (!washType) {
        showStatus('Veuillez sélectionner le type de lavage', 'error');
        return;
    }
    const timestamp = new Date().toISOString();

    // Disable button and show loading state
    setSubmitLoading(true);
    hideStatus();

    try {
        // Send all data to single webhook
        const result = await sendToWebhook(WEBHOOK_URL, {
            image1: state.photoVoiture,
            image2: state.photoMatricule,
            washType: washType,
            timestamp: timestamp
        });

        // Check result
        if (result.success) {
            showStatus('Photos envoyées avec succès!', 'success');
            resetApp();
        } else {
            showStatus('Erreur d\'envoi. Veuillez réessayer.', 'error');
        }

    } catch (error) {
        console.error('Submit error:', error);
        showStatus('Erreur de connexion. Veuillez réessayer.', 'error');
    } finally {
        setSubmitLoading(false);
    }
}

/**
 * Send data to a webhook
 * @param {string} url - Webhook URL
 * @param {Object} data - Data to send
 * @returns {Object} Result object with success status
 */
async function sendToWebhook(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        return {
            success: response.ok,
            status: response.status
        };

    } catch (error) {
        console.error('Webhook error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Set submit button loading state
 * @param {boolean} loading - Whether to show loading state
 */
function setSubmitLoading(loading) {
    const btnText = elements.btnValider.querySelector('.btn-text');
    const btnLoader = elements.btnValider.querySelector('.btn-loader');

    if (loading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        elements.btnValider.disabled = true;
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        updateSubmitButton();
    }
}

/**
 * Show status message
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showStatus(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    elements.statusMessage.classList.remove('hidden');

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(hideStatus, 5000);
    }
}

/**
 * Hide status message
 */
function hideStatus() {
    elements.statusMessage.classList.add('hidden');
}

/**
 * Reset app to initial state after successful submission
 */
function resetApp() {
    // Clear photos
    state.photoVoiture = null;
    state.photoMatricule = null;

    // Clear previews
    elements.imgVoiture.src = '';
    elements.imgMatricule.src = '';
    elements.previewVoiture.classList.add('hidden');
    elements.previewMatricule.classList.add('hidden');

    // Reset dropdown
    elements.washType.value = '';

    // Update submit button
    updateSubmitButton();
}

/**
 * Restart app - clear all data and start fresh
 */
function restartApp() {
    // Clear photos
    state.photoVoiture = null;
    state.photoMatricule = null;

    // Clear previews
    elements.imgVoiture.src = '';
    elements.imgMatricule.src = '';
    elements.previewVoiture.classList.add('hidden');
    elements.previewMatricule.classList.add('hidden');

    // Reset dropdown
    elements.washType.value = '';

    // Hide any status messages
    hideStatus();

    // Update submit button
    updateSubmitButton();

    // Show confirmation
    showStatus('Application redémarrée', 'success');
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
