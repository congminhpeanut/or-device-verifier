import db from './db.js';

// If offline, read DB. If online, fetch from API.

const list = document.getElementById('logs-list');
const refreshBtn = document.getElementById('refresh-btn');

async function loadLogs() {
    list.innerHTML = '<p style="text-align: center;">Loading...</p>';

    let events = [];

    if (navigator.onLine) {
        try {
            const res = await fetch('/api/events');
            if (res.ok) {
                events = await res.json();
            }
        } catch (e) { console.error(e); }
    }

    // Also include local queue if any
    await db.init();
    const queued = await db.getAllEvents();

    // Merge? Just show them separately or combined
    // Let's just render the API list for now, and maybe append queued warning

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
                Observed: ${evt.observed_serial_norm} <br>
                By: ${evt.actor_name} at ${date}
            </div>
        `;
        list.appendChild(el);
    });
}

refreshBtn.addEventListener('click', loadLogs);
document.addEventListener('DOMContentLoaded', loadLogs);
