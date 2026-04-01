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
    appId: "1:928000331591:web:d71a658eb34feeea620662"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Offline Mode
enableIndexedDbPersistence(db).catch(() => {});

let currentUser = JSON.parse(localStorage.getItem('st_session')) || null;
let currentFeedCategory = 'All';
let viewingUserId = null;
let currentCommentPostId = null;

// Settings za Kawaida za App
window.systemSettings = { 
    autoApprove: false,
    premiumPrice: "3000",
    paymentMethods: [{ network: "Vodacom", number: "255799178372", name: "Gumba Gumba" }]
};

// ANTI-SPAM: Haturuhusu tarakimu hata moja wala Links
const isSpamText = (text) => {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.(com|net|org|co|tz|me|io|info))/i;
    const digitRegex = /\d/; 
    return linkRegex.test(text) || digitRegex.test(text);
};

// Translation Basic (Kiswahili)
window.t = (key) => { 
    const map = {
        'catAll': 'Yote',
        'catApology': 'Kuomba Msamaha',
        'catPraise': 'Kusifia',
        'catSeductive': 'Kuvutia',
        'catOther': 'Mengineyo',
        'pendingApproval': 'Inasubiri Kukaguliwa',
        'rejected': 'Imekataliwa',
        'noPostsFound': 'Hakuna posti zilizopatikana.',
        'loading': 'Inapakia...'
    };
    return map[key] || key; 
};

const getCategoryTranslation = (c) => {
    if(c === 'Message Kuntu') return '🌟 VIP Kuntu';
    const map = {
        'All': 'catAll', 
        'Apology messages': 'catApology', 
        'Messages of praise': 'catPraise', 
        'Seductive Messages': 'catSeductive', 
        'Other': 'catOther'
    };
    return window.t(map[c] || 'catOther');
};

const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
const getVerifiedIcon = (v) => v ? `<span class="verified-badge">✓</span>` : '';
const getPremiumIcon = (p) => p ? `<span class="premium-badge" style="color:#d4af37; margin-left:5px;">🌟</span>` : '';
const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

window.ui = {
    showToast: (m, type = 'info') => { 
        const c = document.getElementById('toast-container'); 
        const tDiv = document.createElement('div'); 
        tDiv.className = `toast ${type}`; 
        tDiv.innerText = m; 
        c.appendChild(tDiv); 
        setTimeout(() => tDiv.remove(), 3500); 
    },
    toggleTheme: () => { 
        const isDark = document.body.classList.toggle('dark'); 
        localStorage.setItem('st_theme', isDark ? 'dark' : 'light'); 
    },
    showModal: (id) => {
        const modal = document.getElementById(id);
        if(modal) modal.classList.add('active');
    },
    hideModal: (id) => {
        const modal = document.getElementById(id);
        if(modal) modal.classList.remove('active');
    },
    createFallingHeart: () => { 
        const hearts = ['❤️', '💖', '💘', '💝', '💕', '🔥', '✨']; 
        const heart = document.createElement('div'); 
        heart.className = 'heart-fall'; 
        heart.innerText = hearts[Math.floor(Math.random() * hearts.length)]; 
        heart.style.left = Math.random() * 100 + 'vw'; 
        heart.style.animationDuration = (Math.random() * 5 + 5) + 's'; 
        document.body.appendChild(heart); 
        setTimeout(() => heart.remove(), 10000); 
    }
};

const timeAgo = (ts) => { 
    const s = Math.floor((Date.now() - ts) / 1000); 
    let i = s / 86400; 
    if (i > 1) return Math.floor(i) + "d ago"; 
    i = s / 3600; 
    if (i > 1) return Math.floor(i) + "h ago"; 
    i = s / 60; 
    if (i > 1) return Math.floor(i) + "m ago"; 
    return "Hivi punde"; 
};

// CHECK CHAT UNREAD GREEN BADGE
const checkNewMessages = () => {
    const lastSeen = parseInt(localStorage.getItem('st_chat_last_seen')) || 0;
    const q = query(collection(db, "global_chat"), where("timestamp", ">", lastSeen));
    
    onSnapshot(q, (snap) => {
        const badge = document.getElementById('chat-badge');
        if (badge) {
            if (!snap.empty && window.location.pathname.indexOf('chat.html') === -1) {
                badge.style.display = 'block'; 
                badge.innerText = snap.size;
            } else { 
                badge.style.display = 'none'; 
            }
        }
    });
};

window.router = {
    navigate: (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const activeView = document.getElementById(`view-${viewId}`);
        if(activeView) activeView.classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        const navMap = { home: 0, search: 1, create: 2, notify: 3, profile: 4, 'my-reports': 4, 'single-post': 3 };
        if(navMap[viewId] !== undefined) {
            document.querySelectorAll('.bottom-nav .nav-item')[navMap[viewId]].classList.add('active');
        }
        
        if (viewId === 'home') appFeatures.renderFeed();
        if (viewId === 'profile') appFeatures.renderProfile();
        if (viewId === 'admin') appAdmin.renderPending();
        window.scrollTo(0,0);
    }
};

window.appAuth = {
    login: async () => {
        const email = document.getElementById('login-email').value.trim(); 
        const pass = document.getElementById('login-pass').value;
        if (!email || !pass) return ui.showToast('Ingiza email na password', 'error');
        
        const q = query(collection(db, "users"), where("email", "==", email), where("password", "==", pass));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const uDoc = snap.docs[0]; 
            let uData = uDoc.data();
            
            if (uData.email === 'shaolindown3252@gmail.com' && uData.role !== 'admin') { 
                await updateDoc(doc(db, "users", uDoc.id), { role: 'admin', verified: true, isPremium: true }); 
                uData.role = 'admin'; uData.verified = true; uData.isPremium = true;
            }
            
            currentUser = { id: uDoc.id, ...uData }; 
            localStorage.setItem('st_session', JSON.stringify(currentUser)); 
            location.reload();
        } else {
            ui.showToast('Login imefeli. Hakikisha taarifa zako.', 'error');
        }
    },
    
    register: async () => {
        const user = document.getElementById('reg-user').value.trim(); 
        const email = document.getElementById('reg-email').value.trim(); 
        const pass = document.getElementById('reg-pass').value;
        
        if (!user || !email || !pass) return ui.showToast('Jaza sehemu zote', 'error');
        
        const checkSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
        if(!checkSnap.empty) return ui.showToast('Email inatumika tayari', 'error');
        
        const isAdmin = email === 'shaolindown3252@gmail.com';
        
        await addDoc(collection(db, "users"), { 
            username: user, 
            email: email, 
            password: pass, 
            role: isAdmin ? "admin" : "user", 
            verified: isAdmin, 
            isPremium: isAdmin, 
            isBlocked: false, 
            followers: [], 
            following: [], 
            blockedUsers: [], 
            bio: "", 
            pic: "", 
            fakeFollowers: 0 
        });
        
        ui.showToast('Usajili umekamilika! Sasa ingia (Login).', 'success'); 
        appAuth.toggleAuth();
    },
    
    logout: () => { 
        localStorage.removeItem('st_session'); 
        location.reload(); 
    },
    
    toggleAuth: () => { 
        const l = document.getElementById('login-form'); 
        const r = document.getElementById('register-form'); 
        l.style.display = l.style.display === 'none' ? 'block' : 'none'; 
        r.style.display = r.style.display === 'none' ? 'block' : 'none'; 
    }
};

window.appFeatures = {
    changeLang: (lCode) => { 
        localStorage.setItem('st_lang', lCode); 
        location.reload(); 
    },
    
    getUser: async (uId) => { 
        const snap = await getDoc(doc(db, "users", uId)); 
        return snap.exists() ? { id: snap.id, ...snap.data() } : { username: 'Unknown', pic: '', verified: false, isPremium: false, followers: [], following: [], blockedUsers: [] }; 
    },
    
    createPost: async () => {
        if(currentUser.isBlocked) return ui.showToast('Akaunti Yako Imezuiwa!', 'error');
        
        const text = document.getElementById('post-text').value.trim(); 
        const cat = document.getElementById('post-category').value;
        if(!text || !cat) return ui.showToast('Chagua Kundi na uandike meseji', 'error');
        
        if(currentUser.role !== 'admin' && cat === 'Message Kuntu') {
            return ui.showToast('Admin pekee ndio anaruhusiwa kupost Kuntu!', 'error');
        }
        
        if(currentUser.role !== 'admin' && isSpamText(text)) {
            return ui.showToast('Hauruhusiwi kuweka Namba au Link yoyote!', 'error');
        }

        const uSnap = await getDoc(doc(db, "users", currentUser.id)); 
        const freshUser = uSnap.data();
        
        const postStatus = window.systemSettings.autoApprove || freshUser.role === 'admin' ? 'approved' : 'pending';

        await addDoc(collection(db, "posts"), { 
            authorId: currentUser.id, 
            authorName: freshUser.username, 
            authorPic: freshUser.pic || "", 
            authorVerified: freshUser.verified || false, 
            text: text, 
            category: cat, 
            status: postStatus, 
            timestamp: Date.now(), 
            likes: [], 
            comments: [], 
            fakeLikes: 0 
        });
        
        if(cat === 'Message Kuntu') {
            ui.showToast('Posti ya Kuntu imetumwa!', 'success');
            document.getElementById('post-text').value = '';
            window.location.href = 'premium.html';
        } else {
            ui.showToast(postStatus === 'approved' ? 'Imepostiwa Kikamilifu!' : 'Imetumwa Kusubiri Ukaguzi', 'success');
            document.getElementById('post-text').value = ''; 
            router.navigate('home');
        }
    },

    editPost: async (pId) => {
        const pRef = doc(db, "posts", pId); 
        const snap = await getDoc(pRef); 
        if(!snap.exists()) return;
        
        const newText = prompt("Hariri Meseji:", snap.data().text);
        if(newText) {
            if(currentUser.role !== 'admin' && isSpamText(newText)) {
                return ui.showToast('Hauruhusiwi kuweka Namba au Link!', 'error');
            }
            await updateDoc(pRef, { text: newText.trim() }); 
            ui.showToast('Imerekebishwa!', 'success'); 
            router.navigate('home');
        }
    },

    sharePost: async (encodedText) => {
        const text = decodeURIComponent(encodedText);
        const shareData = { 
            title: 'Sms Tamu 💖', 
            text: text + '\n\n- Kutoka Sms Tamu 💖\n(Soma zaidi: https://shao3252.github.io/Sms/)' 
        };
        
        if (navigator.share && navigator.canShare(shareData)) {
            try { 
                await navigator.share(shareData); 
            } catch (err) { 
                console.log('User canceled share'); 
            }
        } else {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.text)}`);
        }
    },

    copyText: (encodedText) => { 
        navigator.clipboard.writeText(decodeURIComponent(encodedText)).then(() => {
            ui.showToast('Imecopyiwa!', 'success');
        }); 
    },
    
    createPostHTML: (post, context = 'feed') => {
        const isLiked = post.likes && post.likes.includes(currentUser.id); 
        const isSaved = currentUser.saved && currentUser.saved.includes(post.id);
        const isOwner = post.authorId === currentUser.id; 
        const isAdmin = currentUser.role === 'admin';
        
        let statusBadge = post.status === 'pending' ? `<span class="post-status">${window.t('pendingApproval')}</span>` : (post.status === 'rejected' ? `<span class="post-status" style="background:#f8d7da; color:#721c24;">${window.t('rejected')}</span>` : '');
        let adminCatChanger = isAdmin ? `<span style="cursor:pointer; color:var(--secondary); margin-left:10px; font-size:0.75rem;" onclick="appAdmin.changeCategory('${post.id}')">✏️ Kundi</span>` : '';
        
        let html = `
        <div class="card" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorPic || defaultAvatar}" class="avatar" onclick="appFeatures.viewUserProfile('${post.authorId}')">
                <div class="post-meta">
                    <div class="post-author" onclick="appFeatures.viewUserProfile('${post.authorId}')" style="cursor:pointer;">
                        ${sanitize(post.authorName)} ${getVerifiedIcon(post.authorVerified)}
                    </div>
                    <div class="post-time">
                        ${timeAgo(post.timestamp)} ${statusBadge} <span class="post-cat-badge">${getCategoryTranslation(post.category)}</span> ${adminCatChanger}
                    </div>
                </div>
            </div>
            <div class="post-text">${sanitize(post.text)}</div>
        `;
        
        if (context === 'admin_queue') {
            html += `
            <div class="post-actions">
                <button class="btn-outline" style="color:var(--success); border-color:var(--success);" onclick="appAdmin.moderatePost('${post.id}', 'approved')">Ruhusu (Approve)</button>
                <button class="btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="appAdmin.moderatePost('${post.id}', 'rejected')">Kataa (Reject)</button>
            </div>`;
        } else {
            const lC = (post.likes ? post.likes.length : 0) + (post.fakeLikes || 0); 
            const cC = post.comments ? post.comments.length : 0;
            
            html += `
            <div class="post-actions">
                <button class="action-btn ${isLiked ? 'active' : ''}" onclick="appFeatures.toggleLike('${post.id}')">❤️ ${lC}</button>
                <button class="action-btn" onclick="appFeatures.openComments('${post.id}')">💬 ${cC}</button>
                <button class="action-btn" onclick="appFeatures.copyText('${encodeURIComponent(post.text)}')">📋 Copy</button>
                <button class="action-btn" onclick="appFeatures.sharePost('${encodeURIComponent(post.text)}')">🚀 Share</button>
                <button class="action-btn ${isSaved ? 'active' : ''}" onclick="appFeatures.toggleSave('${post.id}')">💾 Save</button>
            </div>`;
            
            if (isOwner || isAdmin) {
                html += `
                <div class="mt-1" style="text-align:right;">
                    ${isAdmin ? `<button class="action-btn" style="display:inline; color:var(--secondary); margin-right:15px;" onclick="appAdmin.addFakeLikes('${post.id}', ${post.fakeLikes || 0})">+ Likes</button>` : ''}
                    <button class="action-btn" style="display:inline; color:var(--primary); margin-right:15px;" onclick="appFeatures.editPost('${post.id}')">✏️ Edit</button>
                    <button class="action-btn" style="display:inline; color:var(--danger)" onclick="appFeatures.deletePost('${post.id}')">🗑️ Futa</button>
                </div>`;
            }
        }
        return html + `</div>`;
    },

    renderFeed: () => {
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snap) => {
            const c = document.getElementById('feed-container'); 
            if(!c) return; 
            c.innerHTML = ''; 
            let found = false;
            
            const blocked = currentUser.blockedUsers || [];
            
            snap.forEach(d => { 
                const p = { id: d.id, ...d.data() }; 
                
                if (p.category === 'Message Kuntu') return;

                if(p.status === 'approved' && !blocked.includes(p.authorId)) {
                    if (currentFeedCategory === 'All' || p.category === currentFeedCategory) { 
                        c.innerHTML += appFeatures.createPostHTML(p); 
                        found = true; 
                    }
                } 
            });
            
            if (!found) {
                c.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px;">${window.t('noPostsFound')}</p>`;
            }
        });
    },

    filterFeed: (cat) => { 
        currentFeedCategory = cat; 
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active')); 
        if(event && event.target) event.target.classList.add('active'); 
        appFeatures.renderFeed(); 
    },
    
    toggleLike: async (pId) => { 
        if(currentUser.isBlocked) return; 
        const r = doc(db, "posts", pId); 
        const s = await getDoc(r); 
        
        if(s.exists() && s.data().likes && s.data().likes.includes(currentUser.id)) {
            await updateDoc(r, { likes: arrayRemove(currentUser.id) }); 
        } else { 
            await updateDoc(r, { likes: arrayUnion(currentUser.id) }); 
        } 
    },
    
    toggleSave: async (pId) => { 
        const r = doc(db, "users", currentUser.id); 
        if (!currentUser.saved) currentUser.saved = []; 
        
        if (currentUser.saved.includes(pId)) { 
            currentUser.saved = currentUser.saved.filter(id => id !== pId); 
            await updateDoc(r, { saved: arrayRemove(pId) }); 
        } else { 
            currentUser.saved.push(pId); 
            await updateDoc(r, { saved: arrayUnion(pId) }); 
        } 
        localStorage.setItem('st_session', JSON.stringify(currentUser)); 
        appFeatures.renderFeed(); 
    },
    
    deletePost: async (pId) => { 
        if(confirm("Uhakika unataka kufuta posti hii?")) { 
            await deleteDoc(doc(db, "posts", pId)); 
            router.navigate('home'); 
        } 
    },
    
    openComments: async (pId) => { 
        currentCommentPostId = pId; 
        const s = await getDoc(doc(db, "posts", pId)); 
        const l = document.getElementById('comments-list'); 
        l.innerHTML = ''; 
        
        if (s.exists() && s.data().comments) {
            const authorId = s.data().authorId; 
            
            s.data().comments.forEach((c, index) => { 
                const canDelete = currentUser.role === 'admin' || authorId === currentUser.id || c.uId === currentUser.id;
                const delBtn = canDelete ? `<button onclick="appFeatures.deleteComment('${pId}', ${index})" style="color:var(--danger); background:none; border:none; font-size:1.1rem; cursor:pointer;">🗑️</button>` : '';
                
                l.innerHTML += `
                <div class="comment-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
                    <div style="cursor:pointer; flex:1;" onclick="ui.hideModal('comment-modal'); appFeatures.viewUserProfile('${c.uId}')">
                        <strong>${sanitize(c.username)} ${getVerifiedIcon(c.verified)}</strong>: <br>
                        <span style="color:var(--text-muted); font-size:0.95rem;">${sanitize(c.text)}</span>
                    </div>
                    ${delBtn}
                </div>`; 
            }); 
        } else {
            l.innerHTML = "<p style='text-align:center;'>Hakuna comments bado.</p>";
        }
        ui.showModal('comment-modal'); 
    },

    deleteComment: async (pId, cIndex) => {
        if(!confirm("Futa comment hii?")) return;
        
        const pRef = doc(db, "posts", pId);
        const snap = await getDoc(pRef);
        
        if(snap.exists()) {
            let comments = snap.data().comments;
            comments.splice(cIndex, 1); 
            await updateDoc(pRef, { comments: comments });
            appFeatures.openComments(pId);
            ui.showToast('Comment imefutwa', 'success');
        }
    },

    addComment: async () => { 
        if(currentUser.isBlocked) return; 
        
        const i = document.getElementById('comment-input'); 
        const text = i.value.trim(); 
        if(!text) return; 
        
        if(currentUser.role !== 'admin' && isSpamText(text)) {
            return ui.showToast('Hauruhusiwi kuweka Link au Namba', 'error');
        }
        
        await updateDoc(doc(db, "posts", currentCommentPostId), { 
            comments: arrayUnion({ 
                uId: currentUser.id, 
                username: currentUser.username, 
                verified: currentUser.verified || false, 
                text: text, 
                time: Date.now() 
            }) 
        }); 
        
        i.value = ''; 
        appFeatures.openComments(currentCommentPostId); 
    },
    
    renderProfile: () => { 
        document.getElementById('my-username').innerText = currentUser.username; 
        document.getElementById('my-verified').innerHTML = getVerifiedIcon(currentUser.verified); 
        document.getElementById('my-premium').innerHTML = getPremiumIcon(currentUser.isPremium); 
        document.getElementById('my-bio').innerText = currentUser.bio || "No bio yet."; 
        document.getElementById('my-prof-pic').src = currentUser.pic || defaultAvatar; 
        document.getElementById('my-followers').innerText = (currentUser.followers ? currentUser.followers.length : 0) + (currentUser.fakeFollowers || 0); 
        document.getElementById('my-following').innerText = currentUser.following ? currentUser.following.length : 0; 
        document.getElementById('edit-user').value = currentUser.username; 
        document.getElementById('edit-bio').value = currentUser.bio || ""; 
        
        appFeatures.loadProfilePosts('own'); 
    },
    
    viewUserProfile: async (uId) => { 
        if(uId === currentUser.id) return router.navigate('profile'); 
        
        viewingUserId = uId; 
        const u = await appFeatures.getUser(uId); 
        
        document.getElementById('other-username').innerText = u.username; 
        document.getElementById('other-verified').innerHTML = getVerifiedIcon(u.verified); 
        document.getElementById('other-premium').innerHTML = getPremiumIcon(u.isPremium); 
        document.getElementById('other-bio').innerText = u.bio || 'No bio yet.'; 
        document.getElementById('other-prof-pic').src = u.pic || defaultAvatar; 
        document.getElementById('other-followers').innerText = (u.followers ? u.followers.length : 0) + (u.fakeFollowers || 0); 
        document.getElementById('follow-btn').innerText = currentUser.following && currentUser.following.includes(uId) ? 'Following' : 'Follow'; 
        
        const bBtn = document.getElementById('user-block-btn');
        if(currentUser.blockedUsers && currentUser.blockedUsers.includes(uId)) {
            bBtn.innerText = "Mfungulie (Unblock)"; 
            bBtn.style.color = "var(--success)"; 
            bBtn.style.borderColor = "var(--success)";
        } else {
            bBtn.innerText = "🚫 Block"; 
            bBtn.style.color = "var(--danger)"; 
            bBtn.style.borderColor = "var(--danger)";
        }

        const c = document.getElementById('other-profile-posts'); 
        c.innerHTML = '<p style="text-align:center;">Inapakia...</p>'; 
        
        const snap = await getDocs(query(collection(db, "posts"), orderBy("timestamp", "desc"))); 
        c.innerHTML = ''; 
        let found = false;
        
        snap.forEach(d => { 
            const p = {id: d.id, ...d.data()}; 
            if(p.authorId === uId && p.status === 'approved' && p.category !== 'Message Kuntu') { 
                c.innerHTML += appFeatures.createPostHTML(p); 
                found = true; 
            } 
        }); 
        
        if(!found) c.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Hakuna posti alizoweka.</p>`;
        
        router.navigate('other-profile'); 
    },

    toggleBlockUser: async () => {
        if(!viewingUserId) return;
        const myRef = doc(db, "users", currentUser.id);
        
        if(!currentUser.blockedUsers) currentUser.blockedUsers = [];
        
        if(currentUser.blockedUsers.includes(viewingUserId)) {
            currentUser.blockedUsers = currentUser.blockedUsers.filter(id => id !== viewingUserId);
            await updateDoc(myRef, { blockedUsers: arrayRemove(viewingUserId) });
            ui.showToast("Umemfungulia mtumiaji huyu.", "success");
        } else {
            currentUser.blockedUsers.push(viewingUserId);
            await updateDoc(myRef, { blockedUsers: arrayUnion(viewingUserId) });
            ui.showToast("Umemblock. Hutaona posti zake.", "info");
        }
        
        localStorage.setItem('st_session', JSON.stringify(currentUser));
        appFeatures.viewUserProfile(viewingUserId); 
        if(currentFeedCategory !== 'All') appFeatures.renderFeed(); 
    },

    toggleFollow: async () => { 
        if(currentUser.isBlocked || !viewingUserId) return; 
        
        const myRef = doc(db, "users", currentUser.id); 
        const tarRef = doc(db, "users", viewingUserId); 
        
        if (!currentUser.following) currentUser.following = []; 
        
        if(currentUser.following.includes(viewingUserId)) { 
            await updateDoc(myRef, { following: arrayRemove(viewingUserId) }); 
            await updateDoc(tarRef, { followers: arrayRemove(currentUser.id) }); 
            currentUser.following = currentUser.following.filter(i => i !== viewingUserId); 
        } else { 
            await updateDoc(myRef, { following: arrayUnion(viewingUserId) }); 
            await updateDoc(tarRef, { followers: arrayUnion(currentUser.id) }); 
            currentUser.following.push(viewingUserId); 
        } 
        
        localStorage.setItem('st_session', JSON.stringify(currentUser)); 
        appFeatures.viewUserProfile(viewingUserId); 
    },
    
    saveProfile: async () => { 
        const n = document.getElementById('edit-user').value.trim(); 
        const b = document.getElementById('edit-bio').value.trim(); 
        if(!n) return; 
        
        await updateDoc(doc(db, "users", currentUser.id), { username: n, bio: b }); 
        currentUser.username = n; currentUser.bio = b; 
        
        localStorage.setItem('st_session', JSON.stringify(currentUser)); 
        ui.hideModal('edit-profile-modal'); 
        appFeatures.renderProfile(); 
    },
    
    updateProfilePic: (e) => { 
        const f = e.target.files[0]; 
        if(!f) return; 
        
        const r = new FileReader(); 
        r.onload = (ev) => { 
            const i = new Image(); 
            i.onload = async () => { 
                const c = document.createElement('canvas'); 
                const scale = 400/i.width; 
                c.width = 400; 
                c.height = i.height*scale; 
                const ctx = c.getContext('2d'); 
                ctx.drawImage(i, 0,0,c.width,c.height); 
                const b64 = c.toDataURL('image/jpeg', 0.6); 
                
                await updateDoc(doc(db, "users", currentUser.id), { pic: b64 }); 
                currentUser.pic = b64; 
                localStorage.setItem('st_session', JSON.stringify(currentUser)); 
                appFeatures.renderProfile(); 
            }; 
            i.src = ev.target.result; 
        }; 
        r.readAsDataURL(f); 
    },
    
    loadProfilePosts: async (type) => { 
        document.querySelectorAll('.profile-tabs .tab').forEach(t => t.classList.remove('active')); 
        if(event && event.target) event.target.classList.add('active'); 
        
        const c = document.getElementById('profile-posts-container'); 
        c.innerHTML = '<p style="text-align:center;">Inapakia...</p>'; 
        
        const snap = await getDocs(query(collection(db, "posts"), orderBy("timestamp", "desc"))); 
        c.innerHTML = ''; 
        let found = false;
        const blocked = currentUser.blockedUsers || [];
        
        snap.forEach(d => { 
            const p = {id: d.id, ...d.data()}; 
            
            if(p.category === 'Message Kuntu') return;

            if(p.status === 'approved' && !blocked.includes(p.authorId)) {
                if((type==='own' && p.authorId===currentUser.id) || (type==='liked' && p.likes && p.likes.includes(currentUser.id)) || (type==='saved' && currentUser.saved && currentUser.saved.includes(p.id))) {
                    c.innerHTML += appFeatures.createPostHTML(p); 
                    found = true;
                }
            }
        }); 
        
        if(!found) {
            c.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Hakuna posti zilizopatikana.</p>`;
        }
    },
    
    search: async () => { 
        const qT = document.getElementById('search-input').value.toLowerCase(); 
        const r = document.getElementById('search-results'); 
        if(!qT){ r.innerHTML = ''; return; } 
        
        r.innerHTML = ''; 
        const blocked = currentUser.blockedUsers || []; 
        
        const uS = await getDocs(collection(db, "users")); 
        uS.forEach(d => { 
            if(d.data().username.toLowerCase().includes(qT) && !blocked.includes(d.id)) { 
                r.innerHTML += `
                <div class="card" style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="appFeatures.viewUserProfile('${d.id}')">
                    <img src="${d.data().pic || defaultAvatar}" class="avatar" style="width:40px; height:40px;">
                    <div>
                        <strong>${sanitize(d.data().username)} ${getVerifiedIcon(d.data().verified)}</strong>
                    </div>
                </div>`; 
            } 
        }); 
        
        const pS = await getDocs(query(collection(db, "posts"), where("status", "==", "approved"))); 
        pS.forEach(d => { 
            const p = {id: d.id, ...d.data()}; 
            if(p.text.toLowerCase().includes(qT) && p.category !== 'Message Kuntu' && !blocked.includes(p.authorId)) { 
                r.innerHTML += appFeatures.createPostHTML(p); 
            } 
        }); 
    },
    
    // FIX YA SETTINGS KUFUNGUKA VIZURI
    openSettings: () => { 
        const appealBtn = document.getElementById('btn-appeal');
        if(appealBtn) {
            appealBtn.style.display = currentUser.isBlocked ? 'block' : 'none'; 
        }
        ui.showModal('settings-modal'); 
    }, 
    
    submitReport: async () => { 
        const tInput = document.getElementById('bug-text').value.trim(); 
        if(tInput) { 
            await addDoc(collection(db, "reports"), { uId: currentUser.id, username: currentUser.username, text: tInput, time: Date.now(), adminReply: null }); 
            ui.hideModal('bug-modal'); 
            ui.showToast('Ripoti imetumwa kikamilifu.', 'success'); 
            document.getElementById('bug-text').value = '';
        } 
    }
};

window.appAdmin = {
    toggleAutoApprove: async () => { 
        const newVal = !window.systemSettings.autoApprove; 
        await setDoc(doc(db, "system", "app_settings"), { autoApprove: newVal }, { merge: true }); 
        ui.showToast(`Auto Approve imekuwa ${newVal ? 'ON' : 'OFF'}`, 'success'); 
    },
    
    changeCategory: async (postId) => { 
        const newCat = prompt(`Badilisha Kundi (Category):`); 
        if(newCat) { 
            await updateDoc(doc(db, "posts", postId), { category: newCat }); 
            ui.showToast('Kundi limebadilishwa', 'success'); 
            appFeatures.renderFeed();
        } 
    },
    
    renderPending: async () => { 
        const area = document.getElementById('admin-content-area'); 
        area.innerHTML = '<h4>Posti Zinasubiri Ukaguzi</h4>'; 
        
        const snap = await getDocs(query(collection(db, "posts"), orderBy("timestamp", "desc"))); 
        let found = false;
        snap.forEach(d => { 
            const p = { id: d.id, ...d.data() }; 
            if(p.status === 'pending') {
                area.innerHTML += appFeatures.createPostHTML(p, 'admin_queue'); 
                found = true;
            }
        }); 
        if(!found) area.innerHTML += "<p style='text-align:center;'>Hakuna posti zinazosubiri.</p>";
    },
    
    moderatePost: async (postId, status) => { 
        await updateDoc(doc(db, "posts", postId), { status: status }); 
        ui.showToast(`Posti ${status === 'approved' ? 'Imeruhusiwa' : 'Imekataliwa'}`, 'success'); 
        appAdmin.renderPending(); 
    },
    
    renderUsers: async () => {
        const area = document.getElementById('admin-content-area'); 
        area.innerHTML = '<h4>Udhibiti wa Watumiaji</h4>';
        
        const snap = await getDocs(collection(db, "users"));
        
        snap.forEach(docSnap => {
            const u = { id: docSnap.id, ...docSnap.data() };
            
            let tools = `
            <button onclick="appAdmin.toggleVerify('${u.id}', ${u.verified})" class="btn-outline" style="padding:6px 12px; font-size:0.8rem;">
                ${u.verified ? 'Toa Verify' : 'Verify (Tiki Bluu)'}
            </button>`;
            
            if (u.id !== currentUser.id) {
                tools += `
                <button onclick="appAdmin.toggleBlock('${u.id}', ${u.isBlocked})" class="btn-outline" style="color:${u.isBlocked?'var(--success)':'var(--danger)'}; border-color:${u.isBlocked?'var(--success)':'var(--danger)'}; padding:6px 12px; font-size:0.8rem;">
                    ${u.isBlocked?'Fungulia':'Block'}
                </button> 
                <button onclick="appAdmin.deleteUser('${u.id}')" class="btn-outline" style="color:var(--text-muted); padding:6px 12px; font-size:0.8rem;">
                    Futa Kabisa
                </button>`;
            }
            
            area.innerHTML += `
            <div class="card" style="padding:15px; margin-bottom:15px; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="appFeatures.viewUserProfile('${u.id}')">
                    <img src="${u.pic || defaultAvatar}" class="avatar" style="width:45px; height:45px;">
                    <div>
                        <strong style="font-size:1.1rem;">${sanitize(u.username)} ${getVerifiedIcon(u.verified)} ${getPremiumIcon(u.isPremium)}</strong>
                        <div style="font-size:0.8rem; color:var(--text-muted)">${sanitize(u.email)}</div>
                    </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">${tools}</div>
            </div>`;
        });
    },
    
    toggleVerify: async (userId, currentStatus) => { 
        const newStatus = !currentStatus;
        await updateDoc(doc(db, "users", userId), { verified: newStatus }); 
        
        // Update Posti zake zote Zipate Tiki
        const postsQuery = query(collection(db, "posts"), where("authorId", "==", userId));
        const postsSnap = await getDocs(postsQuery);
        postsSnap.forEach(async (docSnap) => {
            await updateDoc(doc(db, "posts", docSnap.id), { authorVerified: newStatus });
        });

        ui.showToast(`Mtumiaji amekuwa Verified`, 'success'); 
        appAdmin.renderUsers(); 
    },
    
    toggleBlock: async (userId, currentStatus) => { 
        await updateDoc(doc(db, "users", userId), { isBlocked: !currentStatus }); 
        ui.showToast('Block status imebadilika', 'success'); 
        appAdmin.renderUsers(); 
    },
    
    deleteUser: async (userId) => { 
        if(confirm("Delete user? Hutaweza kurudisha taarifa zake.")) { 
            await deleteDoc(doc(db, "users", userId)); 
            ui.showToast("Amefutwa kabisa", "success"); 
            appAdmin.renderUsers(); 
        } 
    },
    
    renderReports: async () => { 
        const area = document.getElementById('admin-content-area'); 
        area.innerHTML = '<h4>Ripoti za Watumiaji (Bug Reports)</h4>'; 
        
        const snap = await getDocs(query(collection(db, "reports"), orderBy("time", "desc"))); 
        let found = false;
        
        snap.forEach(d => { 
            found = true;
            const r = { id: d.id, ...d.data() }; 
            area.innerHTML += `
            <div class="card" style="margin-bottom:15px; border-left:4px solid var(--danger);">
                <strong style="color:var(--primary);">${sanitize(r.username)}</strong>
                <p style="margin:10px 0; background:var(--bg-color); padding:10px; border-radius:8px;">${sanitize(r.text)}</p>
                <div style="display:flex; gap:10px;">
                    <button class="btn-outline" onclick="appAdmin.replyReport('${r.id}', '${r.uId}')">Reply</button> 
                    <button class="btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="appAdmin.deleteReport('${r.id}')">Dismiss / Futa</button>
                </div>
            </div>`; 
        }); 
        
        if(!found) {
            area.innerHTML += "<p style='text-align:center;'>Hakuna ripoti mpya.</p>";
        }
    },
    
    replyReport: async (reportId, userId) => { 
        const reply = prompt("Andika majibu yako (Reply):"); 
        if(reply) { 
            await updateDoc(doc(db, "reports", reportId), { adminReply: reply }); 
            ui.showToast('Majibu yametumwa', 'success'); 
            appAdmin.renderReports(); 
        } 
    },
    
    deleteReport: async (id) => { 
        await deleteDoc(doc(db, "reports", id)); 
        ui.showToast('Ripoti Imefutwa', 'success'); 
        appAdmin.renderReports(); 
    },

    renderPremiumReq: async () => {
        const area = document.getElementById('admin-content-area'); 
        area.innerHTML = '<h4 style="color:#d4af37;">🌟 Maombi ya VIP (Message Kuntu)</h4>';
        
        const snap = await getDocs(query(collection(db, "premium_requests"), orderBy("timestamp", "desc")));
        let found = false;
        
        snap.forEach(d => {
            const req = { id: d.id, ...d.data() };
            if(req.status === 'pending') {
                found = true;
                area.innerHTML += `
                <div class="card" style="border: 2px solid #d4af37;">
                    <strong>User:</strong> ${sanitize(req.username)}<br>
                    <strong>Muamala/Jina:</strong> <span style="color:var(--primary); font-size:1.1rem;">${sanitize(req.transaction)}</span><br>
                    <small style="color:var(--text-muted);">${timeAgo(req.timestamp)}</small>
                    <div class="mt-1" style="display:flex; gap:10px;">
                        <button class="btn-primary" style="background:var(--success);" onclick="appAdmin.resolvePremium('${req.id}', '${req.uId}', true)">✅ Mpe VIP</button>
                        <button class="btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="appAdmin.resolvePremium('${req.id}', '${req.uId}', false)">❌ Kataa</button>
                    </div>
                </div>`;
            }
        });
        
        if(!found) area.innerHTML += '<p style="text-align:center;">Hakuna maombi mapya kwa sasa.</p>';
    },
    
    resolvePremium: async (reqId, userId, approve) => {
        if(approve) { 
            await updateDoc(doc(db, "users", userId), { isPremium: true }); 
        }
        await updateDoc(doc(db, "premium_requests", reqId), { status: approve ? 'approved' : 'rejected' });
        ui.showToast(approve ? 'Amekuwa VIP Kikamilifu' : 'Ombi Limekataliwa', 'success'); 
        appAdmin.renderPremiumReq();
    },

    renderPaymentSettings: () => {
        const area = document.getElementById('admin-content-area');
        let html = `<h4>Payment Methods (VIP)</h4>
        <div style="margin-bottom:15px;">
            <strong>VIP Price (Tsh):</strong> 
            <input type="number" id="admin-vip-price" value="${window.systemSettings.premiumPrice}" style="width:100px; display:inline-block; margin:0 10px;"> 
            <button class="btn-outline" onclick="appAdmin.saveVipPrice()">Hifadhi Bei</button>
        </div>
        
        <h5 style="margin-bottom:10px;">Namba za Malipo Zilizopo:</h5>
        <div id="pay-methods-list">`;
        
        window.systemSettings.paymentMethods.forEach((pm, index) => {
            html += `
            <div class="card" style="padding:10px; margin-bottom:10px;">
                <strong>${sanitize(pm.network)}</strong>: ${sanitize(pm.number)} (${sanitize(pm.name)}) 
                <button class="btn-outline" style="float:right; padding:4px 10px; color:var(--danger); border-color:var(--danger);" onclick="appAdmin.deletePaymentMethod(${index})">Futa</button>
            </div>`;
        });
        
        html += `
        </div>
        <div class="card" style="padding:15px; margin-top:20px; background:var(--bg-color);">
            <h6>Ongeza Namba Mpya</h6>
            <input type="text" id="new-pm-net" placeholder="Mtandao (Mf. Vodacom, Tigo)">
            <input type="text" id="new-pm-num" placeholder="Namba ya Simu">
            <input type="text" id="new-pm-name" placeholder="Jina la Usajili">
            <button class="btn-primary" onclick="appAdmin.addPaymentMethod()">Add Network</button>
        </div>`;
        
        area.innerHTML = html;
    },
    
    saveVipPrice: async () => {
        const p = document.getElementById('admin-vip-price').value;
        await setDoc(doc(db, "system", "app_settings"), { premiumPrice: p }, { merge: true });
        window.systemSettings.premiumPrice = p; 
        ui.showToast('Bei imebadilika kikamilifu', 'success');
    },
    
    addPaymentMethod: async () => {
        const net = document.getElementById('new-pm-net').value.trim(); 
        const num = document.getElementById('new-pm-num').value.trim(); 
        const name = document.getElementById('new-pm-name').value.trim();
        
        if(net && num && name) {
            window.systemSettings.paymentMethods.push({network: net, number: num, name: name});
            await setDoc(doc(db, "system", "app_settings"), { paymentMethods: window.systemSettings.paymentMethods }, { merge: true });
            appAdmin.renderPaymentSettings(); 
            ui.showToast('Namba imeongezwa', 'success');
        } else {
            ui.showToast('Jaza taarifa zote', 'error');
        }
    },
    
    deletePaymentMethod: async (index) => {
        if(confirm('Uhakika unataka kufuta namba hii?')) {
            window.systemSettings.paymentMethods.splice(index, 1);
            await setDoc(doc(db, "system", "app_settings"), { paymentMethods: window.systemSettings.paymentMethods }, { merge: true });
            appAdmin.renderPaymentSettings(); 
            ui.showToast('Namba imefutwa', 'success');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('st_theme') === 'dark') document.body.classList.add('dark');
    
    const viewUser = localStorage.getItem('st_view_user');
    
    if(currentUser) {
        document.getElementById('auth-screen').classList.remove('active'); 
        document.getElementById('main-screen').classList.add('active');
        
        if(currentUser.role === 'admin') {
            document.getElementById('admin-btn').style.display = 'block';
            document.getElementById('opt-premium').style.display = 'block'; 
        }
        
        appFeatures.renderFeed(); 
        setInterval(ui.createFallingHeart, 1500); 
        checkNewMessages();
        
        onSnapshot(doc(db, "system", "app_settings"), (snap) => {
            if(snap.exists()) {
                const data = snap.data();
                window.systemSettings.autoApprove = data.autoApprove || false;
                if(data.premiumPrice) window.systemSettings.premiumPrice = data.premiumPrice;
                if(data.paymentMethods) window.systemSettings.paymentMethods = data.paymentMethods;
                
                const stText = document.getElementById('auto-app-status-text');
                if(stText) { 
                    stText.innerText = window.systemSettings.autoApprove ? 'ON' : 'OFF'; 
                    stText.style.color = window.systemSettings.autoApprove ? 'var(--success)' : 'var(--danger)'; 
                }
            }
        });
        
        if(viewUser) { 
            localStorage.removeItem('st_view_user'); 
            setTimeout(() => appFeatures.viewUserProfile(viewUser), 500); 
        }
    }
});
