// Data Layer - localStorage abstraction

const DataService = {
    // Initialize with sample data if empty
    init() {
        if (!localStorage.getItem('architecture_log_users')) {
            const defaultUser = {
                id: 'user_' + Date.now(),
                username: 'default',
                bio: 'Architecture enthusiast',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('architecture_log_users', JSON.stringify([defaultUser]));
        }
        if (!localStorage.getItem('architecture_log_posts')) {
            localStorage.setItem('architecture_log_posts', JSON.stringify([]));
        }
        if (!localStorage.getItem('architecture_log_comments')) {
            localStorage.setItem('architecture_log_comments', JSON.stringify([]));
        }
        if (!localStorage.getItem('architecture_log_likes')) {
            localStorage.setItem('architecture_log_likes', JSON.stringify([]));
        }
    },

    // User operations
    getCurrentUser() {
        return JSON.parse(localStorage.getItem('current_user') || 'null');
    },

    setCurrentUser(user) {
        localStorage.setItem('current_user', JSON.stringify(user));
        this.saveUser(user);
    },

    saveUser(user) {
        const users = this.getUsers();
        const existingIndex = users.findIndex(u => u.id === user.id);
        if (existingIndex >= 0) {
            users[existingIndex] = user;
        } else {
            users.push(user);
        }
        localStorage.setItem('architecture_log_users', JSON.stringify(users));
    },

    getUsers() {
        return JSON.parse(localStorage.getItem('architecture_log_users') || '[]');
    },

    // Post operations
    getPosts() {
        return JSON.parse(localStorage.getItem('architecture_log_posts') || '[]');
    },

    savePost(post) {
        const posts = this.getPosts();
        const existingIndex = posts.findIndex(p => p.id === post.id);
        if (existingIndex >= 0) {
            posts[existingIndex] = post;
        } else {
            posts.push(post);
        }
        localStorage.setItem('architecture_log_posts', JSON.stringify(posts));
    },

    deletePost(postId) {
        const posts = this.getPosts();
        const filtered = posts.filter(p => p.id !== postId);
        localStorage.setItem('architecture_log_posts', JSON.stringify(filtered));
        
        // Also delete related comments and likes
        const comments = this.getComments().filter(c => c.postId !== postId);
        localStorage.setItem('architecture_log_comments', JSON.stringify(comments));
        
        const likes = this.getLikes().filter(l => l.postId !== postId);
        localStorage.setItem('architecture_log_likes', JSON.stringify(likes));
    },

    getUserPosts(userId) {
        return this.getPosts().filter(p => p.userId === userId);
    },

    // Comment operations
    getComments(postId) {
        const allComments = JSON.parse(localStorage.getItem('architecture_log_comments') || '[]');
        if (postId) {
            return allComments.filter(c => c.postId === postId);
        }
        return allComments;
    },

    saveComment(comment) {
        const comments = this.getComments();
        comments.push(comment);
        localStorage.setItem('architecture_log_comments', JSON.stringify(comments));
    },

    // Like operations
    getLikes(postId) {
        const allLikes = JSON.parse(localStorage.getItem('architecture_log_likes') || '[]');
        if (postId) {
            return allLikes.filter(l => l.postId === postId);
        }
        return allLikes;
    },

    toggleLike(postId, userId) {
        const likes = this.getLikes();
        const existingIndex = likes.findIndex(l => l.postId === postId && l.userId === userId);
        
        if (existingIndex >= 0) {
            likes.splice(existingIndex, 1);
        } else {
            likes.push({ postId, userId, createdAt: new Date().toISOString() });
        }
        
        localStorage.setItem('architecture_log_likes', JSON.stringify(likes));
    },

    isLiked(postId, userId) {
        const likes = this.getLikes(postId);
        return likes.some(l => l.userId === userId);
    }
};

// Initialize on load
DataService.init();



