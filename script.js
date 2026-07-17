// =====================================================
// REAL-TIME DATA SYNCHRONIZATION WITH LOCALSTORAGE & BROADCAST
// =====================================================

const ADMIN_PASSWORD = 'abhinav22456';
const STORAGE_KEY = 'abhinav_files_data';
const SETTINGS_KEY = 'abhinav_settings';

// Initialize data structure
let appData = {
    files: [],
    settings: {
        instagram: 'https://instagram.com',
        discord: 'https://discord.com'
    }
};

// Create a Broadcast Channel for real-time sync across tabs/windows
let broadcastChannel = null;
try {
    broadcastChannel = new BroadcastChannel('abhinav_tools_channel');
    broadcastChannel.onmessage = (event) => {
        console.log('Received broadcast:', event.data);
        if (event.data.type === 'FILE_UPDATE' || event.data.type === 'FILE_DELETE' || event.data.type === 'FILE_ADD') {
            appData = event.data.appData;
            saveToStorage();
            refreshCurrentView();
        }
        if (event.data.type === 'SETTINGS_UPDATE') {
            appData.settings = event.data.settings;
            saveToStorage();
            updateSettingsUI();
        }
    };
} catch (e) {
    console.log('BroadcastChannel not supported, using localStorage only');
}

// Listen for storage changes from other tabs
window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
        appData = JSON.parse(event.newValue || JSON.stringify({ files: [], settings: appData.settings }));
        refreshCurrentView();
    }
    if (event.key === SETTINGS_KEY) {
        appData.settings = JSON.parse(event.newValue || JSON.stringify(appData.settings));
        updateSettingsUI();
    }
});

// =====================================================
// LOAD & SAVE DATA
// =====================================================

function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    
    if (stored) {
        appData.files = JSON.parse(stored);
    }
    if (storedSettings) {
        appData.settings = JSON.parse(storedSettings);
    }
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData.files));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appData.settings));
}

function broadcastUpdate(type, payload = {}) {
    if (broadcastChannel) {
        broadcastChannel.postMessage({
            type: type,
            appData: appData,
            timestamp: new Date().toISOString(),
            ...payload
        });
    }
    // Also emit custom event for same-page listeners
    window.dispatchEvent(new CustomEvent('dataUpdate', { detail: { type, payload } }));
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
    broadcastUpdate('FILE_ADD', { file: newFile });
    
    // Reset form
    document.getElementById('uploadForm').reset();
    alert('✅ File uploaded successfully! It\'s now visible to all users.');
    
    // Refresh display
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
    broadcastUpdate('FILE_UPDATE', { file: file });
    
    closeFileModal();
    displayAdminFiles();
    alert('✅ File updated successfully! Changes are now visible to all users.');
}

function deleteAdminFile(fileId) {
    if (confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
        appData.files = appData.files.filter(f => f.id !== fileId);
        saveToStorage();
        broadcastUpdate('FILE_DELETE', { fileId: fileId });
        
        displayAdminFiles();
        displayUserFiles();
        alert('✅ File deleted successfully! Changes are now visible to all users.');
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
    broadcastUpdate('SETTINGS_UPDATE', { settings: appData.settings });
    
    alert('✅ Settings updated successfully! Links are now updated for all users.');
    updateSocialLinks();
}

function updateSettingsUI() {
    document.getElementById('instagramLink').value = appData.settings.instagram || 'https://instagram.com';
    document.getElementById('discordLink').value = appData.settings.discord || 'https://discord.com';
}

// =====================================================
// USER DASHBOARD - FILE DISPLAY
// =====================================================

function displayUserFiles(filterCategory = '', searchTerm = '') {
    const container = document.getElementById('filesContainer');
    const noFilesMsg = document.getElementById('noFiles');
    
    loadFromStorage();
    
    let filteredFiles = appData.files;
    
    // Apply category filter
    if (filterCategory) {
        filteredFiles = filteredFiles.filter(f => f.category === filterCategory);
    }
    
    // Apply search filter
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
    
    // Update landing page links
    const landingSocial = document.querySelectorAll('.social-links-landing a');
    if (landingSocial.length > 0) {
        landingSocial[0].href = appData.settings.instagram;
        landingSocial[1].href = appData.settings.discord;
    }
    
    // Update user footer links
    const userFooterLinks = document.querySelectorAll('.user-footer .social-link');
    if (userFooterLinks.length > 0) {
        userFooterLinks[0].href = appData.settings.instagram;
        userFooterLinks[1].href = appData.settings.discord;
    }
}

// =====================================================
// REFRESH CURRENT VIEW BASED ON ACTIVE PAGE
// =====================================================

function refreshCurrentView() {
    const activePage = document.querySelector('.page.active');
    
    if (!activePage) return;
    
    if (activePage.id === 'userDashboard') {
        const searchTerm = document.getElementById('searchInput').value;
        const categoryFilter = document.getElementById('categoryFilter').value;
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
// INITIALIZE APP ON PAGE LOAD
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    updateSocialLinks();
    
    // Close modal when clicking outside
    document.getElementById('fileModal').addEventListener('click', function(event) {
        if (event.target === this) {
            closeFileModal();
        }
    });
    
    // Listen for data updates from other tabs
    window.addEventListener('dataUpdate', (event) => {
        console.log('Data updated:', event.detail);
        refreshCurrentView();
    });
});

// Periodic sync from localStorage (every 2 seconds)
setInterval(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        const newData = JSON.parse(stored);
        // Check if data changed
        if (JSON.stringify(newData) !== JSON.stringify(appData.files)) {
            appData.files = newData;
            refreshCurrentView();
        }
    }
}, 2000);
