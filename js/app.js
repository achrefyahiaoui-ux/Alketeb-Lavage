/**
 * Alketeb Lavage - Car Wash Photo Capture App
 * Captures vehicle and license plate photos and sends to n8n webhooks
 */

// Webhook URLs
const WEBHOOK_URL = 'https://n8n.srv987649.hstgr.cloud/webhook/Lavage';
const WEBHOOK_VALIDER = 'https://n8n.srv987649.hstgr.cloud/webhook/Valider';
const WEBHOOK_TRASH = 'https://n8n.srv987649.hstgr.cloud/webhook/Trash';

// App State
const state = {
    photoVoiture: null,
    photoMatricule: null,
    currentPhotoType: null,
    stream: null,
    currentResult: null,
    historyData: []
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
    statusMessage: document.getElementById('statusMessage'),

    // Loading and Results elements
    loadingOverlay: document.getElementById('loadingOverlay'),
    resultsSection: document.getElementById('resultsSection'),
    successResults: document.getElementById('successResults'),
    errorResults: document.getElementById('errorResults'),
    resultCategorie: document.getElementById('resultCategorie'),
    resultLavageType: document.getElementById('resultLavageType'),
    resultPlate: document.getElementById('resultPlate'),
    resultPrix: document.getElementById('resultPrix'),
    errorMessage: document.getElementById('errorMessage'),
    btnApprouver: document.getElementById('btnApprouver'),
    btnRecommencerResults: document.getElementById('btnRecommencerResults'),
    btnRecommencerError: document.getElementById('btnRecommencerError'),

    // History elements
    historySearch: document.getElementById('historySearch'),
    historyTable: document.getElementById('historyTable'),
    historyEmpty: document.getElementById('historyEmpty'),
    historyLoading: document.getElementById('historyLoading'),
    btnRefreshHistory: document.getElementById('btnRefreshHistory')
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
    elements.btnApprouver.addEventListener('click', approveResult);
    elements.btnRecommencerResults.addEventListener('click', goBackToMain);
    elements.btnRecommencerError.addEventListener('click', goBackToMain);
    elements.historySearch.addEventListener('input', filterHistory);
    elements.btnRefreshHistory.addEventListener('click', refreshHistory);

    // Update submit button state when photos or wash type change
    updateSubmitButton();

    // Load history data
    fetchHistory();
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

    // Show loading overlay
    hideStatus();
    showLoading(true);

    try {
        // Send all data to single webhook
        const result = await sendToWebhook(WEBHOOK_URL, {
            image1: state.photoVoiture,
            image2: state.photoMatricule,
            washType: washType,
            timestamp: timestamp
        });

        // Hide loading
        showLoading(false);

        // Handle response
        if (result.success && result.data) {
            // Check if response is an array with data (success case)
            if (Array.isArray(result.data) && result.data.length > 0 && result.data[0].Categorie) {
                showSuccessResults(result.data[0]);
            } else if (typeof result.data === 'string') {
                // Error message from webhook
                showErrorResults(result.data);
            } else {
                showErrorResults('Réponse inattendue du serveur.');
            }
        } else {
            showErrorResults('Erreur de connexion. Veuillez réessayer.');
        }

    } catch (error) {
        console.error('Submit error:', error);
        showLoading(false);
        showErrorResults('Erreur de connexion. Veuillez réessayer.');
    }
}

/**
 * Send data to a webhook
 * @param {string} url - Webhook URL
 * @param {Object} data - Data to send
 * @returns {Object} Result object with success status and response data
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

        let responseData;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        return {
            success: response.ok,
            status: response.status,
            data: responseData
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
 * Show or hide loading overlay
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
    if (show) {
        elements.loadingOverlay.classList.remove('hidden');
    } else {
        elements.loadingOverlay.classList.add('hidden');
    }
}

/**
 * Show success results with vehicle data
 * @param {Object} data - Vehicle data from webhook
 */
function showSuccessResults(data) {
    state.currentResult = data;

    // Populate results table
    elements.resultCategorie.textContent = data.Categorie || '-';
    elements.resultLavageType.textContent = data.LavageType || '-';
    elements.resultPlate.textContent = data.Plate || '-';
    elements.resultPrix.textContent = data.Prix ? `${data.Prix} DT` : '-';

    // Show success results, hide error
    elements.errorResults.classList.add('hidden');
    elements.successResults.classList.remove('hidden');
    elements.resultsSection.classList.remove('hidden');
}

/**
 * Show error results with message
 * @param {string} message - Error message
 */
function showErrorResults(message) {
    elements.errorMessage.textContent = message;

    // Show error results, hide success
    elements.successResults.classList.add('hidden');
    elements.errorResults.classList.remove('hidden');
    elements.resultsSection.classList.remove('hidden');
}

/**
 * Go back to main screen from results
 */
function goBackToMain() {
    // Hide results section
    elements.resultsSection.classList.add('hidden');
    elements.successResults.classList.add('hidden');
    elements.errorResults.classList.add('hidden');

    // Reset app state
    resetApp();
}

/**
 * Approve the result and send to validation webhook
 */
async function approveResult() {
    if (!state.currentResult) return;

    // Show loading
    showLoading(true);

    try {
        const result = await sendToWebhook(WEBHOOK_VALIDER, state.currentResult);

        showLoading(false);

        if (result.success) {
            // Hide results and show success
            elements.resultsSection.classList.add('hidden');
            elements.successResults.classList.add('hidden');
            showStatus('Validation approuvée avec succès!', 'success');
            resetApp();
            // Refresh history
            fetchHistory();
        } else {
            showStatus('Erreur lors de la validation. Veuillez réessayer.', 'error');
        }
    } catch (error) {
        console.error('Approval error:', error);
        showLoading(false);
        showStatus('Erreur de connexion. Veuillez réessayer.', 'error');
    }
}

/**
 * Fetch history data from webhook
 */
async function fetchHistory() {
    // Show loading state
    elements.historyTable.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyLoading.classList.remove('hidden');

    try {
        const response = await fetch(WEBHOOK_TRASH, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                state.historyData = await response.json();
            } else {
                state.historyData = [];
            }
        } else {
            state.historyData = [];
        }

        // Display the history
        displayHistory(state.historyData);

    } catch (error) {
        console.error('Error fetching history:', error);
        state.historyData = [];
        displayHistory([]);
    }
}

/**
 * Display history data in the table
 * @param {Array} data - History data to display
 */
function displayHistory(data) {
    elements.historyLoading.classList.add('hidden');

    if (!data || data.length === 0) {
        elements.historyTable.classList.add('hidden');
        elements.historyEmpty.classList.remove('hidden');
        return;
    }

    elements.historyEmpty.classList.add('hidden');
    elements.historyTable.classList.remove('hidden');

    // Clear existing rows
    elements.historyTable.innerHTML = '';

    // Create rows for each history item
    data.forEach((item, index) => {
        const row = createHistoryRow(item, index);
        elements.historyTable.appendChild(row);
    });
}

/**
 * Create a history row element
 * @param {Object} item - History item data
 * @param {number} index - Index in the array
 * @returns {HTMLElement} Row element
 */
function createHistoryRow(item, index) {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.dataset.index = index;

    row.innerHTML = `
        <div class="history-row-content">
            <div class="history-item">
                <span class="history-item-label">Matricule</span>
                <span class="history-item-value">${item.Matricule || '-'}</span>
            </div>
            <div class="history-item">
                <span class="history-item-label">Catégorie</span>
                <span class="history-item-value">${item.Categorie || '-'}</span>
            </div>
            <div class="history-item">
                <span class="history-item-label">Type de Lavage</span>
                <span class="history-item-value">${item['Type de Lavage'] || '-'}</span>
            </div>
            <div class="history-item">
                <span class="history-item-label">Prix</span>
                <span class="history-item-value">${item.Prix ? item.Prix + ' DT' : '-'}</span>
            </div>
        </div>
        <button class="history-delete-btn" title="Supprimer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
        </button>
    `;

    // Add delete event listener
    const deleteBtn = row.querySelector('.history-delete-btn');
    deleteBtn.addEventListener('click', () => deleteHistoryItem(item, index, row));

    return row;
}

/**
 * Delete a history item
 * @param {Object} item - Item to delete
 * @param {number} index - Index in the array
 * @param {HTMLElement} rowElement - Row element to remove
 */
async function deleteHistoryItem(item, index, rowElement) {
    // Add visual feedback
    rowElement.style.opacity = '0.5';
    rowElement.style.pointerEvents = 'none';

    try {
        const result = await sendToWebhook(WEBHOOK_TRASH, {
            action: 'delete',
            item: item
        });

        if (result.success) {
            // Remove from state
            state.historyData.splice(index, 1);

            // Animate removal
            rowElement.style.transition = 'all 0.3s ease';
            rowElement.style.transform = 'translateX(100%)';
            rowElement.style.opacity = '0';

            setTimeout(() => {
                rowElement.remove();

                // Check if table is empty
                if (state.historyData.length === 0) {
                    elements.historyTable.classList.add('hidden');
                    elements.historyEmpty.classList.remove('hidden');
                } else {
                    // Re-render to update indices
                    displayHistory(state.historyData);
                }
            }, 300);

        } else {
            // Restore row state
            rowElement.style.opacity = '1';
            rowElement.style.pointerEvents = 'auto';
            showStatus('Erreur lors de la suppression.', 'error');
        }

    } catch (error) {
        console.error('Delete error:', error);
        rowElement.style.opacity = '1';
        rowElement.style.pointerEvents = 'auto';
        showStatus('Erreur de connexion.', 'error');
    }
}

/**
 * Filter history based on search input
 */
function filterHistory() {
    const searchTerm = elements.historySearch.value.toLowerCase().trim();

    if (!searchTerm) {
        displayHistory(state.historyData);
        return;
    }

    const filtered = state.historyData.filter(item => {
        const matricule = (item.Matricule || '').toLowerCase();
        const categorie = (item.Categorie || '').toLowerCase();
        const typeLavage = (item['Type de Lavage'] || '').toLowerCase();

        return matricule.includes(searchTerm) ||
               categorie.includes(searchTerm) ||
               typeLavage.includes(searchTerm);
    });

    displayHistory(filtered);
}

/**
 * Refresh history data with button animation
 */
async function refreshHistory() {
    // Add spinning animation to button
    elements.btnRefreshHistory.classList.add('spinning');
    elements.btnRefreshHistory.disabled = true;

    // Clear search input
    elements.historySearch.value = '';

    // Fetch history
    await fetchHistory();

    // Remove spinning animation
    elements.btnRefreshHistory.classList.remove('spinning');
    elements.btnRefreshHistory.disabled = false;
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
