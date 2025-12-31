import db from './db.js';

// If offline, read DB. If online, fetch from API.

const list = document.getElementById('logs-list');
const refreshBtn = document.getElementById('refresh-btn');

async function loadLogs() {
    list.innerHTML = '<p style="text-align: center;">Loading...</p>';

    const employeeCode = localStorage.getItem('employeeCode');

    if (!navigator.onLine) {
        list.innerHTML = '<p style="text-align: center; color: red;">Offline Access Denied.<br>Only authorized staff can view history (online only).</p>';
        return;
    }

    try {
        const res = await fetch('/api/history/grouped', {
            headers: {
                'X-Employee-Code': employeeCode || ''
            }
        });

        if (res.status === 403) {
            list.innerHTML = '<p style="text-align: center; color: red;">Access Denied.<br>You do not have permission to view logs.</p>';
            return;
        }

        if (res.ok) {
            const groups = await res.json();
            renderGroupedLogs(groups);
        } else {
            list.innerHTML = '<p style="text-align: center;">Failed to load logs.</p>';
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p style="text-align: center;">Connection Error.</p>';
    }
}

function renderGroupedLogs(groups) {
    list.innerHTML = '';

    if (groups.length === 0) {
        list.innerHTML = '<p style="text-align: center;">No history found.</p>';
        return;
    }

    groups.forEach(g => {
        // Group Item Container
        const item = document.createElement('div');
        item.className = 'group-item';

        // Header
        const header = document.createElement('header');
        header.className = 'group-header';
        // Display Device Name / Serial
        // Format: Model - Serial (or just Serial if Model missing)
        const title = g.device_model ? `<strong>${g.device_model}</strong> (${g.device_serial_raw})` : `<strong>${g.device_serial_raw || g.device_serial_norm}</strong>`;

        header.innerHTML = `
            <div>${title}</div>
            <div style="font-size: 0.8rem; color: #666;">${g.access_logs.length} lượt truy cập</div>
        `;

        // Logs Container
        const logsDiv = document.createElement('div');
        logsDiv.className = 'group-logs';

        // Render Logs
        g.access_logs.forEach(log => {
            const logEl = document.createElement('div');
            logEl.className = 'log-entry';

            const time = new Date(log.timestamp).toLocaleString('vi-VN');
            const emp = log.employee_name || log.employee_code || "Unknown";

            logEl.innerHTML = `
                <div>
                    <div>${emp}</div>
                    <div style="font-size: 0.75rem; color: #888;">${log.employee_code || ''}</div>
                </div>
                <div style="text-align: right;">
                    <div>${time}</div>
                    <div style="font-size: 0.75rem; color: ${log.result === 'PASS' ? 'green' : 'red'};">${log.result || ''}</div>
                </div>
            `;
            logsDiv.appendChild(logEl);
        });

        // Click Handler
        header.addEventListener('click', () => {
            logsDiv.classList.toggle('open');
        });

        item.appendChild(header);
        item.appendChild(logsDiv);
        list.appendChild(item);
    });
}

refreshBtn.addEventListener('click', loadLogs);
document.addEventListener('DOMContentLoaded', loadLogs);
