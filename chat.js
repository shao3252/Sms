import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, 
    doc, query, orderBy, onSnapshot, deleteDoc, limit, setDoc 
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

let currentUser = JSON.parse(localStorage.getItem('st_session'));
let isGroupOpen = true;
let selectedMsg = null; // Inashikilia data ya meseji iliyokandamizwa
let pressTimer = null; // Timer ya Long Press

if (!currentUser) window.location.href = 'index.html';

const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
const getVerifiedIcon = (v) => v ? `<span class="verified-badge">✓</span>` : '';

window.ui = {
    showToast: (msg, type = 'info') => {
        const c = document.getElementById('toast-container');
        const tDiv = document.createElement('div');
        tDiv.className = `toast ${type}`; tDiv.innerText = msg;
        c.appendChild(tDiv);
        setTimeout(() => { tDiv.remove(); }, 3500);
    },
    showModal: (id) => document.getElementById(id).classList.add('active'),
    hideModal: (id) => document.getElementById(id).classList.remove('active')
};

window.chatSystem = {
    init: async () => {
        if(currentUser.role === 'admin') {
            document.getElementById('admin-group-controls').style.display = 'block';
        }

        const groupRef = doc(db, "system", "group_settings");
        onSnapshot(groupRef, (snap) => {
            if(snap.exists()) {
                isGroupOpen = snap.data().isOpen;
                const badge = document.getElementById('group-state-badge');
                if(isGroupOpen) {
                    badge.innerText = "Open";
                    badge.style.background = "var(--success)";
                    document.getElementById('chat-msg-input').disabled = false;
                    document.getElementById('chat-msg-input').placeholder = "Type a message...";
                } else {
                    badge.innerText = "Locked";
                    badge.style.background = "var(--danger)";
                    document.getElementById('chat-msg-input').disabled = true;
                    document.getElementById('chat-msg-input').placeholder = "Admin locked the group.";
                }
            } else {
                if(currentUser.role === 'admin') setDoc(groupRef, { isOpen: true });
            }
        });

        const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"), limit(100));
        onSnapshot(q, (snap) => {
            const box = document.getElementById('global-chat-box');
            box.innerHTML = '';
            
            if(snap.empty) {
                box.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Welcome to Global Chat! 🌍</p>';
                return;
            }

            snap.forEach(docSnap => {
                const msg = { id: docSnap.id, ...docSnap.data() };
                const isMine = msg.uId === currentUser.id;
                
                // Formulate time logic e.g., 16:04
                const date = new Date(msg.timestamp);
                const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const safeText = encodeURIComponent(msg.text);

                // KANDAMIZA (Long Press) EVENTS
                const pressEvents = `ontouchstart="chatSystem.startPress('${msg.id}', '${msg.uId}', '${safeText}')" ontouchend="chatSystem.cancelPress()" onmousedown="chatSystem.startPress('${msg.id}', '${msg.uId}', '${safeText}')" onmouseup="chatSystem.cancelPress()" onmouseleave="chatSystem.cancelPress()"`;

                box.innerHTML += `
                    <div style="display:flex; flex-direction:column; margin-bottom:10px; position:relative;">
                        <small style="font-size:0.7rem; color:var(--text-muted); margin-left:${isMine ? 'auto' : '5px'}; margin-bottom:2px;">${isMine ? 'You' : sanitize(msg.username)} ${getVerifiedIcon(msg.verified)}</small>
                        <div class="msg-bubble ${isMine ? 'msg-mine' : 'msg-others'}" ${pressEvents} style="cursor:pointer; user-select:none;">
                            ${sanitize(msg.text)}
                            <span class="chat-time">${timeString}</span>
                        </div>
                    </div>
                `;
            });
            setTimeout(() => { box.scrollTop = box.scrollHeight; }, 100);
        });
    },

    sendGlobalMessage: async () => {
        if(currentUser.isBlocked) return ui.showToast("Your account is restricted.", 'error');
        if(!isGroupOpen && currentUser.role !== 'admin') return ui.showToast("Group locked.", 'error');

        const input = document.getElementById('chat-msg-input');
        const text = input.value.trim();
        if(!text) return;

        input.value = ''; 

        await addDoc(collection(db, "global_chat"), {
            uId: currentUser.id,
            username: currentUser.username,
            verified: currentUser.verified || false,
            text: text,
            timestamp: Date.now()
        });
    },

    toggleGroupStatus: async () => {
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, { isOpen: !isGroupOpen });
    },

    // MFUMO WA KUKANDAMIZA (LONG PRESS LOGIC)
    startPress: (msgId, uId, text) => {
        pressTimer = setTimeout(() => {
            chatSystem.showOptions(msgId, uId, text);
        }, 500); // 500ms (Nusu sekunde) ya kukandamiza inatosha kufungua Menu
    },

    cancelPress: () => {
        clearTimeout(pressTimer);
    },

    showOptions: (msgId, uId, encodedText) => {
        selectedMsg = { id: msgId, uId: uId, text: decodeURIComponent(encodedText) };
        const isMine = uId === currentUser.id;
        const isAdmin = currentUser.role === 'admin';

        document.getElementById('opt-edit').style.display = isMine ? 'block' : 'none';
        document.getElementById('opt-delete').style.display = (isMine || isAdmin) ? 'block' : 'none';
        
        // Vibrate simu kujulisha imekubali kama inasapoti
        if(navigator.vibrate) navigator.vibrate(50);
        
        ui.showModal('msg-options-modal');
    },

    actionCopy: () => {
        navigator.clipboard.writeText(selectedMsg.text).then(() => {
            ui.hideModal('msg-options-modal');
            ui.showToast('Copied!', 'success');
        });
    },

    actionEdit: async () => {
        ui.hideModal('msg-options-modal');
        const newText = prompt("Edit message:", selectedMsg.text);
        if(newText && newText.trim() !== "") {
            await updateDoc(doc(db, "global_chat", selectedMsg.id), { text: newText.trim() });
            ui.showToast('Edited', 'success');
        }
    },

    actionDelete: async () => {
        ui.hideModal('msg-options-modal');
        if(confirm("Delete this message?")) {
            await deleteDoc(doc(db, "global_chat", selectedMsg.id));
            ui.showToast('Deleted', 'success');
        }
    }
};

document.getElementById('chat-msg-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') chatSystem.sendGlobalMessage();
});

document.addEventListener('DOMContentLoaded', () => {
    chatSystem.init();
});
