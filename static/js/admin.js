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
                loadMappings(); // Load mappings on login
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

// Mapping Management
async function loadMappings() {
    const tbody = document.getElementById('mapping-list-body');
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

    const data = await apiCall('/api/admin/mappings', 'GET');
    if (!data) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading data</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Chưa có liên kết nào</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');

        // Extract device info (it might be a list or object depending on Supabase join result)
        // With select=...,devices(*), devices is usually an object (if 1-to-1) or array?
        // Let's assume 1-to-1 and it returns an object or null since bound_serial_norm is FK.
        // PostgREST with standard relationship: devices: { ... }

        let model = "N/A";
        let serial = "N/A";

        if (item.devices) {
            // If multiple match (shouldn't be), take first
            const dev = Array.isArray(item.devices) ? item.devices[0] : item.devices;
            if (dev) {
                model = dev.model || "";
                serial = dev.serial_raw || "";
            }
        }

        tr.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.label_id}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${model}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${serial}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; background-color: #ef4444;" onclick="deleteMapping('${item.label_id}')">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteMapping = async (labelId) => {
    if (!confirm(`Bạn có chắc muốn xóa liên kết cho ${labelId}?`)) return;

    // Encoded component to parse correctly on backend
    const res = await apiCall(`/api/admin/mappings?label_id=${encodeURIComponent(labelId)}`, 'DELETE');
    if (res) {
        alert("Đã xóa liên kết");
        loadMappings();
    }
};

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
