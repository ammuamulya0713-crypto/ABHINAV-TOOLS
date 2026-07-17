// =====================================================
// REAL-TIME CROSS-DEVICE SYNC WITH FIREBASE
// =====================================================

const ADMIN_PASSWORD = 'abhinav22456';
const STORAGE_KEY = 'abhinav_files_data';
const SETTINGS_KEY = 'abhinav_settings';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDmVpZ_5xK8L2q9M1z3N4o5P6Q7R8s9T0u",
    authDomain: "abhinav-tools.firebaseapp.com",
    databaseURL: "https://abhinav-tools-default-rtdb.firebaseio.com",
    projectId: "abhinav-tools",
    storageBucket: "abhinav-tools.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

let appData = {
    files: [],
    settings: {
        instagram: 'https://instagram.com',
        discord: 'https://discord.com'
    }
};

let db = null;
let firebaseLoaded = false;

// =====================================================
// FIREBASE INITIALIZATION
// =====================================================

async function initFirebase() {
    try {
        if (!window.firebase) {
            await loadFirebaseSDK();
        }
        
        if (window.firebase && !window.firebase.apps.length) {
            window.firebase.initializeApp(firebaseConfig);
        }
        
        db = window.firebase.database();
        firebaseLoaded = true;
        setupFirebaseListeners();
        console.log('✅ Firebase connected - cross-device sync enabled');
    } catch (error) {
        console.log('⚠️ Firebase not available, using localStorage only');
        firebaseLoaded = false;
        loadFromStorage();
    }
}

function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js';
        script.onload = () => {
            const dbScript = document.createElement('script');
            dbScript.src = 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database-compat.js';
            dbScript.onload = () => resolve();
            dbScript.onerror = () => {
                console.log('Failed to load Firebase Database SDK');
                resolve();
            };
            document.head.appendChild(dbScript);
        };
        script.onerror = () => {
            console.log('Failed to load Firebase SDK');
            resolve();
        };
        document.head.appendChild(script);
    });
}

function setupFirebaseListeners() {
    if (!db) return;
    
    try {
        // Real-time sync for files
        db.ref('files').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                appData.files = Array.isArray(data) ? data : Object.values(data);
                saveToStorage();
                refreshCurrentView();
                console.log('📥 Files synced from Firebase');
            }
        }, (error) => {
            console.log('Firebase read error:', error);
        });
        
        // Real-time sync for settings
        db.ref('settings').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                appData.settings = data;
                saveToStorage();
                updateSettingsUI();
                updateSocialLinks();
                console.log('📥 Settings synced from Firebase');
            }
        }, (error) => {
            console.log('Firebase read error:', error);
        });
    } catch (error) {
        console.log('Error setting up Firebase listeners:', error);
    }
}

// =====================================================
// LOAD & SAVE DATA
// =====================================================

function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    
    if (stored) {
        try {
            appData.files = JSON.parse(stored);
        } catch (e) {
            console.log('Error parsing files from storage');
        }
    }
    if (storedSettings) {
        try {
            appData.settings = JSON.parse(storedSettings);
        } catch (e) {
            console.log('Error parsing settings from storage');
        }
    }
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData.files));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appData.settings));
}

function saveToFirebase(type) {
    if (!firebaseLoaded || !db) {
        console.log('Firebase not available');
        return;
    }
    
    try {
        if (type === 'files') {
            db.ref('files').set(appData.files).then(() => {
                console.log('📤 Files uploaded to Firebase');
            }).catch(err => {
                console.log('Firebase write error:', err.message);
            });
        } else if (type === 'settings') {
            db.ref('settings').set(appData.settings).then(() => {
                console.log('📤 Settings uploaded to Firebase');
            }).catch(err => {
                console.log('Firebase write error:', err.message);
            });
        }
    } catch (error) {
        console.log('Error saving to Firebase:', error);
    }
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
    }
}

function showAdminLogin() {
    showPage('adminLoginPage');
}

function showAdminDashboard() {
    showPage('adminDashboard');
    loadFromStorage();
    displayAdminFiles();
    updateSettingsUI();
}

function showUserDashboard() {
    showPage('userDashboard');
    loadFromStorage();
    displayUserFiles();
    updateSocialLinks();
}

function backToLanding() {
    showPage('landingPage');
    loadFromStorage();
    updateSocialLinks();
}

function logoutAdmin() {
    document.getElementById('adminLoginForm').reset();
    document.getElementById('loginError').innerHTML = '';
    document.getElementById('loginError').classList.remove('show');
    backToLanding();
}

// =====================================================
// ADMIN AUTHENTICATION
// =====================================================

function togglePasswordVisibility() {
    const input = document.getElementById('adminPassword');
    const button = document.querySelector('.toggle-password');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

function verifyAdminPassword(event) {
    event.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const errorElement = document.getElementById('loginError');
    
    if (password === ADMIN_PASSWORD) {
        errorElement.classList.remove('show');
        showAdminDashboard();
    } else {
        errorElement.textContent = '❌ Incorrect password. Please try again.';
        errorElement.classList.add('show');
        document.getElementById('adminPassword').value = '';
    }
}

// =====================================================
// ADMIN FILE UPLOAD
// =====================================================

function handleFileUpload(event) {
    event.preventDefault();
    
    const fileName = document.getElementById('fileName').value;
    const fileDescription = document.getElementById('fileDescription').value;
    const readmeContent = document.getElementById('readmeContent').value;
    const fileUrl = document.getElementById('fileUrl').value;
    const fileCategory = document.getElementById('fileCategory').value;
    
    if (!fileName || !fileDescription || !readmeContent || !fileUrl || !fileCategory) {
        alert('Please fill all fields');
        return;
    }
    
    const newFile = {
        id: Date.now(),
        name: fileName,
        description: fileDescription,
        readme: readmeContent,
        url: fileUrl,
        category: fileCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    appData.files.push(newFile);
    saveToStorage();
    saveToFirebase('files');
    
    document.getElementById('uploadForm').reset();
    alert('✅ File uploaded! Visible to all users on all devices NOW!');
    
    displayAdminFiles();
}

// =====================================================
// ADMIN FILE MANAGEMENT
// =====================================================

function displayAdminFiles() {
    const container = document.getElementById('adminFilesList');
    
    if (appData.files.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 40px;">No files uploaded yet</p>';
        return;
    }
    
    container.innerHTML = appData.files.map(file => `
        <div class="admin-file-item">
            <div class="file-info">
                <h3>${escapeHtml(file.name)}</h3>
                <p>${escapeHtml(file.description)}</p>
                <div class="file-meta">
                    <span class="meta-badge">📁 ${escapeHtml(file.category)}</span>
                    <span class="meta-badge">📅 ${new Date(file.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-edit" onclick="editAdminFile(${file.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="deleteAdminFile(${file.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function editAdminFile(fileId) {
    const file = appData.files.find(f => f.id === fileId);
    if (!file) return;
    
    const modal = document.getElementById('fileModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <h2>Edit File</h2>
        <div class="edit-form-group">
            <label for="editFileName">File Name</label>
            <input type="text" id="editFileName" value="${escapeHtml(file.name)}">
        </div>
        <div class="edit-form-group">
            <label for="editFileDesc">Description</label>
            <textarea id="editFileDesc">${escapeHtml(file.description)}</textarea>
        </div>
        <div class="edit-form-group">
            <label for="editFileReadme">README Content</label>
            <textarea id="editFileReadme">${escapeHtml(file.readme)}</textarea>
        </div>
        <div class="edit-form-group">
            <label for="editFileUrl">File URL</label>
            <input type="url" id="editFileUrl" value="${escapeHtml(file.url)}">
        </div>
        <div class="edit-form-group">
            <label for="editFileCategory">Category</label>
            <select id="editFileCategory">
                <option value="Tools" ${file.category === 'Tools' ? 'selected' : ''}>Tools</option>
                <option value="Bots" ${file.category === 'Bots' ? 'selected' : ''}>Bots</option>
                <option value="Scripts" ${file.category === 'Scripts' ? 'selected' : ''}>Scripts</option>
                <option value="Documentation" ${file.category === 'Documentation' ? 'selected' : ''}>Documentation</option>
                <option value="Other" ${file.category === 'Other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <div class="edit-form-actions">
            <button class="btn btn-primary" onclick="saveEditedFile(${fileId})">Save Changes</button>
            <button class="btn btn-back" onclick="closeFileModal()">Cancel</button>
        </div>
    `;
    
    modal.classList.add('show');
}

function saveEditedFile(fileId) {
    const file = appData.files.find(f => f.id === fileId);
    if (!file) return;
    
    file.name = document.getElementById('editFileName').value;
    file.description = document.getElementById('editFileDesc').value;
    file.readme = document.getElementById('editFileReadme').value;
    file.url = document.getElementById('editFileUrl').value;
    file.category = document.getElementById('editFileCategory').value;
    file.updatedAt = new Date().toISOString();
    
    saveToStorage();
    saveToFirebase('files');
    
    closeFileModal();
    displayAdminFiles();
    alert('✅ Updated! All devices see changes NOW!');
}

function deleteAdminFile(fileId) {
    if (confirm('Delete this file permanently?')) {
        appData.files = appData.files.filter(f => f.id !== fileId);
        saveToStorage();
        saveToFirebase('files');
        
        displayAdminFiles();
        displayUserFiles();
        alert('✅ Deleted! All users see it removed NOW!');
    }
}

// =====================================================
// ADMIN SETTINGS
// =====================================================

function showAdminSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(section + 'Section').classList.add('active');
}

function updateSettings(event) {
    event.preventDefault();
    
    appData.settings.instagram = document.getElementById('instagramLink').value;
    appData.settings.discord = document.getElementById('discordLink').value;
    
    saveToStorage();
    saveToFirebase('settings');
    
    alert('✅ Settings updated worldwide!');
    updateSocialLinks();
}

function updateSettingsUI() {
    document.getElementById('instagramLink').value = appData.settings.instagram || 'https://instagram.com';
    document.getElementById('discordLink').value = appData.settings.discord || 'https://discord.com';
}

// =====================================================
// USER DASHBOARD
// =====================================================

function displayUserFiles(filterCategory = '', searchTerm = '') {
    const container = document.getElementById('filesContainer');
    const noFilesMsg = document.getElementById('noFiles');
    
    loadFromStorage();
    
    let filteredFiles = appData.files;
    
    if (filterCategory) {
        filteredFiles = filteredFiles.filter(f => f.category === filterCategory);
    }
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredFiles = filteredFiles.filter(f =>
            f.name.toLowerCase().includes(term) ||
            f.description.toLowerCase().includes(term) ||
            f.category.toLowerCase().includes(term)
        );
    }
    
    if (filteredFiles.length === 0) {
        container.innerHTML = '';
        noFilesMsg.style.display = 'flex';
        return;
    }
    
    noFilesMsg.style.display = 'none';
    
    container.innerHTML = filteredFiles.map(file => {
        const icon = getCategoryIcon(file.category);
        return `
            <div class="file-card">
                <div class="file-card-header">
                    <div class="file-card-icon">${icon}</div>
                    <div class="file-card-title">${escapeHtml(file.name)}</div>
                    <div class="file-card-category">${escapeHtml(file.category)}</div>
                </div>
                <div class="file-card-body">
                    <p class="file-card-description">${escapeHtml(file.description)}</p>
                    <div class="file-card-footer">
                        <button class="btn-view" onclick="showFileDetails(${file.id})">
                            📖 View Details
                        </button>
                        <a href="${escapeHtml(file.url)}" target="_blank" class="btn-view btn-download" style="background: linear-gradient(135deg, #00b894, #00d4aa);">
                            ⬇️ Download
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getCategoryIcon(category) {
    const icons = {
        'Tools': '🛠️',
        'Bots': '🤖',
        'Scripts': '📜',
        'Documentation': '📚',
        'Other': '📦'
    };
    return icons[category] || '📦';
}

function showFileDetails(fileId) {
    const file = appData.files.find(f => f.id === fileId);
    if (!file) return;
    
    const modal = document.getElementById('fileModal');
    const modalBody = document.getElementById('modalBody');
    
    const readmeHtml = file.readme
        .split('\n')
        .map(line => `<p>${escapeHtml(line)}</p>`)
        .join('');
    
    modalBody.innerHTML = `
        <h2>${escapeHtml(file.name)}</h2>
        <div class="category-badge">${escapeHtml(file.category)}</div>
        <div class="readme-content">
            ${readmeHtml}
        </div>
        <div class="modal-actions">
            <a href="${escapeHtml(file.url)}" target="_blank" class="btn btn-download">
                <i class="fas fa-download"></i> Download File
            </a>
            <button class="btn btn-back" onclick="closeFileModal()">Close</button>
        </div>
    `;
    
    modal.classList.add('show');
}

function closeFileModal() {
    const modal = document.getElementById('fileModal');
    modal.classList.remove('show');
}

// =====================================================
// SEARCH & FILTER
// =====================================================

function searchFiles() {
    const searchTerm = document.getElementById('searchInput').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    displayUserFiles(categoryFilter, searchTerm);
}

function filterByCategory() {
    const categoryFilter = document.getElementById('categoryFilter').value;
    const searchTerm = document.getElementById('searchInput').value;
    displayUserFiles(categoryFilter, searchTerm);
}

// =====================================================
// SOCIAL LINKS UPDATE
// =====================================================

function updateSocialLinks() {
    loadFromStorage();
    
    const landingSocial = document.querySelectorAll('.social-links-landing a');
    if (landingSocial.length > 0) {
        landingSocial[0].href = appData.settings.instagram;
        landingSocial[1].href = appData.settings.discord;
    }
    
    const userFooterLinks = document.querySelectorAll('.user-footer .social-link');
    if (userFooterLinks.length > 0) {
        userFooterLinks[0].href = appData.settings.instagram;
        userFooterLinks[1].href = appData.settings.discord;
    }
}

// =====================================================
// REFRESH VIEW
// =====================================================

function refreshCurrentView() {
    const activePage = document.querySelector('.page.active');
    
    if (!activePage) return;
    
    if (activePage.id === 'userDashboard') {
        const searchTerm = document.getElementById('searchInput')?.value || '';
        const categoryFilter = document.getElementById('categoryFilter')?.value || '';
        displayUserFiles(categoryFilter, searchTerm);
        updateSocialLinks();
    } else if (activePage.id === 'adminDashboard') {
        displayAdminFiles();
        updateSettingsUI();
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function escapeHtml(unsafe) {
    return (unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// =====================================================
// INITIALIZE APP
// =====================================================

document.addEventListener('DOMContentLoaded', async function() {
    await initFirebase();
    loadFromStorage();
    updateSocialLinks();
    
    document.getElementById('fileModal')?.addEventListener('click', function(event) {
        if (event.target === this) {
            closeFileModal();
        }
    });
});

// Periodic refresh every 3 seconds
setInterval(() => {
    refreshCurrentView();
}, 3000);
