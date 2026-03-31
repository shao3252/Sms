import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, 
    doc, query, where, orderBy, onSnapshot, deleteDoc, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
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

// --- STATE ---
let currentUser = JSON.parse(localStorage.getItem('st_session')) || null;
let currentFeedCategory = 'All';

// --- UI HELPERS ---
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
    }
};

const sanitize = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const getVerifiedIcon = (v) => v ? `<span class="verified-badge">✓</span>` : '';
const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

// --- AUTHENTICATION ---
window.appAuth = {
    login: async () => {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        const q = query(collection(db, "users"), where("email", "==", email), where("password", "==", pass));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const user = snap.docs[0];
            currentUser = { id: user.id, ...user.data() };
            localStorage.setItem('st_session', JSON.stringify(currentUser));
            location.reload();
        } else { ui.showToast('Invalid Email or Password', 'error'); }
    },
    register: async () => {
        const user = document.getElementById('reg-user').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        if (!user || !email || !pass) return ui.showToast('Fill all fields', 'error');
        
        // Check if email exists
        const check = query(collection(db, "users"), where("email", "==", email));
        const checkSnap = await getDocs(check);
        if(!checkSnap.empty) return ui.showToast('Email already registered', 'error');

        await addDoc(collection(db, "users"), {
            username: user, email, password: pass, role: "user", verified: false,
            isBlocked: false, followers: [], following: [], bio: "", pic: "", fakeFollowers: 0
        });
        ui.showToast('Success! Now Login', 'success');
        appAuth.toggleAuth();
    },
    logout: () => { localStorage.removeItem('st_session'); location.reload(); },
    toggleAuth: () => {
        document.getElementById('login-form').style.display = document.getElementById('login-form').style.display === 'none' ? 'block' : 'none';
        document.getElementById('register-form').style.display = document.getElementById('register-form').style.display === 'none' ? 'block' : 'none';
    }
};

// --- CORE FEATURES ---
window.appFeatures = {
    createPost: async () => {
        if(currentUser.isBlocked) return ui.showToast('Blocked users cannot post.', 'error');
        const text = document.getElementById('post-text').value.trim();
        const cat = document.getElementById('post-category').value;
        if(!text || !cat) return ui.showToast('Select Category and write text', 'error');

        await addDoc(collection(db, "posts"), {
            authorId: currentUser.id, authorName: currentUser.username, text, category: cat,
            status: "pending", timestamp: Date.now(), likes: [], comments: []
        });
        ui.showToast('Sent to Admin for approval', 'success');
        document.getElementById('post-text').value = '';
    },
    renderFeed: () => {
        let q = query(collection(db, "posts"), where("status", "==", "approved"), orderBy("timestamp", "desc"));
        if(currentFeedCategory !== 'All') {
            q = query(collection(db, "posts"), where("status", "==", "approved"), where("category", "==", currentFeedCategory), orderBy("timestamp", "desc"));
        }
        
        onSnapshot(q, (snap) => {
            const container = document.getElementById('feed-container');
            container.innerHTML = snap.empty ? '<p style="text-align:center">No messages here yet.</p>' : '';
            snap.forEach(docSnap => {
                const post = docSnap.data();
                container.innerHTML += `
                <div class="card">
                    <div class="post-header">
                        <strong>${post.authorName}</strong> <span class="post-cat-badge">${post.category}</span>
                    </div>
                    <p>${sanitize(post.text)}</p>
                    <div class="post-actions" style="margin-top:10px; color:var(--text-muted); font-size:0.8rem;">
                        <span>❤️ ${post.likes.length}</span> <span>💬 ${post.comments.length}</span>
                    </div>
                </div>`;
            });
        });
    },
    filterFeed: (cat) => {
        currentFeedCategory = cat;
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        event.target.classList.add('active');
        appFeatures.renderFeed();
    }
};

// --- INITIALIZE ---
if(currentUser) {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    if(currentUser.role === 'admin') document.getElementById('admin-btn').style.display = 'block';
    appFeatures.renderFeed();
}
