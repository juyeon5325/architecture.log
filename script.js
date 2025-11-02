// ============================================================================
// IndexedDB Configuration and Utilities
// ============================================================================

const DB_NAME = 'ArchitectureLogDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

/**
 * Opens the IndexedDB database and returns a promise with the database instance
 * Creates the database and object store if they don't exist
 * @returns {Promise<IDBDatabase>} Promise that resolves with the database instance
 */
async function openDB() {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.warn('IndexedDB open failed:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        } catch (error) {
            console.warn('IndexedDB not supported or error:', error);
            reject(error);
        }
    });
}

/**
 * Saves an image file (Blob) to IndexedDB
 * Generates a unique ID for the image and stores it
 * @param {File} file - The image file to save
 * @returns {Promise<string>} Promise that resolves with the generated image ID
 */
async function saveImageBlob(file) {
    try {
        const db = await openDB();
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(file, imageId);

            request.onsuccess = () => {
                console.log('Image saved to IndexedDB:', imageId);
                resolve(imageId);
            };

            request.onerror = () => {
                console.warn('Failed to save image to IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.warn('Error saving image blob:', error);
        throw error;
    }
}

/**
 * Retrieves an image Blob from IndexedDB by its ID
 * @param {string} imageId - The ID of the image to retrieve
 * @returns {Promise<Blob>} Promise that resolves with the image Blob
 */
async function getImageBlob(imageId) {
    try {
        const db = await openDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(imageId);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                } else {
                    console.warn('Image not found in IndexedDB:', imageId);
                    reject(new Error('Image not found'));
                }
            };

            request.onerror = () => {
                console.warn('Failed to get image from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.warn('Error getting image blob:', error);
        throw error;
    }
}

/**
 * Deletes all image Blobs from IndexedDB
 * This clears the entire object store
 * @returns {Promise<void>} Promise that resolves when all images are deleted
 */
async function deleteAllImages() {
    try {
        const db = await openDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('All images cleared from IndexedDB');
                resolve();
            };

            request.onerror = () => {
                console.warn('Failed to clear images from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.warn('Error deleting all images:', error);
        throw error;
    }
}

// ============================================================================
// Data Migration - Move base64 images from LocalStorage to IndexedDB
// ============================================================================

/**
 * Migrates old base64 image data from LocalStorage to IndexedDB
 * Detects posts with base64 image strings and converts them to IndexedDB Blobs
 * Stores only the image ID in LocalStorage after migration
 * This function runs automatically on app initialization
 */
async function migrateOldData() {
    try {
        const posts = DataService.getPosts();
        let migrationCount = 0;
        
        for (const post of posts) {
            // Check if post has base64 image data (old format)
            if (post.images && Array.isArray(post.images)) {
                const newImageIds = [];
                
                for (let i = 0; i < post.images.length; i++) {
                    const imageData = post.images[i];
                    
                    // Check if it's a base64 string (starts with data:image)
                    if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
                        try {
                            // Convert base64 to Blob
                            const response = await fetch(imageData);
                            const blob = await response.blob();
                            
                            // Save blob to IndexedDB
                            const imageId = await saveImageBlob(blob);
                            newImageIds.push(imageId);
                            migrationCount++;
                            
                            console.log(`Migrated image ${i + 1} for post ${post.id}`);
                        } catch (error) {
                            console.warn(`Failed to migrate image ${i + 1} for post ${post.id}:`, error);
                            // Keep the base64 string if migration fails
                            newImageIds.push(imageData);
                        }
                    } else if (typeof imageData === 'string' && imageData.startsWith('img_')) {
                        // Already migrated (has image ID)
                        newImageIds.push(imageData);
                    } else {
                        // Unknown format, keep as is
                        newImageIds.push(imageData);
                    }
                }
                
                // Update post with new image IDs
                post.images = newImageIds;
            } else if (post.image && typeof post.image === 'string' && post.image.startsWith('data:image')) {
                // Handle single image (legacy format)
                try {
                    const response = await fetch(post.image);
                    const blob = await response.blob();
                    const imageId = await saveImageBlob(blob);
                    post.images = [imageId];
                    delete post.image; // Remove old property
                    migrationCount++;
                    
                    console.log(`Migrated single image for post ${post.id}`);
                } catch (error) {
                    console.warn(`Failed to migrate image for post ${post.id}:`, error);
                }
            }
        }
        
        if (migrationCount > 0) {
            // Save migrated posts back to LocalStorage
            localStorage.setItem('architecture_log_posts', JSON.stringify(posts));
            console.log(`Migration complete: ${migrationCount} images migrated to IndexedDB`);
        }
    } catch (error) {
        console.warn('Error during data migration:', error);
    }
}

// ============================================================================
// Image Display Utilities
// ============================================================================

// Cache for object URLs to prevent memory leaks
const imageUrlCache = new Map();

/**
 * Gets a display URL for an image ID
 * Creates an object URL from the Blob stored in IndexedDB
 * Caches the URL to prevent creating duplicate URLs
 * @param {string} imageId - The ID of the image to display
 * @returns {Promise<string>} Promise that resolves with the object URL
 */
async function getImageUrl(imageId) {
    // Check cache first
    if (imageUrlCache.has(imageId)) {
        return imageUrlCache.get(imageId);
    }
    
    try {
        // Handle legacy base64 strings (fallback)
        if (typeof imageId === 'string' && imageId.startsWith('data:image')) {
            return imageId;
        }
        
        // Get blob from IndexedDB
        const blob = await getImageBlob(imageId);
        const url = URL.createObjectURL(blob);
        
        // Cache the URL
        imageUrlCache.set(imageId, url);
        
        return url;
    } catch (error) {
        console.warn('Error getting image URL:', error);
        // Return placeholder or empty string
        return '';
    }
}

/**
 * Revokes an object URL and removes it from cache
 * Should be called when an image is no longer needed to free memory
 * @param {string} imageId - The ID of the image whose URL should be revoked
 */
function revokeImageUrl(imageId) {
    if (imageUrlCache.has(imageId)) {
        const url = imageUrlCache.get(imageId);
        URL.revokeObjectURL(url);
        imageUrlCache.delete(imageId);
    }
}

// ============================================================================
// Application State
// ============================================================================

let currentUser = null;
let currentTab = 'feed';

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the application
 * Sets up event listeners, loads user data, migrates old data, and renders the UI
 */
async function init() {
    // Run migration first
    await migrateOldData();
    
    // Load current user
    currentUser = DataService.getCurrentUser();
    
    // Setup event listeners
    setupEventListeners();
    
    // Render initial UI
    if (currentUser) {
        showApp();
        renderFeed();
        renderExplore();
        renderProfile();
    } else {
        showLoginModal();
    }
}

/**
 * Sets up all event listeners for the application
 * Handles tab navigation, form submissions, image uploads, and clear button
 */
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Tab navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUploadForm);
    }
    
    // Photo input
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoInput);
    }
    
    // Drop zone
    const dropZone = document.getElementById('uploadDropZone');
    if (dropZone) {
        setupDropZone(dropZone);
    }
    
    // Clear cached images button
    const clearBtn = document.getElementById('clearImagesBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClearImages);
    }
    
    // Modal close
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            document.getElementById('postModal').classList.add('hidden');
        });
    }
    
    // Search and filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', renderFeed);
    }
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderFeed);
    }
}

// ============================================================================
// UI State Management
// ============================================================================

/**
 * Shows the login modal and hides the main app
 */
function showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

/**
 * Shows the main app and hides the login modal
 */
function showApp() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    updateUserDisplay();
}

/**
 * Updates the username display in the navigation
 */
function updateUserDisplay() {
    if (currentUser) {
        const usernameEl = document.getElementById('currentUsername');
        const profileUsernameEl = document.getElementById('profileUsername');
        const profileBioEl = document.getElementById('profileBio');
        
        if (usernameEl) usernameEl.textContent = currentUser.username || 'User';
        if (profileUsernameEl) profileUsernameEl.textContent = currentUser.username || 'User';
        if (profileBioEl) profileBioEl.textContent = currentUser.bio || 'No bio';
    }
}

/**
 * Switches between tabs (Feed, Explore, Profile, Upload)
 * Updates the active tab styling and shows the corresponding content
 * @param {string} tabName - The name of the tab to switch to
 */
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Render appropriate content
    if (tabName === 'feed') {
        renderFeed();
    } else if (tabName === 'explore') {
        renderExplore();
    } else if (tabName === 'profile') {
        renderProfile();
    }
}

// ============================================================================
// Login Handler
// ============================================================================

/**
 * Handles the login form submission
 * Creates or updates the current user and shows the main app
 * @param {Event} e - The form submit event
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('usernameInput').value.trim();
    const bio = document.getElementById('bioInput').value.trim();
    
    if (!username) return;
    
    // Get or create user
    const users = DataService.getUsers();
    let user = users.find(u => u.username === username);
    
    if (!user) {
        user = {
            id: 'user_' + Date.now(),
            username: username,
            bio: bio || '',
            createdAt: new Date().toISOString()
        };
        DataService.saveUser(user);
    } else if (bio) {
        // Update bio if provided
        user.bio = bio;
        DataService.saveUser(user);
    }
    
    currentUser = user;
    DataService.setCurrentUser(user);
    
    showApp();
    renderFeed();
    renderExplore();
    renderProfile();
}

// ============================================================================
// Upload Form Handlers
// ============================================================================

let selectedFiles = [];

/**
 * Handles photo input change event
 * Stores selected files and updates the preview
 * @param {Event} e - The input change event
 */
function handlePhotoInput(e) {
    selectedFiles = Array.from(e.target.files);
    updatePhotoPreview();
}

/**
 * Sets up drag and drop functionality for the upload drop zone
 * Handles drag events and file drops
 * @param {HTMLElement} dropZone - The drop zone element
 */
function setupDropZone(dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type.startsWith('image/')
        );
        
        if (files.length > 0) {
            selectedFiles = [...selectedFiles, ...files];
            updatePhotoPreview();
        }
    });
    
    // Handle paste from clipboard
    document.addEventListener('paste', (e) => {
        if (currentTab === 'upload') {
            const items = Array.from(e.clipboardData.items);
            const imageFiles = items
                .filter(item => item.type.startsWith('image/'))
                .map(item => item.getAsFile());
            
            if (imageFiles.length > 0) {
                selectedFiles = [...selectedFiles, ...imageFiles];
                updatePhotoPreview();
            }
        }
    });
}

/**
 * Updates the photo preview display
 * Shows thumbnails of all selected images
 */
function updatePhotoPreview() {
    const preview = document.getElementById('photoPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        return;
    }
    
    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            img.style.margin = '8px';
            img.style.borderRadius = '8px';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Handles the upload form submission
 * Processes the form data, saves images to IndexedDB, and creates a new post
 * @param {Event} e - The form submit event
 */
async function handleUploadForm(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Please log in first');
        return;
    }
    
    try {
        // Get form values
        const buildingName = document.getElementById('buildingNameInput').value.trim();
        const category = document.getElementById('categoryInput').value;
        const location = document.getElementById('locationInput').value.trim();
        const date = document.getElementById('dateInput').value;
        const note = document.getElementById('noteInput').value.trim();
        const tagsInput = document.getElementById('tagsInput').value.trim();
        const emotionColor = document.getElementById('emotionColorInput').value;
        
        if (!buildingName || !date) {
            alert('Please fill in required fields');
            return;
        }
        
        // Process tags
        const tags = tagsInput
            ? tagsInput.split(',').map(t => t.trim()).filter(t => t)
            : [];
        
        // Save images to IndexedDB and get IDs
        const imageIds = [];
        for (const file of selectedFiles) {
            try {
                const imageId = await saveImageBlob(file);
                imageIds.push(imageId);
            } catch (error) {
                console.warn('Failed to save image:', error);
                // Continue with other images even if one fails
            }
        }
        
        // Create post object
        const post = {
            id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            userId: currentUser.id,
            username: currentUser.username,
            buildingName: buildingName,
            category: category,
            location: location,
            date: date,
            note: note,
            tags: tags,
            emotionColor: emotionColor,
            images: imageIds, // Store only image IDs, not base64
            likes: [],
            comments: [],
            createdAt: new Date().toISOString()
        };
        
        // Save to LocalStorage
        DataService.savePost(post);
        
        // Reset form
        document.getElementById('uploadForm').reset();
        selectedFiles = [];
        updatePhotoPreview();
        
        // Show success message
        alert('Post created successfully!');
        
        // Refresh displays
        renderFeed();
        renderExplore();
        renderProfile();
        
        // Switch to feed tab
        switchTab('feed');
        
    } catch (error) {
        console.warn('Error creating post:', error);
        alert('Failed to create post. Please try again.');
    }
}

// ============================================================================
// Clear Cached Images Handler
// ============================================================================

/**
 * Handles the clear cached images button click
 * Deletes all images from IndexedDB and shows a confirmation message
 */
async function handleClearImages() {
    if (!confirm('Are you sure you want to delete all cached images? This action cannot be undone. Your text data will be preserved.')) {
        return;
    }
    
    try {
        await deleteAllImages();
        
        // Revoke all cached object URLs
        imageUrlCache.forEach((url, imageId) => {
            URL.revokeObjectURL(url);
        });
        imageUrlCache.clear();
        
        alert('All cached images have been cleared successfully!');
    } catch (error) {
        console.warn('Error clearing images:', error);
        alert('Failed to clear images. Please try again.');
    }
}

// ============================================================================
// Feed Rendering
// ============================================================================

/**
 * Renders the feed tab with filtered and sorted posts
 * Loads images from IndexedDB and displays them using object URLs
 */
async function renderFeed() {
    const feedPosts = document.getElementById('feedPosts');
    if (!feedPosts) return;
    
    let posts = DataService.getPosts();
    
    // Apply filters
    const categoryFilter = document.getElementById('categoryFilter')?.value;
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase();
    
    if (categoryFilter) {
        posts = posts.filter(p => p.category === categoryFilter);
    }
    
    if (searchTerm) {
        posts = posts.filter(p => 
            p.buildingName.toLowerCase().includes(searchTerm) ||
            p.location?.toLowerCase().includes(searchTerm) ||
            p.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    }
    
    // Sort by date (newest first)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Render posts
    feedPosts.innerHTML = '';
    
    if (posts.length === 0) {
        feedPosts.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No posts found.</p>';
        return;
    }
    
    for (const post of posts) {
        const postCard = await createPostCard(post);
        feedPosts.appendChild(postCard);
    }
}

/**
 * Creates a post card element for display in the feed
 * Loads images from IndexedDB and creates object URLs for display
 * @param {Object} post - The post object
 * @returns {Promise<HTMLElement>} Promise that resolves with the post card element
 */
async function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // Load image URLs
    let imageHtml = '<div class="post-image-placeholder">🏛️</div>';
    if (post.images && post.images.length > 0) {
        try {
            const imageUrl = await getImageUrl(post.images[0]);
            if (imageUrl) {
                imageHtml = `<img src="${imageUrl}" alt="${post.buildingName}" class="post-image">`;
            }
        } catch (error) {
            console.warn('Error loading image for post:', post.id, error);
        }
    }
    
    const categoryClass = post.category ? `category-${post.category.toLowerCase().replace('건축', '')}` : '';
    const categoryHtml = post.category ? `<span class="post-category ${categoryClass}">${post.category}</span>` : '';
    
    const tagsHtml = post.tags && post.tags.length > 0
        ? `<div class="post-tags">${post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('')}</div>`
        : '';
    
    card.innerHTML = `
        ${imageHtml}
        <div class="post-content">
            ${categoryHtml}
            <h3 class="post-building-name">${post.buildingName}</h3>
            <div class="post-location">📍 ${post.location || 'Location not specified'}</div>
            <div class="post-date">📅 ${formatDate(post.date)}</div>
            ${post.note ? `<div class="post-note">${post.note}</div>` : ''}
            ${tagsHtml}
        </div>
        <div class="post-actions">
            <div class="post-author">
                <div class="post-author-avatar">👤</div>
                <div>
                    <div class="post-author-name">${post.username || 'Anonymous'}</div>
                    <div class="post-date">${formatDate(post.createdAt)}</div>
                </div>
            </div>
        </div>
    `;
    
    // Add click handler to view details
    card.addEventListener('click', () => viewPostDetails(post.id));
    
    return card;
}

/**
 * Formats a date string for display
 * @param {string} dateString - The date string to format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return 'Date not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// ============================================================================
// Explore Tab Rendering
// ============================================================================

/**
 * Renders the explore tab with a grid of all posts
 * Shows thumbnails of all posts
 */
async function renderExplore() {
    const exploreGrid = document.getElementById('exploreGrid');
    if (!exploreGrid) return;
    
    const posts = DataService.getPosts();
    
    exploreGrid.innerHTML = '';
    
    if (posts.length === 0) {
        exploreGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px; grid-column: 1 / -1;">No posts to explore.</p>';
        return;
    }
    
    for (const post of posts) {
        const card = document.createElement('div');
        card.className = 'explore-card';
        
        if (post.images && post.images.length > 0) {
            try {
                const imageUrl = await getImageUrl(post.images[0]);
                if (imageUrl) {
                    card.innerHTML = `<img src="${imageUrl}" alt="${post.buildingName}">`;
                } else {
                    card.innerHTML = '<div class="explore-card-placeholder">🏛️</div>';
                }
            } catch (error) {
                console.warn('Error loading image for explore card:', error);
                card.innerHTML = '<div class="explore-card-placeholder">🏛️</div>';
            }
    } else {
            card.innerHTML = '<div class="explore-card-placeholder">🏛️</div>';
        }
        
        card.addEventListener('click', () => viewPostDetails(post.id));
        exploreGrid.appendChild(card);
    }
}

// ============================================================================
// Profile Tab Rendering
// ============================================================================

/**
 * Renders the profile tab showing the current user's posts
 */
async function renderProfile() {
    if (!currentUser) return;
    
    const userPosts = document.getElementById('userPosts');
    if (!userPosts) return;
    
    updateUserDisplay();
    
    const posts = DataService.getUserPosts(currentUser.id);
    
    userPosts.innerHTML = '';
    
    if (posts.length === 0) {
        userPosts.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">You haven\'t created any posts yet.</p>';
        return;
    }
    
    for (const post of posts) {
        const postCard = await createPostCard(post);
        userPosts.appendChild(postCard);
    }
}

// ============================================================================
// Post Detail Modal
// ============================================================================

/**
 * Shows the post detail modal with full post information
 * Loads all images from IndexedDB for the post
 * @param {string} postId - The ID of the post to display
 */
async function viewPostDetails(postId) {
    const modal = document.getElementById('postModal');
    const modalContent = document.getElementById('postModalContent');
    
    if (!modal || !modalContent) return;
    
    const post = DataService.getPosts().find(p => p.id === postId);
    if (!post) return;
    
    // Load all images for the post
    let imagesHtml = '';
    if (post.images && post.images.length > 0) {
        for (const imageId of post.images) {
            try {
                const imageUrl = await getImageUrl(imageId);
                if (imageUrl) {
                    imagesHtml += `<img src="${imageUrl}" alt="${post.buildingName}" style="max-width: 100%; border-radius: 8px; margin-bottom: 16px;">`;
                }
            } catch (error) {
                console.warn('Error loading image:', error);
            }
        }
    }
    
    const categoryClass = post.category ? `category-${post.category.toLowerCase().replace('건축', '')}` : '';
    const categoryHtml = post.category ? `<span class="post-category ${categoryClass}">${post.category}</span>` : '';
    
    const tagsHtml = post.tags && post.tags.length > 0
        ? `<div class="post-tags">${post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('')}</div>`
        : '';
    
    modalContent.innerHTML = `
        <div class="post-detail">
            ${categoryHtml}
            <h2>${post.buildingName}</h2>
            <div style="margin-bottom: 16px;">
                <div><strong>📍 위치:</strong> ${post.location || 'Location not specified'}</div>
                <div><strong>📅 날짜:</strong> ${formatDate(post.date)}</div>
                <div><strong>👤 작성자:</strong> ${post.username || 'Anonymous'}</div>
            </div>
            ${imagesHtml}
            ${post.note ? `<div class="post-note">${post.note}</div>` : ''}
            ${tagsHtml}
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// ============================================================================
// Initialize App
// ============================================================================

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
