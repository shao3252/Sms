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
let selectedMsg = null; 
let pressTimer = null; 

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
        const isAdmin = currentUser.role === 'admin';

        if(isAdmin) {
            document.getElementById('admin-group-controls').style.display = 'block';
            document.getElementById('edit-group-btn').style.display = 'block';
        }

        // 1. SIKILIZA MABADILIKO YA GROUP (Locked/Open, Pinned Msg, Group Name)
        const groupRef = doc(db, "system", "group_settings");
        onSnapshot(groupRef, (snap) => {
            if(snap.exists()) {
                const data = snap.data();
                isGroupOpen = data.isOpen !== false; // Default true
                
                // Group Name Update
                document.getElementById('group-title').innerText = data.groupName || "🌍 Global Web Group";

                // Pinned Message Update
                if(data.pinnedMessage) {
                    document.getElementById('pinned-msg-container').style.display = 'block';
                    document.getElementById('pinned-msg-text').innerText = data.pinnedMessage;
                    document.getElementById('unpin-btn').style.display = isAdmin ? 'block' : 'none';
                } else {
                    document.getElementById('pinned-msg-container').style.display = 'none';
                }

                // Input Status (Admin Bypass Fix)
                const badge = document.getElementById('group-state-badge');
                const inputField = document.getElementById('chat-msg-input');

                if(isGroupOpen) {
                    badge.innerText = "Open";
                    badge.style.background = "var(--success)";
                    inputField.disabled = false;
                    inputField.placeholder = "Type a message...";
                } else {
                    badge.innerText = "Locked";
                    badge.style.background = "var(--danger)";
                    
                    if(isAdmin) {
                        // ADMIN BYPASS: Anaweza kuandika hata kama imefungwa
                        inputField.disabled = false;
                        inputField.placeholder = "Admin Bypass (Locked)...";
                    } else {
                        // Watumiaji wa kawaida wanazuiwa
                        inputField.disabled = true;
                        inputField.placeholder = "Admin has locked the group.";
                    }
                }
            } else {
                if(isAdmin) setDoc(groupRef, { isOpen: true, groupName: "🌍 Global Web Group", pinnedMessage: "" });
            }
        });

        // 2. SIKILIZA MESEJI ZINAZOINGIA
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
                
                const date = new Date(msg.timestamp);
                const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const safeText = encodeURIComponent(msg.text);

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
        // Check imerekebishwa ili isimzuie Admin
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
        ui.showToast(isGroupOpen ? "Group Locked" : "Group Opened", "info");
    },

    editGroupInfo: async () => {
        const newName = prompt("Enter new Group Name:");
        if(newName && newName.trim() !== "") {
            const groupRef = doc(db, "system", "group_settings");
            await updateDoc(groupRef, { groupName: newName.trim() });
            ui.showToast("Group Name Updated", "success");
        }
    },

    // KUKANDAMIZA (LONG PRESS) LOGIC
    startPress: (msgId, uId, text) => {
        pressTimer = setTimeout(() => {
            chatSystem.showOptions(msgId, uId, text);
        }, 500); 
    },

    cancelPress: () => {
        clearTimeout(pressTimer);
    },

    showOptions: (msgId, uId, encodedText) => {
        selectedMsg = { id: msgId, uId: uId, text: decodeURIComponent(encodedText) };
        const isMine = uId === currentUser.id;
        const isAdmin = currentUser.role === 'admin';

        // Visibility ya vifungo kulingana na cheo
        document.getElementById('opt-edit').style.display = isMine ? 'block' : 'none';
        document.getElementById('opt-delete').style.display = (isMine || isAdmin) ? 'block' : 'none';
        document.getElementById('opt-pin').style.display = isAdmin ? 'block' : 'none';
        
        // Option ya kumpa U-admin (Itaonekana kama wewe ni admin na msg ni ya mtu mwingine)
        document.getElementById('opt-make-admin').style.display = (isAdmin && !isMine) ? 'block' : 'none';
        
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
    },

    actionPin: async () => {
        ui.hideModal('msg-options-modal');
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, { pinnedMessage: selectedMsg.text });
        ui.showToast('Message Pinned', 'success');
    },

    actionUnpin: async () => {
        if(confirm("Remove pinned message?")) {
            const groupRef = doc(db, "system", "group_settings");
            await updateDoc(groupRef, { pinnedMessage: "" });
        }
    },

    actionMakeAdmin: async () => {
        ui.hideModal('msg-options-modal');
        if(confirm("Are you sure you want to promote this user to Admin?")) {
            await updateDoc(doc(db, "users", selectedMsg.uId), { role: "admin", verified: true });
            ui.showToast('User Promoted to Admin! 👑', 'success');
        }
    }
};

// Ruhusu kutuma kwa kubonyeza Enter
document.getElementById('chat-msg-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') chatSystem.sendGlobalMessage();
});

document.addEventListener('DOMContentLoaded', () => {
    chatSystem.init();
});
