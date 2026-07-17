/**
 * REAL-TIME DATA SYNC MODULE
 * Syncs data between different devices and browsers without backend
 * Uses WebRTC + Peer-to-Peer or LocalStorage + Polling
 */

class DataSync {
    constructor() {
        this.peers = [];
        this.data = new Map();
        this.listeners = new Set();
        this.useWebRTC = this.checkWebRTCSupport();
        this.useIndexedDB = this.checkIndexedDBSupport();
        
        if (!this.useWebRTC) {
            // Fallback to LocalStorage + BroadcastChannel
            this.initBroadcastChannel();
            this.initStorageListener();
            this.startPolling();
        }
        
        this.initIndexedDB();
    }

    /**
     * Check if WebRTC is supported
     */
    checkWebRTCSupport() {
        return !!(
            navigator.mediaDevices &&
            (window.RTCPeerConnection ||
                window.webkitRTCPeerConnection ||
                window.mozRTCPeerConnection)
        );
    }

    /**
     * Check if IndexedDB is supported
     */
    checkIndexedDBSupport() {
        return !!window.indexedDB;
    }

    /**
     * Initialize IndexedDB for persistent storage
     */
    async initIndexedDB() {
        if (!this.useIndexedDB) return;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open('ABhinav-Tools', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', { keyPath: 'timestamp' });
                }
            };
        });
    }

    /**
     * Initialize BroadcastChannel for same-origin communication
     */
    initBroadcastChannel() {
        try {
            this.channel = new BroadcastChannel('abhinav-tools-sync');
            this.channel.onmessage = (event) => {
                this.handleBroadcastMessage(event.data);
            };
        } catch (e) {
            console.warn('BroadcastChannel not supported, using polling');
        }
    }

    /**
     * Handle messages from BroadcastChannel
     */
    handleBroadcastMessage(data) {
        if (data.type === 'UPLOAD') {
            this.setData(data.key, data.value, data.timestamp);
            this.notifyListeners(data.key, data.value, 'broadcast');
        } else if (data.type === 'DELETE') {
            this.deleteData(data.key);
            this.notifyListeners(data.key, null, 'delete');
        }
    }

    /**
     * Initialize storage listener for cross-tab communication
     */
    initStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith('abhinav-')) {
                try {
                    const data = JSON.parse(event.newValue);
                    const key = event.key.replace('abhinav-', '');
                    this.setData(key, data.value, data.timestamp);
                    this.notifyListeners(key, data.value, 'storage');
                } catch (e) {
                    console.error('Error parsing storage event:', e);
                }
            }
        });
    }

    /**
     * Start polling for updates (fallback)
     */
    startPolling() {
        this.pollingInterval = setInterval(() => {
            this.checkForUpdates();
        }, 2000); // Poll every 2 seconds
    }

    /**
     * Check for updates in storage
     */
    checkForUpdates() {
        const keys = Object.keys(localStorage);
        keys.forEach((key) => {
            if (key.startsWith('abhinav-')) {
                const storedKey = key.replace('abhinav-', '');
                if (!this.data.has(storedKey)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        this.setData(storedKey, data.value, data.timestamp);
                    } catch (e) {
                        console.error('Error reading from storage:', e);
                    }
                }
            }
        });
    }

    /**
     * Set data and sync across devices
     */
    async setData(key, value, timestamp = Date.now()) {
        this.data.set(key, { value, timestamp });

        // Save to localStorage
        try {
            localStorage.setItem(
                `abhinav-${key}`,
                JSON.stringify({ value, timestamp })
            );
        } catch (e) {
            console.warn('localStorage quota exceeded:', e);
        }

        // Save to IndexedDB
        if (this.useIndexedDB && this.dbPromise) {
            await this.saveToIndexedDB(key, value, timestamp);
        }

        // Broadcast to other tabs/windows
        if (this.channel) {
            this.channel.postMessage({
                type: 'UPLOAD',
                key,
                value,
                timestamp,
            });
        }

        // Queue for WebRTC sync if available
        if (this.useWebRTC) {
            this.broadcastToPeers({ type: 'UPLOAD', key, value, timestamp });
        }
    }

    /**
     * Save data to IndexedDB
     */
    async saveToIndexedDB(key, value, timestamp) {
        try {
            const db = await this.dbPromise;
            const transaction = db.transaction(['files'], 'readwrite');
            const objectStore = transaction.objectStore('files');
            await new Promise((resolve, reject) => {
                const request = objectStore.put({
                    id: key,
                    value,
                    timestamp,
                });
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        } catch (e) {
            console.error('IndexedDB save error:', e);
        }
    }

    /**
     * Get data
     */
    getData(key) {
        return this.data.get(key);
    }

    /**
     * Get all data
     */
    getAllData() {
        return Object.fromEntries(this.data);
    }

    /**
     * Delete data
     */
    async deleteData(key) {
        this.data.delete(key);

        // Remove from localStorage
        localStorage.removeItem(`abhinav-${key}`);

        // Remove from IndexedDB
        if (this.useIndexedDB && this.dbPromise) {
            try {
                const db = await this.dbPromise;
                const transaction = db.transaction(['files'], 'readwrite');
                const objectStore = transaction.objectStore('files');
                await new Promise((resolve, reject) => {
                    const request = objectStore.delete(key);
                    request.onsuccess = resolve;
                    request.onerror = reject;
                });
            } catch (e) {
                console.error('IndexedDB delete error:', e);
            }
        }

        // Broadcast deletion
        if (this.channel) {
            this.channel.postMessage({ type: 'DELETE', key });
        }
    }

    /**
     * Listen for data changes
     */
    onChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of changes
     */
    notifyListeners(key, value, source) {
        this.listeners.forEach((callback) => {
            try {
                callback({ key, value, source, timestamp: Date.now() });
            } catch (e) {
                console.error('Listener error:', e);
            }
        });
    }

    /**
     * Broadcast message to all peers (WebRTC)
     */
    broadcastToPeers(message) {
        this.peers.forEach((peer) => {
            if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
                peer.dataChannel.send(JSON.stringify(message));
            }
        });
    }

    /**
     * Load data from IndexedDB on startup
     */
    async loadFromIndexedDB() {
        if (!this.useIndexedDB || !this.dbPromise) return;

        try {
            const db = await this.dbPromise;
            const transaction = db.transaction(['files'], 'readonly');
            const objectStore = transaction.objectStore('files');

            return new Promise((resolve, reject) => {
                const request = objectStore.getAll();
                request.onsuccess = () => {
                    request.result.forEach((item) => {
                        this.data.set(item.id, {
                            value: item.value,
                            timestamp: item.timestamp,
                        });
                    });
                    resolve();
                };
                request.onerror = reject;
            });
        } catch (e) {
            console.error('IndexedDB load error:', e);
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        if (this.channel) {
            this.channel.close();
        }
        this.listeners.clear();
        this.peers = [];
    }
}

// Export as global
window.DataSync = DataSync;

/**
 * SIMPLE PEER-TO-PEER SYNC (WebRTC Alternative)
 * For offline mesh network sync
 */
class PeerSync {
    constructor() {
        this.localPeerId = this.generatePeerId();
        this.peers = new Map();
        this.messages = [];
        this.syncInterval = 5000; // Sync every 5 seconds
    }

    generatePeerId() {
        return `peer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate QR code for peer discovery
     */
    generateQRCode() {
        const data = {
            peerId: this.localPeerId,
            timestamp: Date.now(),
            sync: true,
        };
        return btoa(JSON.stringify(data));
    }

    /**
     * Add peer from QR code
     */
    addPeerFromQR(qrData) {
        try {
            const data = JSON.parse(atob(qrData));
            this.peers.set(data.peerId, {
                id: data.peerId,
                lastSeen: Date.now(),
                status: 'connected',
            });
            return true;
        } catch (e) {
            console.error('Invalid QR code:', e);
            return false;
        }
    }

    /**
     * Share data via QR code (manual sync)
     */
    shareAsQRCode(data) {
        const payload = {
            peerId: this.localPeerId,
            data,
            timestamp: Date.now(),
        };
        return btoa(JSON.stringify(payload));
    }

    /**
     * Import data from QR code
     */
    importFromQRCode(qrData) {
        try {
            const payload = JSON.parse(atob(qrData));
            return payload.data;
        } catch (e) {
            console.error('Invalid QR import:', e);
            return null;
        }
    }
}

// Export as global
window.PeerSync = PeerSync;

/**
 * LOCAL STORAGE SYNC MANAGER
 * Simple implementation using localStorage with timestamps
 */
class StorageSyncManager {
    constructor(namespace = 'abhinav-tools') {
        this.namespace = namespace;
        this.syncKey = `${namespace}-sync-timestamp`;
        this.lastSync = parseInt(localStorage.getItem(this.syncKey)) || 0;
    }

    /**
     * Save file with metadata
     */
    saveFile(fileName, fileData, metadata = {}) {
        const fileRecord = {
            name: fileName,
            data: fileData,
            timestamp: Date.now(),
            size: new Blob([fileData]).size,
            ...metadata,
        };

        localStorage.setItem(
            `${this.namespace}-file-${fileName}`,
            JSON.stringify(fileRecord)
        );

        this.updateSyncTimestamp();
        return fileRecord;
    }

    /**
     * Get file
     */
    getFile(fileName) {
        const data = localStorage.getItem(`${this.namespace}-file-${fileName}`);
        return data ? JSON.parse(data) : null;
    }

    /**
     * List all files
     */
    listFiles() {
        const files = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(`${this.namespace}-file-`)) {
                const fileName = key.replace(`${this.namespace}-file-`, '');
                const file = this.getFile(fileName);
                if (file) files.push(file);
            }
        }
        return files.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Delete file
     */
    deleteFile(fileName) {
        localStorage.removeItem(`${this.namespace}-file-${fileName}`);
        this.updateSyncTimestamp();
    }

    /**
     * Update sync timestamp
     */
    updateSyncTimestamp() {
        localStorage.setItem(this.syncKey, String(Date.now()));
        this.lastSync = Date.now();
    }

    /**
     * Get files modified since last sync
     */
    getChanges() {
        const files = this.listFiles();
        return files.filter((file) => file.timestamp > this.lastSync);
    }

    /**
     * Clear all data
     */
    clearAll() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.namespace)) {
                keys.push(key);
            }
        }
        keys.forEach((key) => localStorage.removeItem(key));
        this.updateSyncTimestamp();
    }

    /**
     * Export as JSON (for backup/share)
     */
    exportAsJSON() {
        return JSON.stringify({
            namespace: this.namespace,
            timestamp: Date.now(),
            files: this.listFiles(),
        });
    }

    /**
     * Import from JSON
     */
    importFromJSON(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (!Array.isArray(data.files)) return false;

            data.files.forEach((file) => {
                this.saveFile(file.name, file.data, {
                    timestamp: file.timestamp,
                    size: file.size,
                });
            });
            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }
}

// Export as global
window.StorageSyncManager = StorageSyncManager;

// Initialize default sync manager
window.syncManager = new DataSync();
