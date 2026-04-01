import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, setDoc,
    doc, query, where, orderBy, onSnapshot, deleteDoc, arrayUnion, arrayRemove, getDoc,
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Enable Offline Mode
enableIndexedDbPersistence(db).catch(() => {});

let currentUser = JSON.parse(localStorage.getItem('st_session')) || null;
let currentFeedCategory = 'All';
let viewingUserId = null;
let currentCommentPostId = null;
window.systemSettings = { autoApprove: false };

// STRICT SPAM FILTER: Inazuia link yoyote na NAMBA yoyote (hata kama ni tarakimu moja)
const isSpamText = (text) => {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.(com|net|org|co|tz|me|io|info))/i;
    const digitRegex = /\d/; 
    return linkRegex.test(text) || digitRegex.test(text);
};

const translations = {
    sw: {
        welcomeSub: "Shiriki meseji tamu za mapenzi", loginHeader: "Ingia", regHeader: "Jisajili",
        loginBtn: "Ingia", regBtn: "Jisajili", noAccount: "Hauna akaunti?", haveAccount: "Tayari una akaunti?",
        navHome: "Nyumbani", navSearch: "Tafuta", navChat: "Chat", navAlerts: "Taarifa", navProfile: "Wasifu",
        draftTitle: "Andika Meseji", sendApprovalBtn: "Tuma", followingText: "Unaowafuata",
        followersText: "Wanaokufuata", editProfileBtn: "Badili Wasifu", myPostsTab: "Posti Zangu",
        likedTab: "Zilizopendwa", savedTab: "Zilizohifadhiwa", settingsTitle: "Mipangilio",
        toggleTheme: "🌓 Badili Muonekano", reportBugBtn: "🐞 Ripoti Tatizo", myReportsBtn: "📋 Ripoti Zangu",
        logoutBtn: "🚪 Toka", closeBtn: "Funga", pendingApproval: "Inasubiri Kukaguliwa",
        rejected: "Imekataliwa", approve: "Ruhusu", reject: "Kataa", share: "Shiriki", copy: "📋 Copy",
        deletePost: "Futa", editPost: "✏️ Edit", editCat: "✏️ Kundi", addLikes: "+ Likes",
        noPosts: "Hakuna posti kwenye kundi hili.", loading: "Inaload...", searching: "Inatafuta...",
        usersTitle: "Watumiaji", postsTitle: "Posti", noUsersFound: "Hakuna mtumiaji aliyepatikana.",
        noPostsFound: "Hakuna posti zilizopatikana.", catAll: "Yote", catSelect: "Chagua Kundi...",
        catApology: "Kuomba Msamaha", catPraise: "Kusifia", catSeductive: "Kuvutia", catOther: "Mengineyo"
    },
    en: {
        welcomeSub: "Share the sweetest love texts", loginHeader: "Login", regHeader: "Register",
        loginBtn: "Login", regBtn: "Register", noAccount: "Don't have an account?", haveAccount: "Already have an account?",
        navHome: "Home", navSearch: "Search", navChat: "Chat", navAlerts: "Alerts", navProfile: "Profile",
        draftTitle: "Draft a Love Text", sendApprovalBtn: "Post Message", followingText: "Following",
        followersText: "Followers", editProfileBtn: "Edit Profile", myPostsTab: "My Posts",
        likedTab: "Liked", savedTab: "Saved", settingsTitle: "Settings", toggleTheme: "🌓 Change Theme",
        reportBugBtn: "🐞 Report a Bug", myReportsBtn: "📋 My Bug Reports", logoutBtn: "🚪 Logout",
        closeBtn: "Close", pendingApproval: "Pending Approval", rejected: "Rejected", approve: "Approve",
        reject: "Reject", share: "Share", copy: "📋 Copy", deletePost: "Delete", editPost: "✏️ Edit",
        editCat: "✏️ Edit Cat", addLikes: "+ Likes", noPosts: "No posts found in this category.",
        loading: "Loading...", searching: "Searching...", usersTitle: "Users", postsTitle: "Posts",
        noUsersFound: "No users found.", noPostsFound: "No posts found.", catAll: "All", catSelect: "Select a Category...",
        catApology: "Apology messages", catPraise: "Messages of praise", catSeductive: "Seductive Messages", catOther: "Other"
    }
};

window.t = (key) => { const lang = localStorage.getItem('st_lang') || 'sw'; return translations[lang][key] || key; };
const getCategoryTranslation = (c) => t({'All':'catAll', 'Apology messages':'catApology', 'Messages of praise':'catPraise', 'Seductive Messages':'catSeductive', 'Other':'catOther'}[c] || 'catOther');
const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
const getVerifiedIcon = (v) => v ? `<span class="verified-badge">✓</span>` : '';
const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

window.ui = {
    showToast: (m, type = 'info') => {
        const c = document.getElementById('toast-container'); const tDiv = document.createElement('div');
        tDiv.className = `toast ${type}`; tDiv.innerText = m; c.appendChild(tDiv); setTimeout(() => tDiv.remove(), 3500);
    },
    toggleTheme: () => { const isDark = document.body.classList.toggle('dark'); localStorage.setItem('st_theme', isDark ? 'dark' : 'light'); },
    showModal: (id) => document.getElementById(id).classList.add('active'),
    hideModal: (id) => document.getElementById(id).classList.remove('active'),
    createFallingHeart: () => {
        const hearts = ['❤️', '💖', '💘', '💝', '💕', '🔥', '✨'];
        const heart = document.createElement('div'); heart.className = 'heart-fall'; heart.innerText = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = Math.random() * 100 + 'vw'; heart.style.animationDuration = (Math.random() * 5 + 5) + 's'; 
        document.body.appendChild(heart); setTimeout(() => heart.remove(), 10000);
    }
};

const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000); let i = s / 86400; if (i > 1) return Math.floor(i) + "d ago";
    i = s / 3600; if (i > 1) return Math.floor(i) + "h ago"; i = s / 60; if (i > 1) return Math.floor(i) + "m ago"; return "Just now";
};

// CHAT UNREAD BADGE
const checkNewMessages = () => {
    const lastSeen = parseInt(localStorage.getItem('st_chat_last_seen')) || 0;
    const q = query(collection(db, "global_chat"), where("timestamp", ">", lastSeen));
    onSnapshot(q, (snap) => {
        const badge = document.getElementById('chat-badge');
        if (badge) {
            if (!snap.empty && window.location.pathname.indexOf('chat.html') === -1) {
                badge.style.display = 'block'; badge.innerText = snap.size;
            } else { badge.style.display = 'none'; }
        }
    });
};

window.router = {
    navigate: (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navMap = { home: 0, search: 1, create: 2, notify: 3, profile: 4, 'my-reports': 4, 'single-post': 3 };
        if(navMap[viewId] !== undefined) document.querySelectorAll('.bottom-nav .nav-item')[navMap[viewId]].classList.add('active');
        if (viewId === 'home') appFeatures.renderFeed();
        if (viewId === 'profile') appFeatures.renderProfile();
        if (viewId === 'notify') appFeatures.renderNotifications();
        if (viewId === 'admin') appAdmin.renderPending();
        window.scrollTo(0,0);
    }
};

window.appAuth = {
    login: async () => {
        const email = document.getElementById('login-email').value.trim(); const pass = document.getElementById('login-pass').value;
        if (!email || !pass) return ui.showToast('Enter email and password', 'error');
        const snap = await getDocs(query(collection(db, "users"), where("email", "==", email), where("password", "==", pass)));
        if (!snap.empty) {
            const uDoc = snap.docs[0]; let uData = uDoc.data();
            if (uData.email === 'shaolindown3252@gmail.com' && uData.role !== 'admin') { await updateDoc(doc(db, "users", uDoc.id), { role: 'admin', verified: true }); uData.role = 'admin'; uData.verified = true; }
            currentUser = { id: uDoc.id, ...uData }; localStorage.setItem('st_session', JSON.stringify(currentUser)); location.reload();
        } else ui.showToast('Invalid Login', 'error');
    },
    register: async () => {
        const user = document.getElementById('reg-user').value.trim(); const email = document.getElementById('reg-email').value.trim(); const pass = document.getElementById('reg-pass').value;
        if (!user || !email || !pass) return ui.showToast('Fill all fields', 'error');
        const checkSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
        if(!checkSnap.empty) return ui.showToast('Email already in use', 'error');
        const isAdmin = email === 'shaolindown3252@gmail.com';
        await addDoc(collection(db, "users"), { username: user, email: email, password: pass, role: isAdmin ? "admin" : "user", verified: isAdmin, isBlocked: false, followers: [], following: [], bio: "", pic: "", fakeFollowers: 0 });
        ui.showToast('Success! Now Login', 'success'); appAuth.toggleAuth();
    },
    logout: () => { localStorage.removeItem('st_session'); location.reload(); },
    toggleAuth: () => {
        const l = document.getElementById('login-form'); const r = document.getElementById('register-form');
        l.style.display = l.style.display === 'none' ? 'block' : 'none'; r.style.display = r.style.display === 'none' ? 'block' : 'none';
    }
};

window.appFeatures = {
    changeLang: (lCode) => { localStorage.setItem('st_lang', lCode); location.reload(); },
    getUser: async (uId) => { const snap = await getDoc(doc(db, "users", uId)); return snap.exists() ? { id: snap.id, ...snap.data() } : { username: 'Unknown', pic: '', verified: false, followers: [], following: [] }; },
    createPost: async () => {
        if(currentUser.isBlocked) return ui.showToast('Account Restricted!', 'error');
        const text = document.getElementById('post-text').value.trim(); const cat = document.getElementById('post-category').value;
        if(!text || !cat) return ui.showToast('Select Category & Type Text', 'error');
        
        // ZUIA NAMBA NA LINK
        if(currentUser.role !== 'admin' && isSpamText(text)) return ui.showToast('Hauruhusiwi kuweka Namba au Link!', 'error');

        const uSnap = await getDoc(doc(db, "users", currentUser.id)); const freshUser = uSnap.data();
        const postStatus = window.systemSettings.autoApprove || freshUser.role === 'admin' ? 'approved' : 'pending';

        await addDoc(collection(db, "posts"), { authorId: currentUser.id, authorName: freshUser.username, authorPic: freshUser.pic || "", authorVerified: freshUser.verified || false, text: text, category: cat, status: postStatus, timestamp: Date.now(), likes: [], comments: [], fakeLikes: 0 });
        ui.showToast(postStatus === 'approved' ? 'Imepostiwa!' : 'Sent for Review', 'success');
        document.getElementById('post-text').value = ''; router.navigate('home');
    },
    editPost: async (pId) => {
        const pRef = doc(db, "posts", pId); const snap = await getDoc(pRef); if(!snap.exists()) return;
        const newText = prompt("Edit text:", snap.data().text);
        if(newText) {
            if(currentUser.role !== 'admin' && isSpamText(newText)) return ui.showToast('Hauruhusiwi kuweka Namba au Link!', 'error');
            await updateDoc(pRef, { text: newText.trim() }); ui.showToast('Updated', 'success'); router.navigate('home');
        }
    },
    sharePost: (encodedText) => { const text = decodeURIComponent(encodedText); window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + " \n\n- Kutoka Sms Tamu 💖")}`); },
    copyText: (encodedText) => { navigator.clipboard.writeText(decodeURIComponent(encodedText)).then(() => ui.showToast(t('copy')+' Success!', 'success')); },
    createPostHTML: (post, context = 'feed') => {
        const isLiked = post.likes && post.likes.includes(currentUser.id); const isSaved = currentUser.saved && currentUser.saved.includes(post.id);
        const isOwner = post.authorId === currentUser.id; const isAdmin = currentUser.role === 'admin';
        let statusBadge = post.status === 'pending' ? `<span class="post-status">${t('pendingApproval')}</span>` : (post.status === 'rejected' ? `<span class="post-status" style="background:#f8d7da; color:#721c24;">${t('rejected')}</span>` : '');
        let adminCatChanger = isAdmin ? `<span style="cursor:pointer; color:var(--secondary); margin-left:10px; font-size:0.75rem;" onclick="appAdmin.changeCategory('${post.id}')">${t('editCat')}</span>` : '';
        let html = `<div class="card" id="post-${post.id}"><div class="post-header"><img src="${post.authorPic || defaultAvatar}" class="avatar" onclick="appFeatures.viewUserProfile('${post.authorId}')"><div class="post-meta"><div class="post-author" onclick="appFeatures.viewUserProfile('${post.authorId}')">${sanitize(post.authorName)} ${getVerifiedIcon(post.authorVerified)}</div><div class="post-time">${timeAgo(post.timestamp)} ${statusBadge} <span class="post-cat-badge">${getCategoryTranslation(post.category)}</span> ${adminCatChanger}</div></div></div><div class="post-text">${sanitize(post.text)}</div>`;
        if (context === 'admin_queue') {
            html += `<div class="post-actions"><button class="btn-outline" style="color:var(--success); border-color:var(--success);" onclick="appAdmin.moderatePost('${post.id}', 'approved')">${t('approve')}</button><button class="btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="appAdmin.moderatePost('${post.id}', 'rejected')">${t('reject')}</button></div>`;
        } else {
            const lC = (post.likes ? post.likes.length : 0) + (post.fakeLikes || 0); const cC = post.comments ? post.comments.length : 0;
            html += `<div class="post-actions"><button class="action-btn ${isLiked ? 'active' : ''}" onclick="appFeatures.toggleLike('${post.id}')">❤️ ${lC}</button><button class="action-btn" onclick="appFeatures.openComments('${post.id}')">💬 ${cC}</button><button class="action-btn" onclick="appFeatures.copyText('${encodeURIComponent(post.text)}')">${t('copy')}</button><button class="action-btn" onclick="appFeatures.sharePost('${encodeURIComponent(post.text)}')">${t('share')}</button><button class="action-btn ${isSaved ? 'active' : ''}" onclick="appFeatures.toggleSave('${post.id}')">💾</button></div>`;
            if (isOwner || isAdmin) html += `<div class="mt-1" style="text-align:right;">${isAdmin ? `<button class="action-btn" style="display:inline; color:var(--secondary); margin-right:15px; font-weight:bold;" onclick="appAdmin.addFakeLikes('${post.id}', ${post.fakeLikes || 0})">${t('addLikes')}</button>` : ''}<button class="action-btn" style="display:inline; color:var(--primary); margin-right:15px; font-weight:bold;" onclick="appFeatures.editPost('${post.id}')">${t('editPost')}</button><button class="action-btn" style="display:inline; color:var(--danger)" onclick="appFeatures.deletePost('${post.id}')">${t('deletePost')}</button></div>`;
        }
        return html + `</div>`;
    },
    renderFeed: () => {
        onSnapshot(query(collection(db, "posts"), orderBy("timestamp", "desc")), (snap) => {
            const c = document.getElementById('feed-container'); if(!c) return; c.innerHTML = ''; let found = false;
            snap.forEach(d => { const p = { id: d.id, ...d.data() }; if(p.status === 'approved' && (currentFeedCategory === 'All' || p.category === currentFeedCategory)) { c.innerHTML += appFeatures.createPostHTML(p); found = true; } });
            if (!found) c.innerHTML = `<p style="text-align:center; color:var(--text-muted)">${t('noPostsFound')}</p>`;
        });
    },
    filterFeed: (cat) => { currentFeedCategory = cat; document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active')); event.target.classList.add('active'); appFeatures.renderFeed(); },
    toggleLike: async (pId) => { if(currentUser.isBlocked) return; const r = doc(db, "posts", pId); const s = await getDoc(r); if(s.exists() && s.data().likes && s.data().likes.includes(currentUser.id)) await updateDoc(r, { likes: arrayRemove(currentUser.id) }); else { await updateDoc(r, { likes: arrayUnion(currentUser.id) }); } },
    toggleSave: async (pId) => { const r = doc(db, "users", currentUser.id); if (!currentUser.saved) currentUser.saved = []; if (currentUser.saved.includes(pId)) { currentUser.saved = currentUser.saved.filter(id => id !== pId); await updateDoc(r, { saved: arrayRemove(pId) }); } else { currentUser.saved.push(pId); await updateDoc(r, { saved: arrayUnion(pId) }); } localStorage.setItem('st_session', JSON.stringify(currentUser)); appFeatures.renderFeed(); },
    deletePost: async (pId) => { if(confirm("Delete post?")) { await deleteDoc(doc(db, "posts", pId)); router.navigate('home'); } },
    openComments: async (pId) => { currentCommentPostId = pId; const s = await getDoc(doc(db, "posts", pId)); const l = document.getElementById('comments-list'); l.innerHTML = ''; if (s.exists() && s.data().comments) s.data().comments.forEach(c => { l.innerHTML += `<div class="comment-item" style="cursor:pointer" onclick="ui.hideModal('comment-modal'); appFeatures.viewUserProfile('${c.uId}')"><strong>${sanitize(c.username)} ${getVerifiedIcon(c.verified)}</strong>: ${sanitize(c.text)}</div>`; }); ui.showModal('comment-modal'); },
    addComment: async () => { if(currentUser.isBlocked) return; const i = document.getElementById('comment-input'); const text = i.value.trim(); if(!text) return; if(currentUser.role !== 'admin' && isSpamText(text)) return ui.showToast('No Links/Numbers', 'error'); await updateDoc(doc(db, "posts", currentCommentPostId), { comments: arrayUnion({ uId: currentUser.id, username: currentUser.username, verified: currentUser.verified || false, text: text, time: Date.now() }) }); i.value = ''; appFeatures.openComments(currentCommentPostId); },
    renderProfile: () => { document.getElementById('my-username').innerText = currentUser.username; document.getElementById('my-verified').innerHTML = getVerifiedIcon(currentUser.verified); document.getElementById('my-bio').innerText = currentUser.bio || "No bio yet."; document.getElementById('my-prof-pic').src = currentUser.pic || defaultAvatar; document.getElementById('my-followers').innerText = (currentUser.followers ? currentUser.followers.length : 0) + (currentUser.fakeFollowers || 0); document.getElementById('my-following').innerText = currentUser.following ? currentUser.following.length : 0; document.getElementById('edit-user').value = currentUser.username; document.getElementById('edit-bio').value = currentUser.bio || ""; appFeatures.loadProfilePosts('own'); },
    viewUserProfile: async (uId) => { if(uId === currentUser.id) return router.navigate('profile'); viewingUserId = uId; const u = await appFeatures.getUser(uId); document.getElementById('other-username').innerText = u.username; document.getElementById('other-verified').innerHTML = getVerifiedIcon(u.verified); document.getElementById('other-bio').innerText = u.bio || 'No bio yet.'; document.getElementById('other-prof-pic').src = u.pic || defaultAvatar; document.getElementById('other-followers').innerText = (u.followers ? u.followers.length : 0) + (u.fakeFollowers || 0); document.getElementById('follow-btn').innerText = currentUser.following && currentUser.following.includes(uId) ? 'Following' : 'Follow'; const c = document.getElementById('other-profile-posts'); c.innerHTML = ''; const snap = await getDocs(query(collection(db, "posts"), orderBy("timestamp", "desc"))); snap.forEach(d => { const p = {id: d.id, ...d.data()}; if(p.authorId === uId && p.status === 'approved') c.innerHTML += appFeatures.createPostHTML(p); }); router.navigate('other-profile'); },
    toggleFollow: async () => { if(currentUser.isBlocked || !viewingUserId) return; const myRef = doc(db, "users", currentUser.id); const tarRef = doc(db, "users", viewingUserId); if (!currentUser.following) currentUser.following = []; if(currentUser.following.includes(viewingUserId)) { await updateDoc(myRef, { following: arrayRemove(viewingUserId) }); await updateDoc(tarRef, { followers: arrayRemove(currentUser.id) }); currentUser.following = currentUser.following.filter(i => i !== viewingUserId); } else { await updateDoc(myRef, { following: arrayUnion(viewingUserId) }); await updateDoc(tarRef, { followers: arrayUnion(currentUser.id) }); currentUser.following.push(viewingUserId); appFeatures.notify(viewingUserId, `${currentUser.username} started following you.`, 'user', currentUser.id); } localStorage.setItem('st_session', JSON.stringify(currentUser)); appFeatures.viewUserProfile(viewingUserId); },
    saveProfile: async () => { const n = document.getElementById('edit-user').value.trim(); const b = document.getElementById('edit-bio').value.trim(); if(!n) return; await updateDoc(doc(db, "users", currentUser.id), { username: n, bio: b }); currentUser.username = n; currentUser.bio = b; localStorage.setItem('st_session', JSON.stringify(currentUser)); ui.hideModal('edit-profile-modal'); appFeatures.renderProfile(); },
    updateProfilePic: (e) => { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (ev) => { const i = new Image(); i.onload = async () => { const c = document.createElement('canvas'); const scale = 400/i.width; c.width = 400; c.height = i.height*scale; const ctx = c.getContext('2d'); ctx.drawImage(i, 0,0,c.width,c.height); const b64 = c.toDataURL('image/jpeg', 0.6); await updateDoc(doc(db, "users", currentUser.id), { pic: b64 }); currentUser.pic = b64; localStorage.setItem('st_session', JSON.stringify(currentUser)); appFeatures.renderProfile(); }; i.src = ev.target.result; }; r.readAsDataURL(f); },
    loadProfilePosts: async (type) => { document.querySelectorAll('.profile-tabs .tab').forEach(t => t.classList.remove('active')); if(event) event.target.classList.add('active'); const c = document.getElementById('profile-posts-container'); c.innerHTML = ''; const snap = await getDocs(query(collection(db, "posts"), orderBy("timestamp", "desc"))); snap.forEach(d => { const p = {id: d.id, ...d.data()}; if(p.status === 'approved' && ((type==='own'&&p.authorId===currentUser.id) || (type==='liked'&&p.likes&&p.likes.includes(currentUser.id)) || (type==='saved'&&currentUser.saved&&currentUser.saved.includes(p.id)))) c.innerHTML += appFeatures.createPostHTML(p); }); },
    search: async () => { const qT = document.getElementById('search-input').value.toLowerCase(); const r = document.getElementById('search-results'); if(!qT){ r.innerHTML = ''; return; } r.innerHTML = ''; const uS = await getDocs(collection(db, "users")); uS.forEach(d => { if(d.data().username.toLowerCase().includes(qT)) r.innerHTML += `<div class="card" onclick="appFeatures.viewUserProfile('${d.id}')">${d.data().username} ${getVerifiedIcon(d.data().verified)}</div>`; }); const pS = await getDocs(query(collection(db, "posts"), where("status", "==", "approved"))); pS.forEach(d => { const p = {id: d.id, ...d.data()}; if(p.text.toLowerCase().includes(qT)) r.innerHTML += appFeatures.createPostHTML(p); }); },
    renderAnnouncementsToFeed: async () => { const snap = await getDocs(query(collection(db, "announcements"), orderBy("time", "desc"))); const m = document.getElementById('announcement-marquee'); const b = document.getElementById('announcement-bar'); let t = []; snap.forEach(d => { if(Date.now() - d.data().time < 86400000) t.push(d.data().text); }); if(t.length > 0){ b.style.display='block'; m.innerText = "📢 "+t.join(" | 📢 "); } else b.style.display='none'; },
    notify: async (toId, text, type = 'none', linkId = null) => { await addDoc(collection(db, "notifications"), { to: toId, text: text, time: Date.now(), read: false, type: type, linkId: linkId }); },
    deleteNotification: async (notifId) => { await deleteDoc(doc(db, "notifications", notifId)); ui.showToast('Deleted', 'success'); },
    renderNotifications: () => { onSnapshot(query(collection(db, "notifications"), orderBy("time", "desc")), (snap) => { const c = document.getElementById('notify-container'); c.innerHTML = ''; let unread = 0; snap.forEach(d => { const n = {id: d.id, ...d.data()}; if(n.to === currentUser.id) { if(!n.read) unread++; c.innerHTML += `<div class="card" style="opacity:${n.read?'0.7':'1'}"><div onclick="appFeatures.handleNotificationClick('${n.type}', '${n.linkId}', '${n.id}')">${sanitize(n.text)} <small>${timeAgo(n.time)}</small></div><button class="btn-outline mt-1" onclick="appFeatures.deleteNotification('${n.id}')">Futa</button></div>`; } }); const b = document.getElementById('notif-badge'); if(b) { b.style.display = unread > 0 ? 'block' : 'none'; b.innerText = unread; } }); },
    handleNotificationClick: async (type, linkId, notifId) => { await updateDoc(doc(db, "notifications", notifId), { read: true }); if(type === 'user' && linkId) appFeatures.viewUserProfile(linkId); else if(type === 'post' && linkId) { const s = await getDoc(doc(db, "posts", linkId)); if(s.exists()) { document.getElementById('single-post-container').innerHTML = appFeatures.createPostHTML({id: s.id, ...s.data()}); router.navigate('single-post'); } } },
    openSettings: () => { document.getElementById('btn-appeal').style.display = currentUser.isBlocked ? 'block' : 'none'; ui.showModal('settings-modal'); }, 
    submitReport: async () => { const tInput = document.getElementById('bug-text').value.trim(); if(tInput) { await addDoc(collection(db, "reports"), { uId: currentUser.id, username: currentUser.username, text: tInput, time: Date.now(), adminReply: null }); ui.hideModal('bug-modal'); ui.showToast('Report submitted.', 'success'); } }, 
    renderMyReports: async () => { const l = document.getElementById('my-reports-list'); l.innerHTML = ''; const s = await getDocs(query(collection(db, "reports"), orderBy("time", "desc"))); s.forEach(d => { const r = d.data(); if(r.uId === currentUser.id) l.innerHTML += `<div class="card"><small>${timeAgo(r.time)}</small><p>${sanitize(r.text)}</p>${r.adminReply ? `<div style="background:var(--secondary); color:#fff; padding:10px; border-radius:8px; margin-top:10px;">Admin: ${sanitize(r.adminReply)}</div>` : '<div style="color:var(--text-muted); font-size:0.8rem; margin-top:10px;">Pending Review</div>'}</div>`; }); router.navigate('my-reports'); }, 
    submitAppeal: async () => { const text = document.getElementById('appeal-text').value.trim(); if(text) { await addDoc(collection(db, "appeals"), { uId: currentUser.id, username: currentUser.username, text: text, time: Date.now() }); ui.hideModal('appeal-modal'); ui.showToast('Appeal sent', 'success'); } }
};

// ROLES ZAKO ZOTE ZA ADMIN ZIMERUDI
window.appAdmin = {
    toggleAutoApprove: async () => {
        const newVal = !window.systemSettings.autoApprove;
        await setDoc(doc(db, "system", "app_settings"), { autoApprove: newVal }, { merge: true });
        ui.showToast(`Auto Approve turned ${newVal ? 'ON' : 'OFF'}`, 'success');
    },
    addFakeLikes: async (postId, currentFake) => {
        const amount = prompt("Enter number of likes to add:", "100");
        if(amount) { await updateDoc(doc(db, "posts", postId), { fakeLikes: currentFake + parseInt(amount) }); ui.showToast('Added likes', 'success'); appFeatures.renderFeed(); }
    },
    changeCategory: async (postId) => {
        const newCat = prompt(`Enter category name:`);
        if(newCat) { await updateDoc(doc(db, "posts", postId), { category: newCat }); ui.showToast('Category updated', 'success'); }
    },
    renderPending: async () => {
        const area = document.getElementById('admin-content-area'); area.innerHTML = '<h4>Pending Posts</h4>';
        const snap = await getDocs(query(collection(db, "posts"), orderBy("timestamp", "desc")));
        snap.forEach(d => { const p = { id: d.id, ...d.data() }; if(p.status === 'pending') area.innerHTML += appFeatures.createPostHTML(p, 'admin_queue'); });
    },
    moderatePost: async (postId, status) => { await updateDoc(doc(db, "posts", postId), { status: status }); ui.showToast(`Post ${status}`, 'success'); appAdmin.renderPending(); },
    renderUsers: async () => {
        const area = document.getElementById('admin-content-area'); area.innerHTML = '<h4>Manage Users</h4>';
        const snap = await getDocs(collection(db, "users"));
        snap.forEach(d => {
            const u = { id: d.id, ...d.data() };
            area.innerHTML += `<div class="card" style="padding:12px;"><strong>${sanitize(u.username)}</strong> <span class="badge" style="position:static; background:var(--text-muted)">${u.role}</span><br><div style="display:flex; gap:5px; margin-top:8px;"><button onclick="appAdmin.toggleVerify('${u.id}', ${u.verified})" class="btn-outline" style="padding:4px 8px; font-size:0.75rem;">${u.verified ? 'Unverify' : 'Verify'}</button> <button onclick="appAdmin.addFakeFollowers('${u.id}', ${u.fakeFollowers || 0})" class="btn-outline" style="padding:4px 8px; font-size:0.75rem;">+ Followers</button> ${u.id !== currentUser.id ? `<button onclick="appAdmin.toggleBlock('${u.id}', ${u.isBlocked})" class="btn-outline" style="padding:4px 8px; font-size:0.75rem; color:${u.isBlocked?'var(--success)':'var(--danger)'}; border-color:${u.isBlocked?'var(--success)':'var(--danger)'};">${u.isBlocked ? 'Unblock' : 'Block'}</button> <button onclick="appAdmin.deleteUser('${u.id}')" class="btn-outline" style="padding:4px 8px; font-size:0.75rem; color:var(--text-muted);">Delete</button>` : ''}</div></div>`;
        });
    },
    toggleVerify: async (userId, currentStatus) => { await updateDoc(doc(db, "users", userId), { verified: !currentStatus }); ui.showToast('Verified updated', 'success'); appAdmin.renderUsers(); },
    addFakeFollowers: async (userId, currentFake) => { const amount = prompt("Add followers:", "1000"); if(amount) { await updateDoc(doc(db, "users", userId), { fakeFollowers: currentFake + parseInt(amount) }); ui.showToast('Added followers', 'success'); appAdmin.renderUsers(); } },
    toggleBlock: async (userId, currentStatus) => { await updateDoc(doc(db, "users", userId), { isBlocked: !currentStatus }); ui.showToast('Block status updated', 'success'); appAdmin.renderUsers(); },
    deleteUser: async (userId) => { if(confirm("Delete user?")) { await deleteDoc(doc(db, "users", userId)); ui.showToast("User deleted", "success"); appAdmin.renderUsers(); } },
    renderReports: async () => {
        const area = document.getElementById('admin-content-area'); area.innerHTML = '<h4>User Reports</h4>';
        const snap = await getDocs(query(collection(db, "reports"), orderBy("time", "desc")));
        snap.forEach(d => { const r = { id: d.id, ...d.data() }; area.innerHTML += `<div class="card"><strong>${r.username}</strong><p>${sanitize(r.text)}</p><button class="btn-outline mt-1" onclick="appAdmin.replyReport('${r.id}', '${r.uId}')">Reply</button> <button class="btn-outline mt-1" style="color:var(--danger);" onclick="appAdmin.deleteReport('${r.id}')">Dismiss</button></div>`; });
    },
    replyReport: async (reportId, userId) => { const reply = prompt("Enter reply:"); if(reply) { await updateDoc(doc(db, "reports", reportId), { adminReply: reply }); ui.showToast('Reply sent', 'success'); appAdmin.renderReports(); } },
    deleteReport: async (id) => { await deleteDoc(doc(db, "reports", id)); ui.showToast('Report dismissed', 'success'); appAdmin.renderReports(); },
    renderAppeals: async () => {
        const area = document.getElementById('admin-content-area'); area.innerHTML = '<h4>Appeals</h4>';
        const snap = await getDocs(query(collection(db, "appeals"), orderBy("time", "desc")));
        snap.forEach(d => { const app = { id: d.id, ...d.data() }; area.innerHTML += `<div class="card"><strong>${app.username}</strong><p>${sanitize(app.text)}</p><button class="btn-outline mt-1" style="color:var(--success)" onclick="appAdmin.resolveAppeal('${app.id}', '${app.uId}', true)">Unblock</button> <button class="btn-outline mt-1" style="color:var(--danger)" onclick="appAdmin.resolveAppeal('${app.id}', '${app.uId}', false)">Reject</button></div>`; });
    },
    resolveAppeal: async (appealId, userId, unblock) => { if(unblock) await updateDoc(doc(db, "users", userId), { isBlocked: false }); await deleteDoc(doc(db, "appeals", appealId)); ui.showToast(unblock ? 'Unblocked' : 'Rejected', 'success'); appAdmin.renderAppeals(); },
    renderAnnouncements: async () => {
        const area = document.getElementById('admin-content-area'); area.innerHTML = `<h4>Announcements</h4><button class="btn-primary mt-1" onclick="ui.showModal('announcement-modal')">+ New</button><div id="ann-list" class="mt-1"></div>`;
        const list = document.getElementById('ann-list'); const snap = await getDocs(query(collection(db, "announcements"), orderBy("time", "desc")));
        snap.forEach(d => { const a = { id: d.id, ...d.data() }; list.innerHTML += `<div class="card"><p>${sanitize(a.text)}</p><button class="btn-outline mt-1" style="color:var(--danger);" onclick="appAdmin.deleteAnnouncement('${a.id}')">Delete</button></div>`; });
    },
    deleteAnnouncement: async (id) => { if(confirm("Delete?")) { await deleteDoc(doc(db, "announcements", id)); ui.showToast("Deleted", "success"); appAdmin.renderAnnouncements(); } },
    postAnnouncement: async () => { const text = document.getElementById('announcement-text').value.trim(); if(text) { await addDoc(collection(db, "announcements"), { text: text, time: Date.now() }); ui.hideModal('announcement-modal'); ui.showToast('Sent!', 'success'); appAdmin.renderAnnouncements(); } }
};

document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('st_theme') === 'dark') document.body.classList.add('dark');
    
    // Kurudi kwenye profile kutokea kwenye group
    const viewUser = localStorage.getItem('st_view_user');
    
    if(currentUser) {
        document.getElementById('auth-screen').classList.remove('active'); document.getElementById('main-screen').classList.add('active');
        if(currentUser.role === 'admin') document.getElementById('admin-btn').style.display = 'block';
        
        appFeatures.renderFeed(); appFeatures.renderAnnouncementsToFeed(); 
        setInterval(ui.createFallingHeart, 1500); 
        checkNewMessages();
        
        onSnapshot(doc(db, "system", "app_settings"), (snap) => {
            if(snap.exists()) {
                window.systemSettings = snap.data();
                const stText = document.getElementById('auto-app-status-text');
                if(stText) { stText.innerText = window.systemSettings.autoApprove ? 'ON' : 'OFF'; stText.style.color = window.systemSettings.autoApprove ? 'var(--success)' : 'var(--danger)'; }
            }
        });
        
        if(viewUser) { localStorage.removeItem('st_view_user'); setTimeout(() => appFeatures.viewUserProfile(viewUser), 500); }
    }
});
