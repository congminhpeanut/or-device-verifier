import db from './db.js';

// DOM Elements
const sections = {
    login: document.getElementById('login-section'),
    changePassword: document.getElementById('change-password-section'),
    scan: document.getElementById('scan-section'),
    result: document.getElementById('result-section')
};

// State
let state = {
    labelId: null,
    employeeCode: localStorage.getItem('employeeCode') || null,
    employeeName: localStorage.getItem('employeeName') || null,
    // We can keep actorName as alias if needed, or remove
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

    // Auth Check
    if (state.employeeCode) {
        showUser(state.employeeName);
        showSection('scan');
        setupScanner();
    } else {
        showSection('login');
    }

    setupEventListeners();
}

function setupEventListeners() {
    // Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);

    // Change Password
    document.getElementById('change-pass-btn').addEventListener('click', handleChangePassword);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Reset / Continue
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        showSection('scan');
        setupScanner();
    });
}

function showUser(name) {
    const el = document.getElementById('user-info');
    el.style.display = 'inline-block';
    el.innerText = `Hi, ${name}`;
    document.getElementById('logout-btn').style.display = 'inline-block';
}

function handleLogout() {
    localStorage.removeItem('employeeCode');
    localStorage.removeItem('employeeName');
    state.employeeCode = null;
    state.employeeName = null;
    location.reload();
}

async function handleLogin() {
    const code = document.getElementById('employee-code').value.trim();
    const pass = document.getElementById('employee-password').value.trim();

    if (!code || !pass) {
        alert("Vui lòng nhập mã nhân viên và mật khẩu");
        return;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_code: code, password: pass })
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Đăng nhập thất bại");
            return;
        }

        const data = await res.json();

        // Save State
        state.employeeCode = data.employee_code;
        state.employeeName = data.full_name;

        // Don't persist if forced to change pass immediately? 
        // Actually we can persist, but UI will force change.
        localStorage.setItem('employeeCode', data.employee_code);
        localStorage.setItem('employeeName', data.full_name);

        if (data.is_first_login) {
            showSection('changePassword');
        } else {
            showUser(data.full_name);
            showSection('scan');
            setupScanner();
        }

    } catch (e) {
        alert("Lỗi kết nối: " + e.message);
    }
}

async function handleChangePassword() {
    const newPass = document.getElementById('new-password').value.trim();
    const confirmPass = document.getElementById('confirm-password').value.trim();
    const currentPass = document.getElementById('employee-password').value.trim(); // Use the one they just logged in with

    if (!newPass || !confirmPass) {
        alert("Vui lòng nhập mật khẩu mới");
        return;
    }
    if (newPass !== confirmPass) {
        alert("Mật khẩu xác nhận không khớp");
        return;
    }

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_code: state.employeeCode,
                old_password: currentPass,
                new_password: newPass
            })
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Đổi mật khẩu thất bại");
            return;
        }

        alert("Đổi mật khẩu thành công! Vui lòng tiếp tục.");
        showUser(state.employeeName);
        showSection('scan');
        setupScanner();

    } catch (e) {
        alert("Lỗi: " + e.message);
    }
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
    // Only setup if scan section is visible/active
    if (sections.scan && !sections.scan.classList.contains('hidden')) {
        // Clear old if exists
        if (html5QrcodeScanner) {
            try { html5QrcodeScanner.clear(); } catch (e) { }
        }

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
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
    }

    // DIRECTLY VERIFY (No Serial Check)
    await performVerification();
}

function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
}

async function performVerification() {
    const payload = {
        label_id: state.labelId,
        employee_code: state.employeeCode,
        method: "SCAN",
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

    // In new flow, we just check if label exists.
    if (label) {
        resultStatus = "PASS";
        message = "Offline: Verification Successful (Label Found in Cache)";
    } else {
        resultStatus = "WARN";
        message = "Offline: Label not in cache - Queued for server check";
    }

    // Queue event
    payload.result = resultStatus;

    await db.queueEvent(payload);

    return {
        result: resultStatus,
        message: message,
    };
}

function displayResult(data) {
    showSection('result');
    const el = document.getElementById('result-message');
    el.innerText = data.result;
    el.className = `result-scan status-${data.result.toLowerCase()}`;

    document.getElementById('result-details').innerText = data.message;

    // Show link if PASS and is URL
    const linkContainer = document.getElementById('result-link-container');
    linkContainer.innerHTML = '';

    if (data.result === 'PASS' && isValidUrl(state.labelId)) {
        const link = document.createElement('a');
        link.href = state.labelId;
        link.target = '_blank';
        link.className = 'btn btn-primary';
        link.style.backgroundColor = '#10b981'; // Green to match success
        link.style.display = 'inline-block';
        link.style.marginTop = '10px';
        link.innerText = 'Truy cập liên kết';
        linkContainer.appendChild(link);
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Sync Logic
async function syncEvents() {
    const events = await db.getAllEvents();
    if (events.length === 0) return;

    console.log(`Syncing ${events.length} events...`);

    for (const event of events) {
        try {
            const { id, ...payload } = event;

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

// Init call
document.addEventListener('DOMContentLoaded', init);
