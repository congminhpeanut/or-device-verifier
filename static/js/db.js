const DB_NAME = 'HospitalVerifyDB';
const DB_VERSION = 1;

class DB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Database error: " + event.target.errorCode);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Cached labels for offline verification
                if (!db.objectStoreNames.contains('labels')) {
                    db.createObjectStore('labels', { keyPath: 'label_id' });
                }
                // Queued events for offline logging
                if (!db.objectStoreNames.contains('events')) {
                    db.createObjectStore('events', { keyPath: 'id' }); // Use auto-gen UUID
                }
            };
        });
    }

    async getLabel(labelId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['labels'], 'readonly');
            const store = transaction.objectStore('labels');
            const request = store.get(labelId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveLabel(label) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['labels'], 'readwrite');
            const store = transaction.objectStore('labels');
            const request = store.put(label);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async queueEvent(eventData) {
        return new Promise((resolve, reject) => {
            // Add a UUID if not present
            if (!eventData.id) {
                eventData.id = crypto.randomUUID();
            }
            const transaction = this.db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');
            const request = store.add(eventData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllEvents() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearEvent(eventId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');
            const request = store.delete(eventId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

const db = new DB();
export default db;
