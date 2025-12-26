import db from './db.js';

// DOM Elements
const sections = {
    scan: document.getElementById('scan-section'),
    camera: document.getElementById('camera-section'),
    manual: document.getElementById('manual-section'),
    result: document.getElementById('result-section')
};

// State
let state = {
    labelId: null,
    serialRaw: null,
    actorName: localStorage.getItem('actorName') || null
};

// Init
async function init() {
    await db.init();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/js/sw.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.log('SW failed', err));
    }

    // Sync if online
    if (navigator.onLine) {
        syncEvents();
    }
    window.addEventListener('online', syncEvents);

    // Prompt for Actor Name if missing
    if (!state.actorName) {
        const name = prompt("Enter your name/ID for this session:", "Staff");
        if (name) {
            state.actorName = name;
            localStorage.setItem('actorName', name);
        }
    }

    setupScanner();
}

function showSection(name) {
    Object.values(sections).forEach(el => el && el.classList.add('hidden'));
    if (sections[name]) {
        sections[name].classList.remove('hidden');
        sections[name].classList.add('animate-fade-in');
    }
}

// QR Scanner
let html5QrcodeScanner = null;

function setupScanner() {
    if (sections.scan) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }
}

async function onScanSuccess(decodedText, decodedResult) {
    console.log(`Code matched = ${decodedText}`, decodedResult);
    state.labelId = decodedText;

    // Stop scanning
    html5QrcodeScanner.clear();

    // Proceed to Next Step (Verify UI)
    // We could immediately check DB if label exists to give fast feedback
    // For now, let's ask for Serial Input (Photo or Manual)
    showSection('camera');

    // Pre-fetch label info if online to warm cache
    try {
        const res = await fetch(`/api/labels/${state.labelId}`);
        if (res.ok) {
            const data = await res.json();
            // Cache it
            await db.saveLabel(data);
        }
    } catch (e) { console.log("Offline or fetch failed, relying on cache"); }
}

function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
}

// Camera / OCR Logic
const videoElement = document.getElementById('camera-preview');
const canvasElement = document.getElementById('camera-canvas');
const captureBtn = document.getElementById('capture-btn');
const manualBtn = document.getElementById('manual-entry-btn'); // Renamed logic

if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
        // Capture frame
        const context = canvasElement.getContext('2d');
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        const dataUrl = canvasElement.toDataURL('image/png');

        // Stop camera stream
        const stream = videoElement.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        // Run OCR
        performOCR(dataUrl);
    });
}

// Start Camera Helper
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoElement.srcObject = stream;
        videoElement.play();
    } catch (err) {
        console.error("Camera access denied", err);
        alert("Camera access required for OCR. Using manual fallback.");
        showSection('manual');
    }
}

// Hook up start camera when section shown
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.id === 'camera-section' && !mutation.target.classList.contains('hidden')) {
            startCamera();
        }
    });
});
if (sections.camera) observer.observe(sections.camera, { attributes: true });


async function performOCR(imagePath) {
    // Show loading state
    document.getElementById('ocr-status').innerText = "Analyzing text...";

    try {
        const worker = await Tesseract.createWorker('eng');
        const ret = await worker.recognize(imagePath);
        console.log(ret.data.text);
        await worker.terminate();

        // Pre-fill manual input with result for confirmation
        document.getElementById('serial-input').value = ret.data.text.trim();
        showSection('manual');
        document.getElementById('ocr-status').innerText = "";

    } catch (err) {
        console.error(err);
        alert("OCR Failed. Please enter manually.");
        showSection('manual');
    }
}

// Manual Entry & Verify
const verifyBtn = document.getElementById('verify-btn');
if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
        const input = document.getElementById('serial-input').value;
        if (!input) return;
        state.serialRaw = input;

        await performVerification();
    });
}

async function performVerification() {
    const payload = {
        label_id: state.labelId,
        observed_serial_raw: state.serialRaw,
        actor_name: state.actorName,
        method: "MANUAL", // or OCR if came from there, simplified for now
        is_offline_event: !navigator.onLine,
        created_at: new Date().toISOString()
    };

    let result = null;

    if (navigator.onLine) {
        try {
            const resp = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            result = await resp.json();
        } catch (e) {
            // Fallback to offline logic
            result = await offlineVerify(payload);
        }
    } else {
        result = await offlineVerify(payload);
    }

    displayResult(result);
}

async function offlineVerify(payload) {
    // 1. Try to find label in IndexedDB
    const label = await db.getLabel(payload.label_id);
    let resultStatus = "FAIL";
    let message = "Offline: Label unknown";
    let expected = null;

    // Simple local normalization for comparison
    const normalize = (s) => s ? s.trim().replace(/\s+/g, ' ').toUpperCase() : "";
    const observedNorm = normalize(payload.observed_serial_raw);

    if (label) {
        expected = label.bound_serial_norm;
        if (expected === observedNorm) {
            resultStatus = "PASS";
            message = "Offline: Match confirmed";
        } else {
            resultStatus = "FAIL";
            message = `Offline: Mismatch. Expected ${expected}`;
        }
    } else {
        // Unknown label offline
        resultStatus = "WARN";
        message = "Offline: Label not in cache - Queued for server check";
    }

    // Queue event
    payload.result = resultStatus;
    payload.expected_serial_norm = expected;
    payload.observed_serial_norm = observedNorm;

    await db.queueEvent(payload);

    return {
        result: resultStatus,
        message: message,
        expected_serial: expected,
        observed_serial_norm: observedNorm
    };
}

function displayResult(data) {
    showSection('result');
    const el = document.getElementById('result-message');
    el.innerText = data.result;
    el.className = `result-scan status-${data.result.toLowerCase()}`;

    document.getElementById('result-details').innerText = data.message;
}

// Sync Logic
async function syncEvents() {
    const events = await db.getAllEvents();
    if (events.length === 0) return;

    console.log(`Syncing ${events.length} events...`);

    for (const event of events) {
        try {
            // We strip 'id' generated locally or keep it? 
            // Server ignores extras, but we should make sure format matches
            const { id, ...payload } = event; // remove local ID if server generates, or keep if server uses UUID

            await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Remove from queue on success
            await db.clearEvent(id);
        } catch (e) {
            console.error("Sync failed for event", id, e);
        }
    }
}

// Reset Flow
const resetBtn = document.getElementById('reset-btn');
if (resetBtn) resetBtn.addEventListener('click', () => location.reload()); // Simple reload for MVP

// Init call
document.addEventListener('DOMContentLoaded', init);
