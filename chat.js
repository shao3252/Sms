import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, setDoc,
    doc, query, orderBy, onSnapshot, deleteDoc, limit, arrayUnion, getDoc 
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

if (!currentUser) {
    window.location.href = 'index.html';
}

let selectedMsg = null;
let replyingTo = null;
let isGroupOpen = true;
let isGroupAdmin = false;

// STRICT SPAM FILTER (Kuzuia tarakimu na links kwa watu wa kawaida)
const isSpamText = (text) => {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.(com|net|org|co|tz|me|io|info))/i;
    const digitRegex = /\d/; 
    return linkRegex.test(text) || digitRegex.test(text);
};

window.ui = {
    showToast: (m, type='info') => {
        const c = document.getElementById('toast-container'); 
        const t = document.createElement('div');
        t.className = `toast ${type}`; 
        t.innerText = m; 
        c.appendChild(t); 
        setTimeout(() => t.remove(), 3500);
    },
    showModal: (id) => document.getElementById(id).classList.add('active'),
    hideModal: (id) => document.getElementById(id).classList.remove('active')
};

const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

// Kutengeneza tick kwa wale walio verified kwenye chat
const getVerifiedIcon = (v) => v ? `<span class="verified-badge" style="width:12px; height:12px; font-size:8px;">✓</span>` : '';

window.chatSystem = {
    init: () => {
        localStorage.setItem('st_chat_last_seen', Date.now());

        // CHUKUA TAARIFA ZA GROUP
        const gRef = doc(db, "system", "group_settings");
        onSnapshot(gRef, (snap) => {
            if(snap.exists()){
                const data = snap.data();
                
                isGroupOpen = data.isOpen !== false;
                isGroupAdmin = currentUser.role === 'admin' || (data.groupAdmins && data.groupAdmins.includes(currentUser.id));
                
                document.getElementById('group-title').innerText = data.groupName || "🌍 Global Group";
                
                if(data.groupPic) {
                    document.getElementById('group-pic').src = data.groupPic;
                }
                
                const stat = document.getElementById('group-status');
                const input = document.getElementById('chat-msg-input');

                if(isGroupOpen) { 
                    stat.innerText = "Tupo Online"; 
                    stat.style.color = "var(--success)"; 
                    input.disabled = false; 
                    input.placeholder = "Andika ujumbe..."; 
                } else { 
                    stat.innerText = "Group Limefungwa"; 
                    stat.style.color = "var(--danger)"; 
                    
                    if(!isGroupAdmin) { 
                        input.disabled = true; 
                        input.placeholder = "Admin amefunga group."; 
                    } 
                }

                // Onyesha kitufe cha Settings kwa Admin
                if(isGroupAdmin) {
                    document.getElementById('group-settings-btn').style.display = 'block';
                    document.getElementById('toggle-lock-btn').innerText = isGroupOpen ? '🔒 Funga Group (Lock)' : '🔓 Fungua Group (Unlock)';
                    document.getElementById('toggle-lock-btn').style.color = isGroupOpen ? 'var(--danger)' : 'var(--success)';
                } else {
                    document.getElementById('group-settings-btn').style.display = 'none';
                }

                // Pinned Messages Count
                const pins = data.pinnedMessages || [];
                const bar = document.getElementById('pinned-bar');
                if(pins.length > 0) { 
                    bar.style.display = 'block'; 
                    document.getElementById('pin-count').innerText = pins.length; 
                } else {
                    bar.style.display = 'none'; 
                }
            } else {
                if(currentUser.role === 'admin') {
                    setDoc(gRef, { groupName: "🌍 Global Group", isOpen: true, groupAdmins: [] });
                }
            }
        });

        // SIKILIZA MESEJI (MUONEKANO SAFI KAMA TELEGRAM)
        const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"), limit(100));
        
        onSnapshot(q, (snap) => {
            const box = document.getElementById('global-chat-box');
            box.innerHTML = '';
            
            snap.forEach(d => {
                const m = d.data(); 
                const isMine = m.uId === currentUser.id;
                
                const div = document.createElement('div');
                div.className = `msg-bubble ${isMine ? 'msg-mine' : 'msg-others'}`;
                
                let replyHTML = '';
                if(m.replyTo) {
                    replyHTML = `
                    <div class="reply-block" style="cursor:pointer;" onclick="ui.showToast('Replied to: ${sanitize(m.replyTo.name)}')">
                        <strong style="color:var(--primary)">${sanitize(m.replyTo.name)}</strong><br>
                        <span style="opacity:0.8">${sanitize(m.replyTo.text)}</span>
                    </div>`;
                }

                const time = new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                const sender = isMine ? '' : `<strong style="font-size:0.8rem; color:var(--primary); display:flex; align-items:center; gap:5px; margin-bottom:5px; cursor:pointer;" onclick="chatSystem.directProfile('${m.uId}')">${sanitize(m.username)} ${getVerifiedIcon(m.verified)}</strong>`;

                div.innerHTML = `
                    ${sender}
                    ${replyHTML}
                    <span>${sanitize(m.text)}</span>
                    <span class="chat-time">${time}</span>
                `;
                
                // KUBONYEZA MESEJI KUPATA OPTIONS
                div.onclick = (e) => {
                    e.preventDefault();
                    
                    selectedMsg = { id: d.id, text: m.text, uId: m.uId, username: m.username };
                    
                    document.getElementById('opt-pin').style.display = isGroupAdmin ? 'block' : 'none';
                    document.getElementById('opt-delete').style.display = (isMine || isGroupAdmin) ? 'block' : 'none';
                    
                    document.getElementById('opt-block').style.display = (isGroupAdmin && !isMine) ? 'block' : 'none';
                    document.getElementById('opt-admin-make').style.display = (currentUser.role === 'admin' && !isMine) ? 'block' : 'none';
                    
                    ui.showModal('msg-options-modal');
                };
                
                box.appendChild(div);
            });
            
            box.scrollTop = box.scrollHeight;
            localStorage.setItem('st_chat_last_seen', Date.now()); 
        });
    },

    sendGlobalMessage: async () => {
        if(currentUser.isBlocked) return ui.showToast("Akaunti yako imezuiwa (Blocked)", "error");
        if(!isGroupOpen && !isGroupAdmin) return ui.showToast("Group limefungwa", "error");

        const input = document.getElementById('chat-msg-input');
        const text = input.value.trim();
        if(!text) return;

        // SPAM FILTER: Zuia Watu Kawaida (Admin anaweza)
        if(!isGroupAdmin && isSpamText(text)) {
            return ui.showToast("Hauruhusiwi kutuma Namba au Link humu!", "error");
        }

        const payload = { 
            uId: currentUser.id, 
            username: currentUser.username, 
            verified: currentUser.verified || false,
            text: text, 
            timestamp: Date.now() 
        };
        
        if(replyingTo) { 
            payload.replyTo = { name: replyingTo.username, text: replyingTo.text }; 
        }

        await addDoc(collection(db, "global_chat"), payload);
        
        input.value = ''; 
        chatSystem.cancelReply();
        
        // Push scroll chini
        setTimeout(() => {
            const box = document.getElementById('global-chat-box');
            box.scrollTop = box.scrollHeight;
        }, 100);
    },

    actionReply: () => {
        replyingTo = selectedMsg;
        document.getElementById('reply-preview').style.display = 'block';
        document.getElementById('reply-name').innerText = replyingTo.username;
        document.getElementById('reply-text').innerText = replyingTo.text;
        ui.hideModal('msg-options-modal');
        document.getElementById('chat-msg-input').focus();
    },

    cancelReply: () => {
        replyingTo = null;
        document.getElementById('reply-preview').style.display = 'none';
    },

    actionCopy: () => {
        navigator.clipboard.writeText(selectedMsg.text);
        ui.hideModal('msg-options-modal'); 
        ui.showToast('Ujumbe Ume-copyiwa!', 'success');
    },

    actionPin: async () => {
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, { pinnedMessages: arrayUnion(selectedMsg.text) });
        ui.hideModal('msg-options-modal'); 
        ui.showToast("Imewekwa kwenye Pinned!", "success");
    },

    actionDelete: async () => {
        if(confirm("Uhakika unataka kufuta ujumbe huu?")) {
            await deleteDoc(doc(db, "global_chat", selectedMsg.id));
            ui.hideModal('msg-options-modal'); 
            ui.showToast("Umefutwa kikamilifu", "success");
        }
    },

    actionBlockUser: async () => {
        if(confirm(`Unataka kumpiga block ${selectedMsg.username}?`)) {
            await updateDoc(doc(db, "users", selectedMsg.uId), { isBlocked: true });
            ui.hideModal('msg-options-modal'); 
            ui.showToast("Mtumiaji amepigwa block", "success");
        }
    },

    actionMakeAdmin: async () => {
        if(confirm(`Mfanye ${selectedMsg.username} awe Group Admin?`)) {
            const groupRef = doc(db, "system", "group_settings");
            await updateDoc(groupRef, { groupAdmins: arrayUnion(selectedMsg.uId) });
            ui.hideModal('msg-options-modal'); 
            ui.showToast("Amekuwa Group Admin", "success");
        }
    },

    actionViewProfile: () => {
        ui.hideModal('msg-options-modal');
        chatSystem.directProfile(selectedMsg.uId);
    },

    directProfile: (id) => {
        localStorage.setItem('st_view_user', id);
        window.location.href = 'index.html';
    },

    /* ---- SETTINGS MPYA ZA KUBADILI GROUP (Kutokea kwenye Settings Modal) ---- */
    
    toggleGroupLock: async () => {
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, { isOpen: !isGroupOpen });
        ui.hideModal('group-settings-modal');
        ui.showToast(isGroupOpen ? "Group Limefungwa (Locked)" : "Group Limefunguliwa (Unlocked)", "success");
    },

    editGroupName: async () => {
        const currentName = document.getElementById('group-title').innerText;
        const newName = prompt("Ingiza jina jipya la Group:", currentName);
        
        if(newName && newName.trim() !== "") {
            await updateDoc(doc(db, "system", "group_settings"), { groupName: newName.trim() });
            ui.hideModal('group-settings-modal');
            ui.showToast("Jina limebadilishwa", "success");
        }
    },

    uploadGroupImage: (e) => {
        const file = e.target.files[0]; 
        if (!file) return; 
        
        ui.showToast('Inapakia picha...', 'info');
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                // Compress image to save database space
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Compressed = canvas.toDataURL('image/jpeg', 0.6);

                try {
                    await updateDoc(doc(db, "system", "group_settings"), { groupPic: base64Compressed });
                    ui.showToast('Picha ya Group imebadilishwa!', 'success');
                    ui.hideModal('group-settings-modal');
                } catch(error) {
                    ui.showToast('Imeshindwa kupakia. Jaribu tena.', 'error');
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    },

    showAllPinned: async () => {
        const snap = await getDoc(doc(db, "system", "group_settings"));
        const list = document.getElementById('pinned-list-container'); 
        list.innerHTML = '';
        
        if(snap.exists() && snap.data().pinnedMessages){
            snap.data().pinnedMessages.forEach(text => { 
                list.innerHTML += `<div class="card" style="padding:10px; margin-bottom:5px;">${sanitize(text)}</div>`; 
            });
            ui.showModal('pinned-modal');
        } else {
            ui.showToast("Hakuna Pinned messages.", "info");
        }
    }
};

// Kutuma ujumbe kwa kubofya Enter key kwenye Keyboard
document.getElementById('chat-msg-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        chatSystem.sendGlobalMessage();
    }
});

// Kusaidia kusukuma screen uki-focus Input kwenye simu
document.getElementById('chat-msg-input').addEventListener('focus', () => {
    setTimeout(() => {
        const box = document.getElementById('global-chat-box');
        box.scrollTop = box.scrollHeight;
    }, 300);
});

document.addEventListener('DOMContentLoaded', () => {
    chatSystem.init();
});
