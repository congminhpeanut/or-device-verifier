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

els.authBtn.addEventListener('click', async () => {
    const val = els.pinInput.value;
    if (val) {

        // Verify PIN by making a lightweight API call
        // Using /api/devices just to check auth headers response
        try {
            const res = await fetch('/api/admin/verify', {
                method: 'GET',
                headers: { 'X-Admin-Pin': val }
            });

            if (res.ok) {
                pin = val;
                els.authSection.classList.add('hidden');
                els.adminPanel.classList.remove('hidden');
            } else {
                alert("Mã PIN quản trị không đúng!");
                pin = null;
            }
        } catch (e) {
            console.error(e);
            alert("Lỗi kết nối kiểm tra PIN");
        }
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

// Secure QR Generator
const qrEls = {
    input: document.getElementById('secure-qr-link'),
    btn: document.getElementById('gen-qr-btn'),
    container: document.getElementById('qr-result-container'),
    display: document.getElementById('qr-code-display'),
    download: document.getElementById('download-qr-btn')
};

qrEls.btn.addEventListener('click', () => {
    const originalLink = qrEls.input.value;
    if (!originalLink) return alert("Vui lòng nhập link gốc");

    // Construct deep link
    const deepLink = `https://or-device-verifier.onrender.com/?target=${encodeURIComponent(originalLink)}`;

    // Clear previous
    qrEls.display.innerHTML = '';
    qrEls.container.classList.remove('hidden');

    // Generate
    new QRCode(qrEls.display, {
        text: deepLink,
        width: 256,
        height: 256
    });

    // Handle download (wait for canvas/img to be generated)
    setTimeout(() => {
        const img = qrEls.display.querySelector('img');
        if (img) {
            qrEls.download.href = img.src;
        } else {
            // If it rendered as canvas
            const canvas = qrEls.display.querySelector('canvas');
            if (canvas) {
                qrEls.download.href = canvas.toDataURL("image/png");
            }
        }
    }, 500);
});
