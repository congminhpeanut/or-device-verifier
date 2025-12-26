// Basic Admin Logic

let pin = null;

const els = {
    authSection: document.getElementById('auth-section'),
    adminPanel: document.getElementById('admin-panel'),
    pinInput: document.getElementById('admin-pin'),
    authBtn: document.getElementById('auth-btn'),
    // Create
    newSerial: document.getElementById('new-device-serial'),
    newModel: document.getElementById('new-device-model'),
    createBtn: document.getElementById('create-device-btn'),
    // Bind
    bindLabelId: document.getElementById('bind-label-id'),
    bindSerial: document.getElementById('bind-device-serial'),
    bindBtn: document.getElementById('bind-btn'),
    scanBtn: document.getElementById('scan-label-btn'),
    reader: document.getElementById('admin-reader')
};

els.authBtn.addEventListener('click', () => {
    const val = els.pinInput.value;
    if (val) {
        // Simple client-side check implies "trust but verify on server"
        // But we actually just store it to send in headers
        pin = val;
        els.authSection.classList.add('hidden');
        els.adminPanel.classList.remove('hidden');
    }
});

// Helper for API calls
async function apiCall(endpoint, method, body) {
    try {
        const res = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Pin': pin
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Request failed");
        }
        return await res.json();
    } catch (e) {
        alert(e.message);
        return null;
    }
}

// Create Device
els.createBtn.addEventListener('click', async () => {
    if (!els.newSerial.value) return alert("Enter serial");

    const res = await apiCall('/api/devices', 'POST', {
        serial_raw: els.newSerial.value,
        model: els.newModel.value
    });

    if (res) {
        alert("Device created!");
        els.newSerial.value = "";
        els.newModel.value = "";
    }
});

// Bind Label
els.bindBtn.addEventListener('click', async () => {
    if (!els.bindLabelId.value || !els.bindSerial.value) return alert("Missing info");

    const res = await apiCall('/api/labels/bind', 'POST', {
        label_id: els.bindLabelId.value,
        serial_raw: els.bindSerial.value
    });

    if (res) {
        alert("Label Bound!");
        els.bindLabelId.value = "";
        els.bindSerial.value = "";
    }
});

// Scan Helper
let scanner = null;
els.scanBtn.addEventListener('click', () => {
    els.reader.classList.remove('hidden');
    scanner = new Html5QrcodeScanner("admin-reader", { fps: 10, qrbox: 250 });
    scanner.render((decodedText) => {
        els.bindLabelId.value = decodedText;
        scanner.clear();
        els.reader.classList.add('hidden');
    });
});
