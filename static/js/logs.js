import db from './db.js';

// If offline, read DB. If online, fetch from API.

const list = document.getElementById('logs-list');
const refreshBtn = document.getElementById('refresh-btn');

async function loadLogs() {
    list.innerHTML = '<p style="text-align: center;">Loading...</p>';

    let events = [];
    const employeeCode = localStorage.getItem('employeeCode');

    if (navigator.onLine) {
        try {
            const res = await fetch('/api/events', {
                headers: {
                    'X-Employee-Code': employeeCode || ''
                }
            });

            if (res.status === 403) {
                list.innerHTML = '<p style="text-align: center; color: red;">Access Denied.<br>You do not have permission to view logs.</p>';
                return;
            }

            if (res.ok) {
                events = await res.json();
            }
        } catch (e) { console.error(e); }
    } else {
        // Offline check - maybe just show local if authorized? 
        // For simplicity, we might warn we can't verify auth offline easily 
        // without storing permissions locally. 
        // Let's just show local events if we think we are kimhai?
        // Or just show "Connect to internet to verify access".
        // Requirement "Chỉ có ... mới được xem". Securest is to block offline if we can't verify.
        // But for MVP let's Check localStorage.
        if (employeeCode !== 'kimhai1234') {
            list.innerHTML = '<p style="text-align: center; color: red;">Offline Access Denied.<br>Only authorized staff can view history.</p>';
            return;
        }
    }

    // Also include local queue if any
    await db.init();
    const queued = await db.getAllEvents();

    renderLogs(events, queued);
}

function renderLogs(serverEvents, localEvents) {
    list.innerHTML = '';

    if (localEvents.length > 0) {
        const queueDiv = document.createElement('div');
        queueDiv.style.padding = '1rem';
        queueDiv.style.marginBottom = '1rem';
        queueDiv.style.backgroundColor = '#fff7ed';
        queueDiv.style.border = '1px solid #fdba74';
        queueDiv.style.borderRadius = 'var(--radius)';
        queueDiv.innerHTML = `<strong>${localEvents.length} Pending Events</strong> waiting to sync.`;
        list.appendChild(queueDiv);
    }

    if (serverEvents.length === 0) {
        list.innerHTML += '<p style="text-align: center;">No registered events found.</p>';
        return;
    }

    serverEvents.forEach(evt => {
        const el = document.createElement('div');
        el.className = 'card';
        el.style.marginBottom = '0.5rem';
        el.style.padding = '1rem';

        const date = new Date(evt.created_at).toLocaleString();
        const statusColor = evt.result === 'PASS' ? 'green' : (evt.result === 'FAIL' ? 'red' : 'orange');

        el.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <strong>${evt.label_id || 'Unknown Label'}</strong>
                <span style="color: ${statusColor}; font-weight: bold;">${evt.result}</span>
            </div>
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">
                Employee: <strong>${evt.employee_name || 'Unknown'}</strong> (${evt.employee_code || 'N/A'}) <br>
                Date: ${date}
            </div>
        `;
        list.appendChild(el);
    });
}

refreshBtn.addEventListener('click', loadLogs);
document.addEventListener('DOMContentLoaded', loadLogs);
