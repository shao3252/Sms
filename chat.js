import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, setDoc,
    doc, query, orderBy, onSnapshot, deleteDoc, limit, arrayUnion, arrayRemove, getDoc 
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
let currentUser = JSON.parse(localStorage.getItem('st_session'));

if (!currentUser) {
    window.location.href = 'index.html';
}

let selectedMsg = null;
let replyingTo = null;
let isGroupOpen = true;

// NGAZI ZA ADMINS
let isSuperAdmin = currentUser.role === 'admin'; 
let isMeGroupAdmin = false;
window.groupAdminsList = [];

// Kuzuia spam (Namba na Links) kwa watu wa kawaida
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
const getVerifiedIcon = (v) => v ? `<span class="verified-badge" style="width:12px; height:12px; font-size:8px;">✓</span>` : '';

window.chatSystem = {
    init: () => {
        // Hii inasaidia kufuta Green Badge ukifungua chat
        localStorage.setItem('st_chat_last_seen', Date.now());

        const gRef = doc(db, "system", "group_settings");
        onSnapshot(gRef, (snap) => {
            if(snap.exists()){
                const data = snap.data();
                
                isGroupOpen = data.isOpen !== false;
                window.groupAdminsList = data.groupAdmins || [];
                isMeGroupAdmin = isSuperAdmin || window.groupAdminsList.includes(currentUser.id);
                
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
                    
                    if(!isMeGroupAdmin) { 
                        input.disabled = true; 
                        input.placeholder = "Admin amefunga group."; 
                    } 
                }

                if(isMeGroupAdmin) {
                    document.getElementById('group-settings-btn').style.display = 'block';
                    document.getElementById('toggle-lock-btn').innerText = isGroupOpen ? '🔒 Funga Group (Lock)' : '🔓 Fungua Group (Unlock)';
                    document.getElementById('toggle-lock-btn').style.color = isGroupOpen ? 'var(--danger)' : 'var(--success)';
                } else {
                    document.getElementById('group-settings-btn').style.display = 'none';
                }

                // Onyesha idadi ya meseji zilizopiniwa
                const pins = data.pinnedMessages || [];
                const bar = document.getElementById('pinned-bar');
                if(pins.length > 0) { 
                    bar.style.display = 'block'; 
                    document.getElementById('pin-count').innerText = pins.length; 
                } else {
                    bar.style.display = 'none'; 
                }
            } else {
                if(isSuperAdmin) {
                    setDoc(gRef, { groupName: "🌍 Global Group", isOpen: true, groupAdmins: [] });
                }
            }
        });

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
                    <div class="reply-block" style="cursor:pointer;" onclick="window.ui.showToast('Replied to: ${sanitize(m.replyTo.name)}')">
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
                
                // Mfumo wa Ngazi za Uongozi (Hierarchy)
                div.onclick = (e) => {
                    e.preventDefault();
                    
                    selectedMsg = { id: d.id, text: m.text, uId: m.uId, username: m.username };
                    
                    const isTargetSuperAdmin = m.role === 'admin';
                    const isTargetGroupAdmin = window.groupAdminsList.includes(m.uId);

                    // LOGIC KUBWA HAPA YA NANI ANAWEZA KUFANYA NINI:
                    
                    // Pin inaweza kufanywa na Group Admin au Super Admin
                    document.getElementById('opt-pin').style.display = isMeGroupAdmin ? 'block' : 'none';
                    
                    // Futa meseji: Kama ni yako, AU wewe ni Super Admin, AU wewe ni Group Admin na meseji SIO ya Super Admin
                    const canDelete = isMine || isSuperAdmin || (isMeGroupAdmin && !isTargetSuperAdmin && !isTargetGroupAdmin);
                    document.getElementById('opt-delete').style.display = canDelete ? 'block' : 'none';
                    
                    // Block user: Kama wewe ni Group Admin/Super Admin na unataka kublock mtu wa kawaida
                    const canBlock = isMeGroupAdmin && !isMine && !isTargetSuperAdmin && !isTargetGroupAdmin;
                    document.getElementById('opt-block').style.display = canBlock ? 'block' : 'none';
                    
                    // Make Admin: Super Admin PEKEE ndio anatoa U-admin kwa watu wa kawaida
                    const canMakeAdmin = isSuperAdmin && !isMine && !isTargetGroupAdmin && !isTargetSuperAdmin;
                    document.getElementById('opt-admin-make').style.display = canMakeAdmin ? 'block' : 'none';

                    // Remove Admin: Super Admin PEKEE ndio anavua U-admin
                    const canRemoveAdmin = isSuperAdmin && !isMine && isTargetGroupAdmin;
                    const removeBtn = document.getElementById('opt-admin-remove');
                    if(removeBtn) removeBtn.style.display = canRemoveAdmin ? 'block' : 'none';
                    
                    window.ui.showModal('msg-options-modal');
                };
                
                box.appendChild(div);
            });
            
            box.scrollTop = box.scrollHeight;
            localStorage.setItem('st_chat_last_seen', Date.now()); 
        });
    },

    sendGlobalMessage: async () => {
        if(currentUser.isBlocked) return window.ui.showToast("Akaunti yako imezuiwa (Blocked)", "error");
        if(!isGroupOpen && !isMeGroupAdmin) return window.ui.showToast("Group limefungwa", "error");

        const input = document.getElementById('chat-msg-input');
        const text = input.value.trim();
        if(!text) return;

        if(!isMeGroupAdmin && isSpamText(text)) {
            return window.ui.showToast("Hauruhusiwi kutuma Namba au Link humu!", "error");
        }

        const payload = { 
            uId: currentUser.id, 
            username: currentUser.username, 
            verified: currentUser.verified || false,
            role: currentUser.role || 'user',  // Muhimu kwa Admin Protection
            text: text, 
            timestamp: Date.now() 
        };
        
        if(replyingTo) { 
            payload.replyTo = { name: replyingTo.username, text: replyingTo.text }; 
        }

        await addDoc(collection(db, "global_chat"), payload);
        
        input.value = ''; 
        window.chatSystem.cancelReply();
        
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
        window.ui.hideModal('msg-options-modal');
        document.getElementById('chat-msg-input').focus();
    },

    cancelReply: () => {
        replyingTo = null;
        document.getElementById('reply-preview').style.display = 'none';
    },

    actionCopy: () => {
        navigator.clipboard.writeText(selectedMsg.text);
        window.ui.hideModal('msg-options-modal'); 
        window.ui.showToast('Ujumbe Ume-copyiwa!', 'success');
    },

    actionPin: async () => {
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, { pinnedMessages: arrayUnion(selectedMsg.text) });
        window.ui.hideModal('msg-options-modal'); 
        window.ui.showToast("Imewekwa kwenye Pinned!", "success");
    },

    actionUnpin: async (encodedText) => {
        if(confirm("Toa hii meseji kwenye Pinned?")) {
            const groupRef = doc(db, "system", "group_settings");
            await updateDoc(groupRef, { pinnedMessages: arrayRemove(decodeURIComponent(encodedText)) });
            window.ui.showToast("Imetolewa!", "success");
            window.chatSystem.showAllPinned(); // Refresh modal
        }
    },

    actionDelete: async () => {
        if(confirm("Uhakika unataka kufuta ujumbe huu?")) {
            await deleteDoc(doc(db, "global_chat", selectedMsg.id));
            window.ui.hideModal('msg-options-modal'); 
            window.ui.showToast("Umefutwa kikamilifu", "success");
        }
    },

    actionBlockUser: async () => {
        if(confirm(`Unataka kumpiga block ${selectedMsg.username}?`)) {
            await updateDoc(doc(db, "users", selectedMsg.uId), { isBlocked: true });
            window.ui.hideModal('msg-options-modal'); 
            window.ui.showToast("Mtumiaji amepigwa block", "success");
        }
    },

    // SUPER ADMIN POWERS OVER GROUP ADMINS
    actionMakeAdmin: async () => {
        if(confirm(`Mfanye ${selectedMsg.username} awe Group Admin?`)) {
            const groupRef = doc(db, "system", "group_settings");
            await updateDoc(groupRef, { groupAdmins: arrayUnion(selectedMsg.uId) });
            window.ui.hideModal('msg-options-modal'); 
            window.ui.showToast("Amekuwa Group Admin", "success");
        }
    },

    actionRemoveAdmin: async () => {
        if(confirm(`Muondoe ${selectedMsg.username} kwenye U-admin wa Group?`)) {
            const groupRef = doc(db, "system", "group_settings");
            await updateDoc(groupRef, { groupAdmins: arrayRemove(selectedMsg.uId) });
            window.ui.hideModal('msg-options-modal'); 
            window.ui.showToast("Amepokonywa U-admin", "success");
        }
    },

    actionViewProfile: () => {
        window.ui.hideModal('msg-options-modal');
        window.chatSystem.directProfile(selectedMsg.uId);
    },

    directProfile: (id) => {
        localStorage.setItem('st_view_user', id);
        window.location.href = 'index.html';
    },

    toggleGroupLock: async () => {
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, { isOpen: !isGroupOpen });
        window.ui.hideModal('group-settings-modal');
        window.ui.showToast(isGroupOpen ? "Group Limefungwa (Locked)" : "Group Limefunguliwa (Unlocked)", "success");
    },

    editGroupName: async () => {
        const currentName = document.getElementById('group-title').innerText;
        const newName = prompt("Ingiza jina jipya la Group:", currentName);
        
        if(newName && newName.trim() !== "") {
            await updateDoc(doc(db, "system", "group_settings"), { groupName: newName.trim() });
            window.ui.hideModal('group-settings-modal');
            window.ui.showToast("Jina limebadilishwa", "success");
        }
    },

    uploadGroupImage: (e) => {
        const file = e.target.files[0]; 
        if (!file) return; 
        
        window.ui.showToast('Inapakia picha...', 'info');
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const scaleSize = 400 / img.width;
                canvas.width = 400;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Compressed = canvas.toDataURL('image/jpeg', 0.6);

                try {
                    await updateDoc(doc(db, "system", "group_settings"), { groupPic: base64Compressed });
                    window.ui.showToast('Picha ya Group imebadilishwa!', 'success');
                    window.ui.hideModal('group-settings-modal');
                } catch(error) {
                    window.ui.showToast('Imeshindwa kupakia. Jaribu tena.', 'error');
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
            const pins = snap.data().pinnedMessages;
            if(pins.length === 0) {
                window.ui.hideModal('pinned-modal');
                window.ui.showToast("Hakuna Pinned messages.", "info");
                return;
            }

            pins.forEach(text => { 
                const encoded = encodeURIComponent(text);
                const unpinBtn = isMeGroupAdmin ? `<button style="background:none; border:none; color:var(--danger); cursor:pointer; font-weight:bold; padding:5px 0;" onclick="chatSystem.actionUnpin('${encoded}')">✖ Unpin</button>` : '';
                
                list.innerHTML += `
                <div class="card" style="padding:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;">${sanitize(text)}</div>
                    <div>${unpinBtn}</div>
                </div>`; 
            });
            window.ui.showModal('pinned-modal');
        } else {
            window.ui.showToast("Hakuna Pinned messages.", "info");
        }
    }
};

document.getElementById('chat-msg-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        window.chatSystem.sendGlobalMessage();
    }
});

document.getElementById('chat-msg-input').addEventListener('focus', () => {
    setTimeout(() => {
        const box = document.getElementById('global-chat-box');
        box.scrollTop = box.scrollHeight;
    }, 300);
});

document.addEventListener('DOMContentLoaded', () => {
    window.chatSystem.init();
});
