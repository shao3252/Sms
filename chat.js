import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, 
    doc, query, orderBy, onSnapshot, deleteDoc, limit, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// FIREBASE CONFIGURATION (Zile zile za mwanzo)
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

// SOMA SESSION KUTOKA LOCAL STORAGE (Ili usihitaji kulogin tena)
let currentUser = JSON.parse(localStorage.getItem('st_session'));
let isGroupOpen = true;

// Kama hajalogin, mrudishe index.html
if (!currentUser) {
    window.location.href = 'index.html';
}

const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
const getVerifiedIcon = (v) => v ? `<span class="verified-badge">✓</span>` : '';

window.chatSystem = {
    init: async () => {
        // Show admin controls if user is admin
        if(currentUser.role === 'admin') {
            document.getElementById('admin-group-controls').style.display = 'flex';
        }

        // 1. Check Group Status (Open or Locked by Admin)
        const groupRef = doc(db, "system", "group_settings");
        onSnapshot(groupRef, (snap) => {
            if(snap.exists()) {
                isGroupOpen = snap.data().isOpen;
                const badge = document.getElementById('group-state-badge');
                if(isGroupOpen) {
                    badge.innerText = "Open";
                    badge.className = "group-status";
                    document.getElementById('chat-msg-input').disabled = false;
                    document.getElementById('chat-msg-input').placeholder = "Type a message...";
                } else {
                    badge.innerText = "Locked";
                    badge.className = "group-status closed";
                    document.getElementById('chat-msg-input').disabled = true;
                    document.getElementById('chat-msg-input').placeholder = "Admin has locked the group.";
                }
            } else {
                // Create settings file if it doesn't exist
                if(currentUser.role === 'admin') setDoc(groupRef, { isOpen: true });
            }
        });

        // 2. Load Global Messages
        const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"), limit(100)); // Limit to save costs!
        onSnapshot(q, (snap) => {
            const box = document.getElementById('global-chat-box');
            box.innerHTML = '';
            
            if(snap.empty) {
                box.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Welcome to the Global Group! Say Hi 👋</p>';
                return;
            }

            snap.forEach(docSnap => {
                const msg = { id: docSnap.id, ...docSnap.data() };
                const isMine = msg.uId === currentUser.id;
                const adminDeleteBtn = (currentUser.role === 'admin' || isMine) ? 
                    `<button style="position:absolute; top:-5px; right:-5px; background:var(--danger); color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:10px; cursor:pointer;" onclick="chatSystem.deleteMsg('${msg.id}')">X</button>` : '';

                box.innerHTML += `
                    <div style="display:flex; flex-direction:column; margin-bottom:10px; position:relative;">
                        <small style="font-size:0.7rem; color:var(--text-muted); margin-left:${isMine ? 'auto' : '10px'};">${isMine ? 'You' : sanitize(msg.username)} ${getVerifiedIcon(msg.verified)}</small>
                        <div class="msg-bubble ${isMine ? 'msg-mine' : 'msg-others'}">
                            ${sanitize(msg.text)}
                            ${adminDeleteBtn}
                        </div>
                    </div>
                `;
            });
            // Auto scroll to bottom
            box.scrollTop = box.scrollHeight;
        });
    },

    sendGlobalMessage: async () => {
        if(currentUser.isBlocked) return alert("Your account is restricted.");
        if(!isGroupOpen && currentUser.role !== 'admin') return alert("Group is currently locked by Admin.");

        const input = document.getElementById('chat-msg-input');
        const text = input.value.trim();
        if(!text) return;

        input.value = ''; // clear instantly for good UX

        await addDoc(collection(db, "global_chat"), {
            uId: currentUser.id,
            username: currentUser.username,
            verified: currentUser.verified || false,
            text: text,
            timestamp: Date.now()
        });
    },

    deleteMsg: async (msgId) => {
        if(confirm("Delete this message?")) {
            await deleteDoc(doc(db, "global_chat", msgId));
        }
    },

    toggleGroupStatus: async () => {
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, { isOpen: !isGroupOpen });
    }
};

// Listen for Enter key to send message
document.getElementById('chat-msg-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        chatSystem.sendGlobalMessage();
    }
});

// Start Chat System
document.addEventListener('DOMContentLoaded', () => {
    chatSystem.init();
});
