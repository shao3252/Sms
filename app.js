// --- DATABASE & STATE ---
const DB = {
    users: JSON.parse(localStorage.getItem('st_users')) || [],
    posts: JSON.parse(localStorage.getItem('st_posts')) || [],
    notifications: JSON.parse(localStorage.getItem('st_notifications')) || [],
    announcements: JSON.parse(localStorage.getItem('st_announcements')) || [],
    reports: JSON.parse(localStorage.getItem('st_reports')) || [],
    appeals: JSON.parse(localStorage.getItem('st_appeals')) || []
};

let currentUser = JSON.parse(localStorage.getItem('st_session')) || null;
let currentCommentPostId = null;
let viewingUserId = null;
let currentFeedCategory = 'All'; // Track active category filter

// DB Upgrades for existing data
DB.users = DB.users.map(u => ({
    ...u, followers: u.followers || [], following: u.following || [], verified: u.verified || false, fakeFollowers: u.fakeFollowers || 0, isBlocked: u.isBlocked || false
}));
DB.posts = DB.posts.map(p => ({
    ...p, category: p.category || 'Other'
}));

const saveDB = () => {
    localStorage.setItem('st_users', JSON.stringify(DB.users));
    localStorage.setItem('st_posts', JSON.stringify(DB.posts));
    localStorage.setItem('st_notifications', JSON.stringify(DB.notifications));
    localStorage.setItem('st_announcements', JSON.stringify(DB.announcements));
    localStorage.setItem('st_reports', JSON.stringify(DB.reports));
    localStorage.setItem('st_appeals', JSON.stringify(DB.appeals));
    
    if (currentUser) {
        currentUser = DB.users.find(u => u.id === currentUser.id);
        localStorage.setItem('st_session', JSON.stringify(currentUser));
    }
};

const seedAdmin = () => {
    if (!DB.users.find(u => u.email === 'shaolindown3252@gmail.com')) {
        DB.users.push({
            id: 'admin_1', username: 'Shaolin', email: 'shaolindown3252@gmail.com', password: 'ShaolinDown2007',
            bio: 'Admin of Sms Tamu', pic: '', role: 'admin', saved: [],
            followers: [], following: [], verified: true, fakeFollowers: 0, isBlocked: false
        });
        saveDB();
    }
};

// --- UTILITIES ---
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
const sanitize = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const getVerifiedIcon = (isVerified) => isVerified ? `<span class="verified-badge">✓</span>` : '';
const timeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " yrs ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " mos ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
};

const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

// --- UI CONTROLLER ---
const ui = {
    showToast: (msg, type = 'info') => {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`; t.innerText = msg;
        c.appendChild(t);
        setTimeout(() => { t.remove(); }, 3500);
    },
    toggleTheme: () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('st_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    },
    showModal: (id) => {
        document.getElementById(id).classList.add('active');
        if(id === 'bug-modal') document.getElementById('bug-text').value = '';
        if(id === 'appeal-modal') document.getElementById('appeal-text').value = '';
    },
    hideModal: (id) => document.getElementById(id).classList.remove('active'),
    updateBadges: () => {
        if (!currentUser) return;
        const unread = DB.notifications.filter(n => n.to === currentUser.id && !n.read).length;
        const b = document.getElementById('notif-badge');
        if (unread > 0) { b.style.display = 'block'; b.innerText = unread; } else { b.style.display = 'none'; }
    }
};

// --- ROUTER ---
const router = {
    navigate: (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        const navMap = { home: 0, search: 1, create: 2, notify: 3, profile: 4, 'my-reports': 4, 'single-post': 3 };
        if(navMap[viewId] !== undefined) {
            document.querySelectorAll('.bottom-nav .nav-item')[navMap[viewId]].classList.add('active');
        }

        if (viewId === 'home') appFeatures.renderFeed();
        if (viewId === 'profile') appFeatures.renderProfile();
        if (viewId === 'notify') appFeatures.renderNotifications();
        window.scrollTo(0,0);
    }
};

// --- AUTHENTICATION ---
const appAuth = {
    init: () => {
        seedAdmin();
        if (localStorage.getItem('st_theme') === 'dark') document.body.classList.add('dark');
        if (currentUser) {
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('main-screen').classList.add('active');
            if(currentUser.role === 'admin') document.getElementById('admin-btn').style.display = 'block';
            appFeatures.checkDailyReminder();
            if(currentUser.isBlocked) setTimeout(() => ui.showToast('Your account is restricted. Open settings to appeal.', 'error'), 1000);
            router.navigate('home');
        }
    },
    toggleAuth: () => {
        const l = document.getElementById('login-form');
        const r = document.getElementById('register-form');
        l.style.display = l.style.display === 'none' ? 'block' : 'none';
        r.style.display = r.style.display === 'none' ? 'block' : 'none';
    },
    register: () => {
        const u = document.getElementById('reg-user').value.trim();
        const e = document.getElementById('reg-email').value.trim();
        const p = document.getElementById('reg-pass').value;
        if (!u || !e || !p) return ui.showToast('Denied: Please fill all fields', 'error');
        if (DB.users.find(user => user.email === e)) return ui.showToast('Denied: Email already exists', 'error');
        
        const newUser = { 
            id: generateId(), username: sanitize(u), email: e, password: p, bio: '', pic: '', role: 'user', saved: [],
            followers: [], following: [], verified: false, fakeFollowers: 0, isBlocked: false
        };
        DB.users.push(newUser); saveDB();
        ui.showToast('Success: Account created! Please login.', 'success');
        appAuth.toggleAuth();
    },
    login: () => {
        const e = document.getElementById('login-email').value.trim();
        const p = document.getElementById('login-pass').value;
        const user = DB.users.find(u => u.email === e && u.password === p);
        if (user) {
            currentUser = user; localStorage.setItem('st_session', JSON.stringify(user));
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('main-screen').classList.add('active');
            if(user.role === 'admin') document.getElementById('admin-btn').style.display = 'block';
            if(user.isBlocked) ui.showToast(`Logged in, but your account is blocked.`, 'error');
            else ui.showToast(`Success: Welcome back!`, 'success');
            router.navigate('home');
        } else { ui.showToast('Denied: Invalid credentials', 'error'); }
    },
    logout: () => {
        currentUser = null; viewingUserId = null; currentFeedCategory = 'All';
        localStorage.removeItem('st_session');
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('admin-btn').style.display = 'none';
        ui.showToast('Info: You have been logged out.', 'info');
    }
};

// --- CORE APP FEATURES ---
const appFeatures = {
    openSettings: () => {
        document.getElementById('btn-appeal').style.display = currentUser.isBlocked ? 'block' : 'none';
        ui.showModal('settings-modal');
    },
    checkDailyReminder: () => {
        const today = new Date().toDateString();
        const last = localStorage.getItem('st_last_reminder');
        if (last !== today) {
            setTimeout(() => ui.showToast("💖 Daily Reminder: Share a sweet text today!", 'info'), 2000);
            localStorage.setItem('st_last_reminder', today);
        }
    },
    getUser: (id) => DB.users.find(u => u.id === id) || { username: 'Unknown', pic: '', verified: false, followers: [] },
    
    filterFeed: (category) => {
        currentFeedCategory = category;
        const pills = document.querySelectorAll('#feed-categories .cat-pill');
        pills.forEach(p => p.classList.remove('active'));
        event.target.classList.add('active');
        appFeatures.renderFeed();
    },

    createPostHTML: (post, context = 'feed') => {
        const author = appFeatures.getUser(post.authorId);
        const isLiked = post.likes.includes(currentUser.id);
        const isSaved = currentUser.saved.includes(post.id);
        const isOwner = post.authorId === currentUser.id;
        const isAdmin = currentUser.role === 'admin';
        
        let statusBadge = post.status === 'pending' ? `<span class="post-status">Pending Approval</span>` : '';
        if (post.status === 'rejected') statusBadge = `<span class="post-status" style="background:#f8d7da; color:#721c24;">Rejected</span>`;

        let adminCatChanger = '';
        if (isAdmin) {
            adminCatChanger = `<span style="cursor:pointer; color:var(--secondary); margin-left:10px; font-size:0.75rem;" onclick="appAdmin.changeCategory('${post.id}')">✏️ Edit Cat</span>`;
        }

        let html = `
        <div class="card" id="post-${post.id}">
            <div class="post-header">
                <img src="${author.pic || defaultAvatar}" class="avatar" alt="dp" onclick="appFeatures.viewUserProfile('${author.id}')">
                <div class="post-meta">
                    <div class="post-author" onclick="appFeatures.viewUserProfile('${author.id}')">${sanitize(author.username)} ${getVerifiedIcon(author.verified)}</div>
                    <div class="post-time">${timeAgo(post.timestamp)} ${statusBadge} <span class="post-cat-badge">${post.category}</span> ${adminCatChanger}</div>
                </div>
            </div>
            <div class="post-text">${sanitize(post.text)}</div>
            `;

        if (context === 'admin_queue') {
            html += `<div class="post-actions">
                        <button class="btn-outline" style="color:var(--success); border-color:var(--success);" onclick="appAdmin.moderatePost('${post.id}', 'approved')">Approve</button>
                        <button class="btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="appAdmin.moderatePost('${post.id}', 'rejected')">Reject</button>
                     </div>`;
        } else {
            html += `
            <div class="post-actions">
                <button class="action-btn ${isLiked ? 'active' : ''}" onclick="appFeatures.toggleLike('${post.id}')">❤️ ${post.likes.length}</button>
                <button class="action-btn" onclick="appFeatures.openComments('${post.id}')">💬 ${post.comments.length}</button>
                <button class="action-btn ${isSaved ? 'active' : ''}" onclick="appFeatures.toggleSave('${post.id}')">💾</button>
                <button class="action-btn" onclick="appFeatures.shareWhatsApp('${post.text}')">Share</button>
            </div>`;
            if (isOwner || isAdmin) {
                html += `<div class="mt-1" style="text-align:right;">
                    <button class="action-btn" style="display:inline; color:var(--danger)" onclick="appFeatures.deletePost('${post.id}')">Delete Post</button>
                </div>`;
            }
        }
        html += `</div>`;
        return html;
    },

    renderFeed: () => {
        const container = document.getElementById('feed-container');
        container.innerHTML = '';
        const now = new Date().getTime();
        
        // Show announcements only if 'All' is selected
        if(currentFeedCategory === 'All') {
            const activeAnnouncements = DB.announcements.filter(a => (now - a.time) < 86400000);
            activeAnnouncements.forEach(a => {
                container.innerHTML += `<div class="card" style="border-left: 4px solid var(--primary); background: var(--nav-bg);">
                    <strong style="color:var(--primary)">📢 Announcement</strong><br>
                    <small>${timeAgo(a.time)}</small>
                    <p class="mt-1">${sanitize(a.text)}</p>
                </div>`;
            });
        }

        let approvedPosts = DB.posts.filter(p => p.status === 'approved');
        if(currentFeedCategory !== 'All') {
            approvedPosts = approvedPosts.filter(p => p.category === currentFeedCategory);
        }
        
        approvedPosts.sort((a,b) => b.timestamp - a.timestamp);
        
        if (approvedPosts.length === 0) container.innerHTML += '<p style="text-align:center; color:var(--text-muted)">No texts in this category.</p>';
        approvedPosts.forEach(post => { container.innerHTML += appFeatures.createPostHTML(post); });
        ui.updateBadges();
    },

    createPost: () => {
        if(currentUser.isBlocked) return ui.showToast('Denied: Account restricted. Review required.', 'error');
        const text = document.getElementById('post-text').value.trim();
        const cat = document.getElementById('post-category').value;
        
        if (!cat) return ui.showToast('Denied: Please select a category', 'error');
        if (!text) return ui.showToast('Denied: Write something first!', 'error');
        
        const post = { id: generateId(), authorId: currentUser.id, text: text, category: cat, timestamp: new Date().getTime(), status: 'pending', likes: [], comments: [] };
        DB.posts.push(post); saveDB();
        
        document.getElementById('post-text').value = '';
        document.getElementById('post-category').value = '';
        
        ui.showToast('Success: Post submitted! Pending admin approval.', 'success');
        router.navigate('home');
    },

    deletePost: (id) => {
        if(!confirm("Delete this post?")) return;
        DB.posts = DB.posts.filter(p => p.id !== id); saveDB(); 
        ui.showToast('Success: Post deleted', 'success');
        appFeatures.renderFeed();
        if(document.getElementById('view-profile').classList.contains('active')) appFeatures.loadProfilePosts('own');
        if(document.getElementById('view-other-profile').classList.contains('active')) appFeatures.viewUserProfile(viewingUserId);
        if(document.getElementById('view-single-post').classList.contains('active')) router.navigate('home');
    },

    toggleLike: (postId) => {
        if(currentUser.isBlocked) return ui.showToast('Denied: Account restricted.', 'error');
        const post = DB.posts.find(p => p.id === postId);
        const idx = post.likes.indexOf(currentUser.id);
        if (idx > -1) { post.likes.splice(idx, 1); } 
        else { 
            post.likes.push(currentUser.id); 
            if(post.authorId !== currentUser.id) appFeatures.notify(post.authorId, `${currentUser.username} liked your post.`, 'post', post.id);
        }
        saveDB(); document.getElementById(`post-${postId}`).outerHTML = appFeatures.createPostHTML(post);
    },

    toggleSave: (postId) => {
        const idx = currentUser.saved.indexOf(postId);
        if (idx > -1) { currentUser.saved.splice(idx, 1); ui.showToast('Info: Post removed from saved', 'info'); } 
        else { currentUser.saved.push(postId); ui.showToast('Success: Post saved', 'success'); }
        saveDB(); document.getElementById(`post-${postId}`).outerHTML = appFeatures.createPostHTML(DB.posts.find(p => p.id === postId));
    },

    shareWhatsApp: (text) => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + " \n\n- Shared via Sms Tamu")}`); },

    // COMMENTS
    openComments: (postId) => {
        currentCommentPostId = postId;
        const post = DB.posts.find(p => p.id === postId);
        const list = document.getElementById('comments-list');
        list.innerHTML = post.comments.length ? '' : '<p>No comments yet.</p>';
        post.comments.forEach(c => {
            const u = appFeatures.getUser(c.uId);
            list.innerHTML += `<div class="comment-item" style="cursor:pointer" onclick="ui.hideModal('comment-modal'); appFeatures.viewUserProfile('${u.id}')">
                <strong>${sanitize(u.username)} ${getVerifiedIcon(u.verified)}</strong>: ${sanitize(c.text)}
            </div>`;
        });
        ui.showModal('comment-modal');
    },
    addComment: () => {
        if(currentUser.isBlocked) return ui.showToast('Denied: Account restricted.', 'error');
        const input = document.getElementById('comment-input');
        const text = input.value.trim();
        if (!text) return ui.showToast('Denied: Comment cannot be empty', 'error');
        const post = DB.posts.find(p => p.id === currentCommentPostId);
        post.comments.push({ uId: currentUser.id, text: text, time: new Date().getTime() });
        if(post.authorId !== currentUser.id) appFeatures.notify(post.authorId, `${currentUser.username} commented on your post.`, 'post', post.id);
        saveDB(); input.value = ''; appFeatures.openComments(currentCommentPostId);
        ui.showToast('Success: Comment added', 'success');
        if(document.getElementById(`post-${currentCommentPostId}`)) document.getElementById(`post-${currentCommentPostId}`).outerHTML = appFeatures.createPostHTML(post);
    },

    // USER PROFILES & FOLLOW SYSTEM
    renderProfile: () => {
        document.getElementById('my-username').innerText = currentUser.username;
        document.getElementById('my-verified').innerHTML = getVerifiedIcon(currentUser.verified);
        document.getElementById('my-bio').innerText = currentUser.bio || 'No bio yet.';
        document.getElementById('my-prof-pic').src = currentUser.pic || defaultAvatar;
        
        document.getElementById('my-followers').innerText = currentUser.followers.length + (currentUser.fakeFollowers || 0);
        document.getElementById('my-following').innerText = currentUser.following.length;

        document.getElementById('edit-user').value = currentUser.username;
        document.getElementById('edit-bio').value = currentUser.bio;
        appFeatures.loadProfilePosts('own');
    },
    
    viewUserProfile: (userId) => {
        if(userId === currentUser.id) {
            router.navigate('profile');
            return;
        }
        viewingUserId = userId;
        const targetUser = appFeatures.getUser(userId);
        if(!targetUser.id) return ui.showToast('Error: User not found', 'error');
        
        document.getElementById('other-username').innerText = targetUser.username;
        document.getElementById('other-verified').innerHTML = getVerifiedIcon(targetUser.verified);
        document.getElementById('other-bio').innerText = targetUser.bio || 'No bio yet.';
        document.getElementById('other-prof-pic').src = targetUser.pic || defaultAvatar;
        
        document.getElementById('other-followers').innerText = targetUser.followers.length + (targetUser.fakeFollowers || 0);
        document.getElementById('other-following').innerText = targetUser.following.length;

        const followBtn = document.getElementById('follow-btn');
        if(currentUser.following.includes(userId)) {
            followBtn.innerText = 'Following';
            followBtn.className = 'btn-outline';
        } else {
            followBtn.innerText = 'Follow';
            followBtn.className = 'btn-primary';
        }

        const c = document.getElementById('other-profile-posts');
        c.innerHTML = '';
        const posts = DB.posts.filter(p => p.authorId === userId && p.status === 'approved').sort((a,b) => b.timestamp - a.timestamp);
        if(posts.length === 0) c.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No posts found.</p>';
        posts.forEach(p => c.innerHTML += appFeatures.createPostHTML(p));

        router.navigate('other-profile');
    },

    toggleFollow: () => {
        if(currentUser.isBlocked) return ui.showToast('Denied: Account restricted.', 'error');
        if(!viewingUserId) return;
        const targetUser = DB.users.find(u => u.id === viewingUserId);
        
        const followingIdx = currentUser.following.indexOf(targetUser.id);
        if(followingIdx > -1) {
            currentUser.following.splice(followingIdx, 1);
            const targetFollowerIdx = targetUser.followers.indexOf(currentUser.id);
            if(targetFollowerIdx > -1) targetUser.followers.splice(targetFollowerIdx, 1);
            ui.showToast(`Info: Unfollowed ${targetUser.username}`, 'info');
        } else {
            currentUser.following.push(targetUser.id);
            targetUser.followers.push(currentUser.id);
            appFeatures.notify(targetUser.id, `${currentUser.username} started following you.`, 'user', currentUser.id);
            ui.showToast(`Success: Following ${targetUser.username}`, 'success');
        }
        saveDB();
        appFeatures.viewUserProfile(targetUser.id); 
    },

    saveProfile: () => {
        const newName = document.getElementById('edit-user').value.trim();
        if(!newName) return ui.showToast('Denied: Username cannot be empty', 'error');
        currentUser.username = newName; currentUser.bio = document.getElementById('edit-bio').value.trim();
        saveDB(); ui.hideModal('edit-profile-modal'); 
        ui.showToast('Success: Profile updated', 'success');
        appFeatures.renderProfile();
    },
    updateProfilePic: (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            currentUser.pic = event.target.result; saveDB();
            appFeatures.renderProfile(); ui.showToast('Success: Profile photo updated', 'success');
        };
        reader.readAsDataURL(file);
    },
    loadProfilePosts: (type) => {
        document.querySelectorAll('.profile-tabs .tab').forEach(t => t.classList.remove('active'));
        if(event && event.target) event.target.classList.add('active');
        const c = document.getElementById('profile-posts-container'); c.innerHTML = '';
        let posts = [];
        if (type === 'own') posts = DB.posts.filter(p => p.authorId === currentUser.id);
        if (type === 'liked') posts = DB.posts.filter(p => p.likes.includes(currentUser.id));
        if (type === 'saved') posts = DB.posts.filter(p => currentUser.saved.includes(p.id));
        if (posts.length === 0) c.innerHTML = `<p style="text-align:center; margin-top:20px; color:var(--text-muted)">No posts found.</p>`;
        posts.sort((a,b) => b.timestamp - a.timestamp).forEach(p => c.innerHTML += appFeatures.createPostHTML(p));
    },

    search: () => {
        const q = document.getElementById('search-input').value.toLowerCase();
        const res = document.getElementById('search-results');
        if (!q) { res.innerHTML = ''; return; }
        
        let html = '';
        const users = DB.users.filter(u => u.username.toLowerCase().includes(q));
        if (users.length > 0) {
            html += '<h4>Users</h4>';
            users.forEach(u => { 
                html += `<div class="card" style="padding:10px; cursor:pointer; display:flex; align-items:center;" onclick="appFeatures.viewUserProfile('${u.id}')">
                            <img src="${u.pic || defaultAvatar}" class="avatar" style="width:30px; height:30px; margin-right:10px;">
                            ${sanitize(u.username)} ${getVerifiedIcon(u.verified)}
                        </div>`; 
            });
        }
        
        const posts = DB.posts.filter(p => p.status === 'approved' && p.text.toLowerCase().includes(q));
        if (posts.length > 0) {
            html += '<h4 class="mt-1">Posts</h4>';
            posts.forEach(p => { html += appFeatures.createPostHTML(p); });
        }
        res.innerHTML = html || '<p>No results found</p>';
    },

    // CLICKABLE NOTIFICATIONS
    notify: (toId, text, type = 'none', linkId = null) => {
        DB.notifications.push({ id: generateId(), to: toId, text: text, time: new Date().getTime(), read: false, type: type, linkId: linkId });
        saveDB(); ui.updateBadges();
    },
    renderNotifications: () => {
        const c = document.getElementById('notify-container');
        const notifs = DB.notifications.filter(n => n.to === currentUser.id).sort((a,b) => b.time - a.time);
        c.innerHTML = notifs.length === 0 ? '<p>No notifications yet.</p>' : '';
        notifs.forEach(n => {
            const cursor = n.type !== 'none' ? 'cursor:pointer;' : '';
            c.innerHTML += `<div class="card" style="padding:10px; opacity: ${n.read ? '0.7' : '1'}; ${cursor}" onclick="appFeatures.handleNotificationClick('${n.type}', '${n.linkId}')">
                <p>${sanitize(n.text)}</p><small>${timeAgo(n.time)}</small>
            </div>`;
            n.read = true;
        });
        saveDB(); ui.updateBadges();
    },
    handleNotificationClick: (type, linkId) => {
        if(type === 'user' && linkId) {
            appFeatures.viewUserProfile(linkId);
        } else if (type === 'post' && linkId) {
            const post = DB.posts.find(p => p.id === linkId);
            if(!post) return ui.showToast('Post no longer exists.', 'error');
            document.getElementById('single-post-container').innerHTML = appFeatures.createPostHTML(post);
            router.navigate('single-post');
        } else if (type === 'report') {
            appFeatures.renderMyReports();
        }
    },

    // BUGS AND REVIEWS
    submitReport: () => {
        const t = document.getElementById('bug-text').value.trim();
        if(!t) return ui.showToast('Denied: Empty report', 'error');
        DB.reports.push({ id: generateId(), uId: currentUser.id, text: t, time: new Date().getTime(), adminReply: null });
        saveDB(); ui.hideModal('bug-modal');
        ui.showToast('Success: Report submitted to admin.', 'success');
    },
    
    renderMyReports: () => {
        const list = document.getElementById('my-reports-list');
        list.innerHTML = '';
        const myReps = DB.reports.filter(r => r.uId === currentUser.id).sort((a,b) => b.time - a.time);
        if(myReps.length === 0) list.innerHTML = '<p style="text-align:center;">You have not reported any bugs yet.</p>';
        
        myReps.forEach(r => {
            // Highly visible Admin reply styling
            const replyBlock = r.adminReply ? 
                `<div style="margin-top:10px; padding:12px; background:var(--secondary); color:#ffffff; border-radius:8px; font-size:0.95rem; font-weight:bold; box-shadow: 0 4px 8px rgba(0,132,255,0.3);">
                    👨‍💻 Admin Reply:<br><span style="font-weight:normal; font-size:0.9rem;">${sanitize(r.adminReply)}</span>
                </div>` : 
                `<div style="margin-top:10px; font-size:0.8rem; color:var(--text-muted);">Status: Pending Admin Review</div>`;
                
            list.innerHTML += `<div class="card">
                <small>${timeAgo(r.time)}</small>
                <p class="mt-1">${sanitize(r.text)}</p>
                ${replyBlock}
            </div>`;
        });
        router.navigate('my-reports');
    },

    submitAppeal: () => {
        const text = document.getElementById('appeal-text').value.trim();
        if(!text) return ui.showToast('Denied: Appeal cannot be empty', 'error');
        DB.appeals.push({ id: generateId(), uId: currentUser.id, text: text, time: new Date().getTime() });
        saveDB();
        ui.hideModal('appeal-modal');
        document.getElementById('appeal-text').value = '';
        ui.showToast('Success: Appeal sent to Admin for review', 'success');
    }
};

// --- ADMIN SYSTEM ---
const appAdmin = {
    changeCategory: (postId) => {
        const post = DB.posts.find(p => p.id === postId);
        const newCat = prompt(`Current: ${post.category}\n\nEnter exactly one of: Apology messages, Messages of praise, Seductive Messages, Other`);
        if(newCat) {
            post.category = newCat; saveDB();
            ui.showToast('Success: Category updated', 'success');
            
            // Refresh wherever we are
            if(document.getElementById('view-home').classList.contains('active')) appFeatures.renderFeed();
            if(document.getElementById('view-single-post').classList.contains('active')) document.getElementById('single-post-container').innerHTML = appFeatures.createPostHTML(post);
        }
    },
    renderPending: () => {
        const area = document.getElementById('admin-content-area');
        const pending = DB.posts.filter(p => p.status === 'pending');
        if (pending.length === 0) { area.innerHTML = '<p>No pending posts.</p>'; return; }
        area.innerHTML = '<h4>Pending Approval Queue</h4>';
        pending.forEach(p => { area.innerHTML += appFeatures.createPostHTML(p, 'admin_queue'); });
    },
    moderatePost: (postId, status) => {
        const post = DB.posts.find(p => p.id === postId);
        post.status = status; appFeatures.notify(post.authorId, `Your post was ${status} by admin.`, 'post', post.id);
        saveDB(); ui.showToast(`Success: Post ${status}`, 'success'); appAdmin.renderPending();
    },
    renderUsers: () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = '<h4>Manage Users</h4>';
        if(DB.users.length === 0) return area.innerHTML += '<p>No users found.</p>';

        DB.users.forEach(u => {
            let tools = '';
            
            // Allow Admin to edit Verify & Followers for ALL users (including themselves)
            tools += `<button onclick="appAdmin.toggleVerify('${u.id}')" class="btn-outline" style="padding:4px 8px; font-size:0.75rem;">${u.verified ? 'Unverify' : 'Verify'}</button> `;
            tools += `<button onclick="appAdmin.addFakeFollowers('${u.id}')" class="btn-outline" style="padding:4px 8px; font-size:0.75rem;">+ Followers</button> `;
            
            // Only show Block/Delete for OTHER users
            if (u.id !== currentUser.id) {
                const blockColor = u.isBlocked ? 'var(--success)' : 'var(--danger)';
                const blockText = u.isBlocked ? 'Unblock' : 'Block';
                tools += `<button onclick="appAdmin.toggleBlock('${u.id}')" class="btn-outline" style="color:${blockColor}; border-color:${blockColor}; padding:4px 8px; font-size:0.75rem;">${blockText}</button> `;
                tools += `<button onclick="appAdmin.deleteUser('${u.id}')" class="btn-outline" style="color:var(--text-muted); padding:4px 8px; font-size:0.75rem;">Delete</button> `;
            }
            
            const blockedTag = u.isBlocked ? `<span class="badge" style="position:static; background:var(--danger)">Blocked</span>` : '';

            area.innerHTML += `<div class="card" style="padding:12px; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="cursor:pointer" onclick="appFeatures.viewUserProfile('${u.id}')">${sanitize(u.username)} ${getVerifiedIcon(u.verified)}</strong>
                    <div>${blockedTag} <span class="badge" style="position:static; background:var(--text-muted)">${u.role}</span></div>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted);">Real Fol: ${u.followers.length} | Added: ${u.fakeFollowers || 0}</div>
                <div style="display:flex; gap:5px; margin-top:8px;">${tools}</div>
            </div>`;
        });
    },
    toggleVerify: (userId) => {
        const u = DB.users.find(u => u.id === userId);
        u.verified = !u.verified; saveDB();
        ui.showToast(`Success: User ${u.verified ? 'Verified' : 'Unverified'}`, 'success');
        appAdmin.renderUsers();
    },
    addFakeFollowers: (userId) => {
        const u = DB.users.find(u => u.id === userId);
        const amount = prompt("Enter number of followers to add:", "1000");
        if(amount === null || isNaN(amount) || amount === "") return;
        u.fakeFollowers = (u.fakeFollowers || 0) + parseInt(amount);
        saveDB(); ui.showToast(`Success: Added followers`, 'success');
        appAdmin.renderUsers();
    },
    toggleBlock: (userId) => {
        const u = DB.users.find(u => u.id === userId);
        u.isBlocked = !u.isBlocked; saveDB();
        appFeatures.notify(u.id, u.isBlocked ? "Your account has been restricted by the Admin." : "Your account block was lifted.", 'none', null);
        ui.showToast(`Success: User ${u.isBlocked ? 'Blocked' : 'Unblocked'}`, 'success');
        appAdmin.renderUsers();
    },
    deleteUser: (userId) => {
        if (!confirm("Are you sure? This deletes user AND their posts.")) return;
        DB.users = DB.users.filter(u => u.id !== userId);
        DB.posts = DB.posts.filter(p => p.authorId !== userId);
        saveDB(); ui.showToast("Success: User deleted", "success"); appAdmin.renderUsers();
    },
    
    // BUGS ADMIN
    renderReports: () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = '<h4>User Reports / Bugs</h4>';
        if(DB.reports.length === 0) return area.innerHTML += '<p>No reports found.</p>';
        DB.reports.sort((a,b) => b.time - a.time).forEach(r => {
            const u = appFeatures.getUser(r.uId);
            const replyStatus = r.adminReply ? `<span style="color:var(--success); font-size:0.8rem;">(Replied)</span>` : '';
            
            area.innerHTML += `<div class="card" style="padding:10px;">
                <strong>By: ${u.username}</strong> ${replyStatus} <small style="float:right">${timeAgo(r.time)}</small>
                <p class="mt-1" style="background:var(--bg-color); padding:10px; border-radius:8px;">${sanitize(r.text)}</p>
                
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button class="btn-outline" style="color:var(--secondary); border-color:var(--secondary); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.replyReport('${r.id}')">Reply</button>
                    <button class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.deleteReport('${r.id}')">Dismiss</button>
                </div>
            </div>`;
        });
    },
    replyReport: (id) => {
        const reply = prompt("Enter your reply to this user:");
        if(reply) {
            const r = DB.reports.find(r => r.id === id);
            r.adminReply = reply;
            appFeatures.notify(r.uId, "Admin replied to your bug report. Tap to view.", 'report', null);
            saveDB();
            ui.showToast('Success: Reply sent', 'success');
            appAdmin.renderReports();
        }
    },
    deleteReport: (id) => {
        DB.reports = DB.reports.filter(r => r.id !== id); saveDB();
        ui.showToast('Success: Report dismissed', 'success'); appAdmin.renderReports();
    },

    // APPEALS ADMIN
    renderAppeals: () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = '<h4>Account Block Appeals</h4>';
        if(DB.appeals.length === 0) return area.innerHTML += '<p>No pending appeals.</p>';
        
        DB.appeals.sort((a,b) => b.time - a.time).forEach(app => {
            const u = appFeatures.getUser(app.uId);
            area.innerHTML += `<div class="card" style="padding:10px;">
                <strong>User: ${u.username}</strong> <small style="float:right">${timeAgo(app.time)}</small>
                <p class="mt-1" style="background:var(--bg-color); padding:10px; border-radius:8px;">${sanitize(app.text)}</p>
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button class="btn-outline" style="color:var(--success); border-color:var(--success); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.resolveAppeal('${app.id}', true)">Unblock</button>
                    <button class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.resolveAppeal('${app.id}', false)">Reject Appeal</button>
                </div>
            </div>`;
        });
    },
    resolveAppeal: (appealId, unblock) => {
        const app = DB.appeals.find(a => a.id === appealId);
        if(unblock) {
            const u = DB.users.find(user => user.id === app.uId);
            if(u) u.isBlocked = false;
            appFeatures.notify(app.uId, "Your appeal was approved. Your account is unblocked!");
        } else {
            appFeatures.notify(app.uId, "Your appeal was reviewed but rejected. You remain blocked.");
        }
        DB.appeals = DB.appeals.filter(a => a.id !== appealId);
        saveDB();
        ui.showToast(unblock ? 'User unblocked' : 'Appeal rejected', 'success');
        appAdmin.renderAppeals();
    },

    renderAnnouncements: () => {
        const area = document.getElementById('admin-content-area');
        const now = new Date().getTime();
        const active = DB.announcements.filter(a => (now - a.time) < 86400000);
        area.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4>Manage Announcements</h4>
                <button class="btn-primary" style="width:auto; padding:6px 16px; font-size:0.8rem;" onclick="ui.showModal('announcement-modal')">+ Create New</button>
            </div>`;
        if (active.length === 0) return area.innerHTML += '<p>No active announcements.</p>';
        active.sort((a,b) => b.time - a.time).forEach(a => {
            area.innerHTML += `<div class="card" style="padding:12px; margin-bottom:10px; border-left:4px solid var(--primary);">
                <p>${sanitize(a.text)}</p>
                <div style="display:flex; justify-content:space-between; margin-top:10px;">
                    <small style="color:var(--text-muted)">${timeAgo(a.time)}</small>
                    <button class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.deleteAnnouncement('${a.id}')">Delete</button>
                </div>
            </div>`;
        });
    },
    deleteAnnouncement: (id) => {
        if(!confirm("Delete announcement?")) return;
        DB.announcements = DB.announcements.filter(a => a.id !== id); saveDB();
        ui.showToast("Success: Announcement deleted", "success"); appAdmin.renderAnnouncements(); 
    },
    postAnnouncement: () => {
        const text = document.getElementById('announcement-text').value.trim();
        if(!text) return ui.showToast("Denied: Cannot be empty", "error");
        DB.announcements.push({ id: generateId(), text: text, time: new Date().getTime() });
        DB.users.forEach(u => appFeatures.notify(u.id, "New Admin Announcement."));
        saveDB(); document.getElementById('announcement-text').value = '';
        ui.hideModal('announcement-modal'); ui.showToast('Success: Sent to all!', 'success'); appAdmin.renderAnnouncements();
    }
};

appAuth.init();
