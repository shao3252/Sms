import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, 
    doc, query, where, orderBy, onSnapshot, deleteDoc, arrayUnion, arrayRemove, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDoY0topAnJpvePclmDEFM7-9lLXdPX1pg",
  authDomain: "smstamu-28748.firebaseapp.com",
  projectId: "smstamu-28748",
  storageBucket: "smstamu-28748.firebasestorage.app",
  messagingSenderId: "928000331591",
  appId: "1:928000331591:web:d71a658eb34feeea620662",
  measurementId: "G-1VQHWVQS39"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. GLOBAL STATE ---
let currentUser = JSON.parse(localStorage.getItem('st_session')) || null;
let currentFeedCategory = 'All';
let viewingUserId = null;
let currentCommentPostId = null;

// --- 3. UTILITIES ---
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
const getVerifiedIcon = (v) => v ? `<span class="verified-badge">✓</span>` : '';
const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

window.ui = {
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
    showModal: (id) => document.getElementById(id).classList.add('active'),
    hideModal: (id) => document.getElementById(id).classList.remove('active')
};

const timeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    let interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
};

// --- 4. ROUTER ---
window.router = {
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
        if (viewId === 'admin') appAdmin.renderPending();
        window.scrollTo(0,0);
    }
};

// --- 5. AUTHENTICATION ---
window.appAuth = {
    login: async () => {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        if (!email || !pass) return ui.showToast('Enter email and password', 'error');

        const q = query(collection(db, "users"), where("email", "==", email), where("password", "==", pass));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const userDoc = snap.docs[0];
            currentUser = { id: userDoc.id, ...userDoc.data() };
            localStorage.setItem('st_session', JSON.stringify(currentUser));
            location.reload();
        } else { 
            ui.showToast('Invalid Email or Password', 'error'); 
        }
    },
    register: async () => {
        const user = document.getElementById('reg-user').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        if (!user || !email || !pass) return ui.showToast('Fill all fields', 'error');
        
        const check = query(collection(db, "users"), where("email", "==", email));
        const checkSnap = await getDocs(check);
        if(!checkSnap.empty) return ui.showToast('Email already in use', 'error');

        await addDoc(collection(db, "users"), {
            username: user, email: email, password: pass, role: "user", verified: false,
            isBlocked: false, followers: [], following: [], bio: "", pic: "", fakeFollowers: 0
        });
        ui.showToast('Success! Now Login', 'success');
        appAuth.toggleAuth();
    },
    logout: () => { localStorage.removeItem('st_session'); location.reload(); },
    toggleAuth: () => {
        const l = document.getElementById('login-form');
        const r = document.getElementById('register-form');
        l.style.display = l.style.display === 'none' ? 'block' : 'none';
        r.style.display = r.style.display === 'none' ? 'block' : 'none';
    }
};

// --- 6. CORE FEATURES ---
window.appFeatures = {
    getUser: async (userId) => {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
        return { username: 'Unknown', pic: '', verified: false, followers: [], following: [] };
    },
    createPost: async () => {
        if(currentUser.isBlocked) return ui.showToast('Account Restricted!', 'error');
        const text = document.getElementById('post-text').value.trim();
        const cat = document.getElementById('post-category').value;
        if(!text || !cat) return ui.showToast('Select Category & Type Text', 'error');

        await addDoc(collection(db, "posts"), {
            authorId: currentUser.id, authorName: currentUser.username, authorPic: currentUser.pic || "",
            authorVerified: currentUser.verified || false, text: text, category: cat,
            status: "pending", timestamp: Date.now(), likes: [], comments: []
        });
        ui.showToast('Sent for Admin Review!', 'success');
        document.getElementById('post-text').value = '';
        router.navigate('home');
    },
    createPostHTML: (post, context = 'feed') => {
        const isLiked = post.likes && post.likes.includes(currentUser.id);
        const isSaved = currentUser.saved && currentUser.saved.includes(post.id);
        const isOwner = post.authorId === currentUser.id;
        const isAdmin = currentUser.role === 'admin';
        
        let statusBadge = post.status === 'pending' ? `<span class="post-status">Pending Approval</span>` : '';
        if (post.status === 'rejected') statusBadge = `<span class="post-status" style="background:#f8d7da; color:#721c24;">Rejected</span>`;
        let adminCatChanger = isAdmin ? `<span style="cursor:pointer; color:var(--secondary); margin-left:10px; font-size:0.75rem;" onclick="appAdmin.changeCategory('${post.id}')">✏️ Edit Cat</span>` : '';

        let html = `
        <div class="card" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorPic || defaultAvatar}" class="avatar" alt="dp" onclick="appFeatures.viewUserProfile('${post.authorId}')">
                <div class="post-meta">
                    <div class="post-author" onclick="appFeatures.viewUserProfile('${post.authorId}')">${sanitize(post.authorName)} ${getVerifiedIcon(post.authorVerified)}</div>
                    <div class="post-time">${timeAgo(post.timestamp)} ${statusBadge} <span class="post-cat-badge">${post.category || 'Other'}</span> ${adminCatChanger}</div>
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
            const likeCount = post.likes ? post.likes.length : 0;
            const commentCount = post.comments ? post.comments.length : 0;
            html += `
            <div class="post-actions">
                <button class="action-btn ${isLiked ? 'active' : ''}" onclick="appFeatures.toggleLike('${post.id}')">❤️ ${likeCount}</button>
                <button class="action-btn" onclick="appFeatures.openComments('${post.id}')">💬 ${commentCount}</button>
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
        let q = query(collection(db, "posts"), where("status", "==", "approved"), orderBy("timestamp", "desc"));
        if(currentFeedCategory !== 'All') {
            q = query(collection(db, "posts"), where("status", "==", "approved"), where("category", "==", currentFeedCategory), orderBy("timestamp", "desc"));
        }
        
        onSnapshot(q, (snap) => {
            const container = document.getElementById('feed-container');
            container.innerHTML = '';
            
            if(currentFeedCategory === 'All') appFeatures.renderAnnouncementsToFeed(container);

            if (snap.empty) {
                container.innerHTML += '<p style="text-align:center; color:var(--text-muted)">No posts found in this category.</p>';
                return;
            }
            snap.forEach(docSnap => {
                const post = { id: docSnap.id, ...docSnap.data() };
                container.innerHTML += appFeatures.createPostHTML(post);
            });
        });
    },
    renderAnnouncementsToFeed: async (container) => {
        const q = query(collection(db, "announcements"));
        const snap = await getDocs(q);
        const now = Date.now();
        snap.forEach(docSnap => {
            const a = docSnap.data();
            if ((now - a.time) < 86400000) {
                container.innerHTML += `<div class="card" style="border-left: 4px solid var(--primary); background: var(--nav-bg);">
                    <strong style="color:var(--primary)">📢 Announcement</strong><br>
                    <small>${timeAgo(a.time)}</small>
                    <p class="mt-1">${sanitize(a.text)}</p>
                </div>`;
            }
        });
    },
    filterFeed: (cat) => {
        currentFeedCategory = cat;
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        event.target.classList.add('active');
        appFeatures.renderFeed();
    },
    toggleLike: async (postId) => {
        if(currentUser.isBlocked) return ui.showToast('Account Restricted!', 'error');
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        if(!postSnap.exists()) return;
        const post = postSnap.data();
        const hasLiked = post.likes && post.likes.includes(currentUser.id);

        if(hasLiked) {
            await updateDoc(postRef, { likes: arrayRemove(currentUser.id) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(currentUser.id) });
            if(post.authorId !== currentUser.id) appFeatures.notify(post.authorId, `${currentUser.username} liked your post.`, 'post', postId);
        }
    },
    toggleSave: async (postId) => {
        const userRef = doc(db, "users", currentUser.id);
        const hasSaved = currentUser.saved && currentUser.saved.includes(postId);
        
        if (!currentUser.saved) currentUser.saved = [];
        
        if (hasSaved) {
            currentUser.saved = currentUser.saved.filter(id => id !== postId);
            await updateDoc(userRef, { saved: arrayRemove(postId) });
            ui.showToast('Removed from saved', 'info');
        } else {
            currentUser.saved.push(postId);
            await updateDoc(userRef, { saved: arrayUnion(postId) });
            ui.showToast('Post saved', 'success');
        }
        localStorage.setItem('st_session', JSON.stringify(currentUser));
        // Force re-render of feed to update button color
        appFeatures.renderFeed();
    },
    deletePost: async (postId) => {
        if(!confirm("Are you sure you want to delete this post?")) return;
        await deleteDoc(doc(db, "posts", postId));
        ui.showToast('Post deleted', 'success');
    },
    openComments: async (postId) => {
        currentCommentPostId = postId;
        const postSnap = await getDoc(doc(db, "posts", postId));
        if(!postSnap.exists()) return;
        const post = postSnap.data();
        const list = document.getElementById('comments-list');
        list.innerHTML = (!post.comments || post.comments.length === 0) ? '<p>No comments yet.</p>' : '';
        
        if (post.comments) {
            post.comments.forEach(c => {
                list.innerHTML += `<div class="comment-item" style="cursor:pointer" onclick="ui.hideModal('comment-modal'); appFeatures.viewUserProfile('${c.uId}')">
                    <strong>${sanitize(c.username)} ${getVerifiedIcon(c.verified)}</strong>: ${sanitize(c.text)}
                </div>`;
            });
        }
        ui.showModal('comment-modal');
    },
    addComment: async () => {
        if(currentUser.isBlocked) return ui.showToast('Account restricted.', 'error');
        const input = document.getElementById('comment-input');
        const text = input.value.trim();
        if (!text) return ui.showToast('Comment cannot be empty', 'error');
        
        const postRef = doc(db, "posts", currentCommentPostId);
        const newComment = { uId: currentUser.id, username: currentUser.username, verified: currentUser.verified || false, text: text, time: Date.now() };
        
        await updateDoc(postRef, { comments: arrayUnion(newComment) });
        input.value = '';
        ui.showToast('Comment added', 'success');
        appFeatures.openComments(currentCommentPostId);
        
        const postSnap = await getDoc(postRef);
        if(postSnap.data().authorId !== currentUser.id) {
            appFeatures.notify(postSnap.data().authorId, `${currentUser.username} commented on your post.`, 'post', currentCommentPostId);
        }
    },
    shareWhatsApp: (text) => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + " \n\n- Shared via Sms Tamu")}`); },

    // --- PROFILE & FOLLOWS ---
    renderProfile: () => {
        document.getElementById('my-username').innerText = currentUser.username;
        document.getElementById('my-verified').innerHTML = getVerifiedIcon(currentUser.verified);
        document.getElementById('my-bio').innerText = currentUser.bio || "No bio yet.";
        document.getElementById('my-prof-pic').src = currentUser.pic || defaultAvatar;
        
        document.getElementById('my-following').innerText = currentUser.following ? currentUser.following.length : 0;
        document.getElementById('my-followers').innerText = (currentUser.followers ? currentUser.followers.length : 0) + (currentUser.fakeFollowers || 0);

        document.getElementById('edit-user').value = currentUser.username;
        document.getElementById('edit-bio').value = currentUser.bio || "";
        appFeatures.loadProfilePosts('own');
    },
    viewUserProfile: async (userId) => {
        if(userId === currentUser.id) { router.navigate('profile'); return; }
        viewingUserId = userId;
        const targetUser = await appFeatures.getUser(userId);
        if(!targetUser.id) return ui.showToast('User not found', 'error');
        
        document.getElementById('other-username').innerText = targetUser.username;
        document.getElementById('other-verified').innerHTML = getVerifiedIcon(targetUser.verified);
        document.getElementById('other-bio').innerText = targetUser.bio || 'No bio yet.';
        document.getElementById('other-prof-pic').src = targetUser.pic || defaultAvatar;
        
        document.getElementById('other-following').innerText = targetUser.following ? targetUser.following.length : 0;
        document.getElementById('other-followers').innerText = (targetUser.followers ? targetUser.followers.length : 0) + (targetUser.fakeFollowers || 0);

        const followBtn = document.getElementById('follow-btn');
        if(currentUser.following && currentUser.following.includes(userId)) {
            followBtn.innerText = 'Following'; followBtn.className = 'btn-outline';
        } else {
            followBtn.innerText = 'Follow'; followBtn.className = 'btn-primary';
        }

        const c = document.getElementById('other-profile-posts');
        c.innerHTML = 'Loading posts...';
        const q = query(collection(db, "posts"), where("authorId", "==", userId), where("status", "==", "approved"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        c.innerHTML = snap.empty ? '<p style="text-align:center; color:var(--text-muted)">No posts found.</p>' : '';
        snap.forEach(docSnap => { c.innerHTML += appFeatures.createPostHTML({ id: docSnap.id, ...docSnap.data() }); });

        router.navigate('other-profile');
    },
    toggleFollow: async () => {
        if(currentUser.isBlocked) return ui.showToast('Account restricted.', 'error');
        if(!viewingUserId) return;
        
        const myRef = doc(db, "users", currentUser.id);
        const targetRef = doc(db, "users", viewingUserId);
        
        if (!currentUser.following) currentUser.following = [];
        
        if(currentUser.following.includes(viewingUserId)) {
            await updateDoc(myRef, { following: arrayRemove(viewingUserId) });
            await updateDoc(targetRef, { followers: arrayRemove(currentUser.id) });
            currentUser.following = currentUser.following.filter(id => id !== viewingUserId);
            ui.showToast(`Unfollowed`, 'info');
        } else {
            await updateDoc(myRef, { following: arrayUnion(viewingUserId) });
            await updateDoc(targetRef, { followers: arrayUnion(currentUser.id) });
            currentUser.following.push(viewingUserId);
            appFeatures.notify(viewingUserId, `${currentUser.username} started following you.`, 'user', currentUser.id);
            ui.showToast(`Following`, 'success');
        }
        localStorage.setItem('st_session', JSON.stringify(currentUser));
        appFeatures.viewUserProfile(viewingUserId); 
    },
    saveProfile: async () => {
        const newName = document.getElementById('edit-user').value.trim();
        const newBio = document.getElementById('edit-bio').value.trim();
        if(!newName) return ui.showToast('Username cannot be empty', 'error');
        
        await updateDoc(doc(db, "users", currentUser.id), { username: newName, bio: newBio });
        currentUser.username = newName; currentUser.bio = newBio;
        localStorage.setItem('st_session', JSON.stringify(currentUser));
        
        ui.hideModal('edit-profile-modal'); 
        ui.showToast('Profile updated', 'success');
        appFeatures.renderProfile();
    },
    updateProfilePic: (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;
            await updateDoc(doc(db, "users", currentUser.id), { pic: base64 });
            currentUser.pic = base64;
            localStorage.setItem('st_session', JSON.stringify(currentUser));
            appFeatures.renderProfile(); 
            ui.showToast('Profile photo updated', 'success');
        };
        reader.readAsDataURL(file);
    },
    loadProfilePosts: async (type) => {
        document.querySelectorAll('.profile-tabs .tab').forEach(t => t.classList.remove('active'));
        if(event && event.target) event.target.classList.add('active');
        
        const c = document.getElementById('profile-posts-container'); 
        c.innerHTML = 'Loading...';
        
        let snap;
        if (type === 'own') {
            const q = query(collection(db, "posts"), where("authorId", "==", currentUser.id), orderBy("timestamp", "desc"));
            snap = await getDocs(q);
        } else if (type === 'liked') {
            const q = query(collection(db, "posts"), where("likes", "array-contains", currentUser.id));
            snap = await getDocs(q);
        } else if (type === 'saved') {
            // Firestore doesn't support 'where IN' with large arrays easily, so we fetch all and filter client side for saved
            if(!currentUser.saved || currentUser.saved.length === 0) {
                return c.innerHTML = '<p style="text-align:center;">No saved posts.</p>';
            }
            const q = query(collection(db, "posts"));
            const allSnap = await getDocs(q);
            c.innerHTML = '';
            let found = false;
            allSnap.forEach(docSnap => {
                if(currentUser.saved.includes(docSnap.id)) {
                    c.innerHTML += appFeatures.createPostHTML({ id: docSnap.id, ...docSnap.data() });
                    found = true;
                }
            });
            if(!found) c.innerHTML = '<p style="text-align:center;">No saved posts found.</p>';
            return;
        }

        c.innerHTML = snap.empty ? `<p style="text-align:center; margin-top:20px; color:var(--text-muted)">No posts found.</p>` : '';
        snap.forEach(docSnap => { c.innerHTML += appFeatures.createPostHTML({ id: docSnap.id, ...docSnap.data() }); });
    },

    // --- SEARCH ---
    search: async () => {
        const qText = document.getElementById('search-input').value.toLowerCase();
        const res = document.getElementById('search-results');
        if (!qText) { res.innerHTML = ''; return; }
        
        res.innerHTML = 'Searching...';
        let html = '';
        
        // Fetch all users and posts (Basic implementation for simple DB)
        const usersSnap = await getDocs(collection(db, "users"));
        html += '<h4>Users</h4>';
        let userFound = false;
        usersSnap.forEach(docSnap => {
            const u = { id: docSnap.id, ...docSnap.data() };
            if(u.username.toLowerCase().includes(qText)) {
                userFound = true;
                html += `<div class="card" style="padding:10px; cursor:pointer; display:flex; align-items:center;" onclick="appFeatures.viewUserProfile('${u.id}')">
                            <img src="${u.pic || defaultAvatar}" class="avatar" style="width:30px; height:30px; margin-right:10px;">
                            ${sanitize(u.username)} ${getVerifiedIcon(u.verified)}
                        </div>`; 
            }
        });
        if(!userFound) html += '<p style="font-size:0.8rem">No users found.</p>';

        const postsSnap = await getDocs(query(collection(db, "posts"), where("status", "==", "approved")));
        html += '<h4 class="mt-1">Posts</h4>';
        let postFound = false;
        postsSnap.forEach(docSnap => {
            const p = { id: docSnap.id, ...docSnap.data() };
            if(p.text.toLowerCase().includes(qText)) {
                postFound = true;
                html += appFeatures.createPostHTML(p);
            }
        });
        if(!postFound) html += '<p style="font-size:0.8rem">No posts found.</p>';

        res.innerHTML = html;
    },

    // --- NOTIFICATIONS & REPORTS ---
    notify: async (toId, text, type = 'none', linkId = null) => {
        await addDoc(collection(db, "notifications"), {
            to: toId, text: text, time: Date.now(), read: false, type: type, linkId: linkId
        });
    },
    renderNotifications: () => {
        const q = query(collection(db, "notifications"), where("to", "==", currentUser.id), orderBy("time", "desc"));
        onSnapshot(q, (snap) => {
            const c = document.getElementById('notify-container');
            c.innerHTML = snap.empty ? '<p>No notifications yet.</p>' : '';
            snap.forEach(docSnap => {
                const n = { id: docSnap.id, ...docSnap.data() };
                const cursor = n.type !== 'none' ? 'cursor:pointer;' : '';
                c.innerHTML += `<div class="card" style="padding:10px; opacity: ${n.read ? '0.7' : '1'}; ${cursor}" onclick="appFeatures.handleNotificationClick('${n.type}', '${n.linkId}', '${n.id}')">
                    <p>${sanitize(n.text)}</p><small>${timeAgo(n.time)}</small>
                </div>`;
            });
            // Update badge
            const unread = snap.docs.filter(d => !d.data().read).length;
            const b = document.getElementById('notif-badge');
            if (unread > 0) { b.style.display = 'block'; b.innerText = unread; } else { b.style.display = 'none'; }
        });
    },
    handleNotificationClick: async (type, linkId, notifId) => {
        await updateDoc(doc(db, "notifications", notifId), { read: true });
        
        if(type === 'user' && linkId) {
            appFeatures.viewUserProfile(linkId);
        } else if (type === 'post' && linkId) {
            const postSnap = await getDoc(doc(db, "posts", linkId));
            if(!postSnap.exists()) return ui.showToast('Post no longer exists.', 'error');
            document.getElementById('single-post-container').innerHTML = appFeatures.createPostHTML({ id: postSnap.id, ...postSnap.data() });
            router.navigate('single-post');
        } else if (type === 'report') {
            appFeatures.renderMyReports();
        }
    },
    openSettings: () => {
        document.getElementById('btn-appeal').style.display = currentUser.isBlocked ? 'block' : 'none';
        ui.showModal('settings-modal');
    },
    submitReport: async () => {
        const t = document.getElementById('bug-text').value.trim();
        if(!t) return ui.showToast('Empty report', 'error');
        await addDoc(collection(db, "reports"), { uId: currentUser.id, username: currentUser.username, text: t, time: Date.now(), adminReply: null });
        ui.hideModal('bug-modal');
        ui.showToast('Report submitted to admin.', 'success');
    },
    renderMyReports: async () => {
        const list = document.getElementById('my-reports-list');
        list.innerHTML = 'Loading...';
        const q = query(collection(db, "reports"), where("uId", "==", currentUser.id), orderBy("time", "desc"));
        const snap = await getDocs(q);
        
        if(snap.empty) list.innerHTML = '<p style="text-align:center;">No bug reports yet.</p>';
        else list.innerHTML = '';
        
        snap.forEach(docSnap => {
            const r = docSnap.data();
            const replyBlock = r.adminReply ? 
                `<div style="margin-top:10px; padding:12px; background:var(--secondary); color:#ffffff; border-radius:8px; font-size:0.95rem; font-weight:bold;">
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
    submitAppeal: async () => {
        const text = document.getElementById('appeal-text').value.trim();
        if(!text) return ui.showToast('Appeal cannot be empty', 'error');
        await addDoc(collection(db, "appeals"), { uId: currentUser.id, username: currentUser.username, text: text, time: Date.now() });
        ui.hideModal('appeal-modal');
        document.getElementById('appeal-text').value = '';
        ui.showToast('Appeal sent to Admin', 'success');
    }
};

// --- 7. ADMIN SYSTEM ---
window.appAdmin = {
    changeCategory: async (postId) => {
        const newCat = prompt(`Enter exactly one of: Apology messages, Messages of praise, Seductive Messages, Other`);
        if(newCat) {
            await updateDoc(doc(db, "posts", postId), { category: newCat });
            ui.showToast('Category updated', 'success');
            if(document.getElementById('view-single-post').classList.contains('active')) router.navigate('home');
        }
    },
    renderPending: async () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = 'Loading...';
        const q = query(collection(db, "posts"), where("status", "==", "pending"));
        const snap = await getDocs(q);
        if (snap.empty) { area.innerHTML = '<p>No pending posts.</p>'; return; }
        area.innerHTML = '<h4>Pending Approval Queue</h4>';
        snap.forEach(docSnap => { area.innerHTML += appFeatures.createPostHTML({ id: docSnap.id, ...docSnap.data() }, 'admin_queue'); });
    },
    moderatePost: async (postId, status) => {
        await updateDoc(doc(db, "posts", postId), { status: status });
        const postSnap = await getDoc(doc(db, "posts", postId));
        appFeatures.notify(postSnap.data().authorId, `Your post was ${status} by admin.`, 'post', postId);
        ui.showToast(`Post ${status}`, 'success'); 
        appAdmin.renderPending();
    },
    renderUsers: async () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = 'Loading...';
        const snap = await getDocs(collection(db, "users"));
        area.innerHTML = '<h4>Manage Users</h4>';
        
        snap.forEach(docSnap => {
            const u = { id: docSnap.id, ...docSnap.data() };
            let tools = '';
            tools += `<button onclick="appAdmin.toggleVerify('${u.id}', ${u.verified})" class="btn-outline" style="padding:4px 8px; font-size:0.75rem;">${u.verified ? 'Unverify' : 'Verify'}</button> `;
            tools += `<button onclick="appAdmin.addFakeFollowers('${u.id}', ${u.fakeFollowers || 0})" class="btn-outline" style="padding:4px 8px; font-size:0.75rem;">+ Followers</button> `;
            
            if (u.id !== currentUser.id) {
                const blockColor = u.isBlocked ? 'var(--success)' : 'var(--danger)';
                const blockText = u.isBlocked ? 'Unblock' : 'Block';
                tools += `<button onclick="appAdmin.toggleBlock('${u.id}', ${u.isBlocked})" class="btn-outline" style="color:${blockColor}; border-color:${blockColor}; padding:4px 8px; font-size:0.75rem;">${blockText}</button> `;
                tools += `<button onclick="appAdmin.deleteUser('${u.id}')" class="btn-outline" style="color:var(--text-muted); padding:4px 8px; font-size:0.75rem;">Delete</button> `;
            }
            
            const blockedTag = u.isBlocked ? `<span class="badge" style="position:static; background:var(--danger)">Blocked</span>` : '';
            const folCount = u.followers ? u.followers.length : 0;

            area.innerHTML += `<div class="card" style="padding:12px; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="cursor:pointer" onclick="appFeatures.viewUserProfile('${u.id}')">${sanitize(u.username)} ${getVerifiedIcon(u.verified)}</strong>
                    <div>${blockedTag} <span class="badge" style="position:static; background:var(--text-muted)">${u.role}</span></div>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted);">Real Fol: ${folCount} | Added: ${u.fakeFollowers || 0}</div>
                <div style="display:flex; gap:5px; margin-top:8px;">${tools}</div>
            </div>`;
        });
    },
    toggleVerify: async (userId, currentStatus) => {
        await updateDoc(doc(db, "users", userId), { verified: !currentStatus });
        ui.showToast(`User verification updated`, 'success');
        appAdmin.renderUsers();
    },
    addFakeFollowers: async (userId, currentFake) => {
        const amount = prompt("Enter number of followers to add:", "1000");
        if(amount === null || isNaN(amount) || amount === "") return;
        await updateDoc(doc(db, "users", userId), { fakeFollowers: currentFake + parseInt(amount) });
        ui.showToast(`Added followers`, 'success');
        appAdmin.renderUsers();
    },
    toggleBlock: async (userId, currentStatus) => {
        await updateDoc(doc(db, "users", userId), { isBlocked: !currentStatus });
        appFeatures.notify(userId, !currentStatus ? "Your account has been restricted by the Admin." : "Your account block was lifted.", 'none', null);
        ui.showToast(`User block status updated`, 'success');
        appAdmin.renderUsers();
    },
    deleteUser: async (userId) => {
        if (!confirm("Delete user AND their posts?")) return;
        await deleteDoc(doc(db, "users", userId));
        ui.showToast("User deleted", "success"); 
        appAdmin.renderUsers();
    },
    renderReports: async () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = 'Loading...';
        const snap = await getDocs(query(collection(db, "reports"), orderBy("time", "desc")));
        area.innerHTML = '<h4>User Reports / Bugs</h4>';
        if(snap.empty) return area.innerHTML += '<p>No reports found.</p>';
        
        snap.forEach(docSnap => {
            const r = { id: docSnap.id, ...docSnap.data() };
            const replyStatus = r.adminReply ? `<span style="color:var(--success); font-size:0.8rem;">(Replied)</span>` : '';
            
            area.innerHTML += `<div class="card" style="padding:10px;">
                <strong>By: ${r.username}</strong> ${replyStatus} <small style="float:right">${timeAgo(r.time)}</small>
                <p class="mt-1" style="background:var(--bg-color); padding:10px; border-radius:8px;">${sanitize(r.text)}</p>
                
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button class="btn-outline" style="color:var(--secondary); border-color:var(--secondary); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.replyReport('${r.id}', '${r.uId}')">Reply</button>
                    <button class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.deleteReport('${r.id}')">Dismiss</button>
                </div>
            </div>`;
        });
    },
    replyReport: async (reportId, userId) => {
        const reply = prompt("Enter your reply to this user:");
        if(reply) {
            await updateDoc(doc(db, "reports", reportId), { adminReply: reply });
            appFeatures.notify(userId, "Admin replied to your bug report. Tap to view.", 'report', null);
            ui.showToast('Reply sent', 'success');
            appAdmin.renderReports();
        }
    },
    deleteReport: async (id) => {
        await deleteDoc(doc(db, "reports", id));
        ui.showToast('Report dismissed', 'success'); appAdmin.renderReports();
    },
    renderAppeals: async () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = 'Loading...';
        const snap = await getDocs(query(collection(db, "appeals"), orderBy("time", "desc")));
        area.innerHTML = '<h4>Account Block Appeals</h4>';
        if(snap.empty) return area.innerHTML += '<p>No pending appeals.</p>';
        
        snap.forEach(docSnap => {
            const app = { id: docSnap.id, ...docSnap.data() };
            area.innerHTML += `<div class="card" style="padding:10px;">
                <strong>User: ${app.username}</strong> <small style="float:right">${timeAgo(app.time)}</small>
                <p class="mt-1" style="background:var(--bg-color); padding:10px; border-radius:8px;">${sanitize(app.text)}</p>
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button class="btn-outline" style="color:var(--success); border-color:var(--success); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.resolveAppeal('${app.id}', '${app.uId}', true)">Unblock</button>
                    <button class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.resolveAppeal('${app.id}', '${app.uId}', false)">Reject</button>
                </div>
            </div>`;
        });
    },
    resolveAppeal: async (appealId, userId, unblock) => {
        if(unblock) {
            await updateDoc(doc(db, "users", userId), { isBlocked: false });
            appFeatures.notify(userId, "Your appeal was approved. Your account is unblocked!");
        } else {
            appFeatures.notify(userId, "Your appeal was reviewed but rejected. You remain blocked.");
        }
        await deleteDoc(doc(db, "appeals", appealId));
        ui.showToast(unblock ? 'User unblocked' : 'Appeal rejected', 'success');
        appAdmin.renderAppeals();
    },
    renderAnnouncements: async () => {
        const area = document.getElementById('admin-content-area');
        area.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4>Manage Announcements</h4>
                <button class="btn-primary" style="width:auto; padding:6px 16px; font-size:0.8rem;" onclick="ui.showModal('announcement-modal')">+ Create New</button>
            </div><div id="ann-list">Loading...</div>`;
        
        const snap = await getDocs(collection(db, "announcements"));
        const list = document.getElementById('ann-list');
        list.innerHTML = '';
        const now = Date.now();
        let found = false;
        snap.forEach(docSnap => {
            const a = { id: docSnap.id, ...docSnap.data() };
            if ((now - a.time) < 86400000) {
                found = true;
                list.innerHTML += `<div class="card" style="padding:12px; margin-bottom:10px; border-left:4px solid var(--primary);">
                    <p>${sanitize(a.text)}</p>
                    <div style="display:flex; justify-content:space-between; margin-top:10px;">
                        <small style="color:var(--text-muted)">${timeAgo(a.time)}</small>
                        <button class="btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 10px; font-size:0.8rem;" onclick="appAdmin.deleteAnnouncement('${a.id}')">Delete</button>
                    </div>
                </div>`;
            }
        });
        if(!found) list.innerHTML = '<p>No active announcements.</p>';
    },
    deleteAnnouncement: async (id) => {
        if(!confirm("Delete announcement?")) return;
        await deleteDoc(doc(db, "announcements", id));
        ui.showToast("Announcement deleted", "success"); 
        appAdmin.renderAnnouncements(); 
    },
    postAnnouncement: async () => {
        const text = document.getElementById('announcement-text').value.trim();
        if(!text) return ui.showToast("Cannot be empty", "error");
        await addDoc(collection(db, "announcements"), { text: text, time: Date.now() });
        
        // Notify all users (Basic implementation)
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach(u => appFeatures.notify(u.id, "New Admin Announcement."));
        
        document.getElementById('announcement-text').value = '';
        ui.hideModal('announcement-modal'); 
        ui.showToast('Sent to all!', 'success'); 
        appAdmin.renderAnnouncements();
    }
};

// --- 8. START APP ---
document.addEventListener('DOMContentLoaded', () => {
    if(currentUser) {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
        if(currentUser.role === 'admin') document.getElementById('admin-btn').style.display = 'block';
        appFeatures.renderFeed();
        
        // Check real-time blocked status
        onSnapshot(doc(db, "users", currentUser.id), (docSnap) => {
            if(docSnap.exists() && docSnap.data().isBlocked !== currentUser.isBlocked) {
                currentUser.isBlocked = docSnap.data().isBlocked;
                localStorage.setItem('st_session', JSON.stringify(currentUser));
                if(currentUser.isBlocked) ui.showToast('Your account was just blocked by Admin', 'error');
            }
        });
    }
});
