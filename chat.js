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
if (!currentUser) window.location.href = 'index.html';

let selectedMsg = null;
let replyingTo = null;
let isGroupOpen = true;
let isGroupAdmin = false;

// KUZUIA NAMBA NA LINK
const isSpamText = (text) => {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.(com|net|org|co|tz|me|io|info))/i;
    const digitRegex = /\d/; 
    return linkRegex.test(text) || digitRegex.test(text);
};

window.ui = {
    showToast: (m, type='info') => {
        const c = document.getElementById('toast-container'); const t = document.createElement('div');
        t.className=`toast ${type}`; t.innerText=m; c.appendChild(t); setTimeout(()=>t.remove(), 3500);
    },
    showModal: (id) => document.getElementById(id).classList.add('active'),
    hideModal: (id) => document.getElementById(id).classList.remove('active')
};

const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

window.chatSystem = {
    init: () => {
        localStorage.setItem('st_chat_last_seen', Date.now());

        const gRef = doc(db, "system", "group_settings");
        onSnapshot(gRef, (snap) => {
            if(snap.exists()){
                const data = snap.data();
                isGroupOpen = data.isOpen !== false;
                isGroupAdmin = currentUser.role === 'admin' || (data.groupAdmins && data.groupAdmins.includes(currentUser.id));
                
                document.getElementById('group-title').innerText = data.groupName || "🌍 Global Group";
                if(data.groupPic) document.getElementById('group-pic').src = data.groupPic;
                
                const stat = document.getElementById('group-status');
                const lockBtn = document.getElementById('admin-lock-btn');
                const input = document.getElementById('chat-msg-input');

                if(isGroupOpen) { stat.innerText = "Tupo Online"; stat.style.color = "var(--success)"; input.disabled=false; input.placeholder="Andika ujumbe..."; lockBtn.innerText="🔓"; }
                else { stat.innerText = "Group Limefungwa"; stat.style.color = "var(--danger)"; lockBtn.innerText="🔒"; if(!isGroupAdmin) { input.disabled=true; input.placeholder="Admin amefunga group."; } }

                if(isGroupAdmin) lockBtn.style.display = 'block';

                const pins = data.pinnedMessages || [];
                const bar = document.getElementById('pinned-bar');
                if(pins.length > 0) { bar.style.display = 'block'; document.getElementById('pin-count').innerText = pins.length; } else bar.style.display = 'none';
            } else {
                if(currentUser.role === 'admin') setDoc(gRef, { groupName: "🌍 Global Group", isOpen: true, groupAdmins: [] });
            }
        });

        const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"), limit(100));
        onSnapshot(q, (snap) => {
            const box = document.getElementById('global-chat-box');
            box.innerHTML = '';
            snap.forEach(d => {
                const m = d.data(); const isMine = m.uId === currentUser.id;
                const div = document.createElement('div');
                div.className = `msg-bubble ${isMine ? 'msg-mine' : 'msg-others'}`;
                
                let replyHTML = '';
                if(m.replyTo) {
                    replyHTML = `<div style="background:rgba(0,0,0,0.05); border-left:3px solid var(--primary); padding:5px; border-radius:4px; font-size:0.8rem; margin-bottom:5px;"><strong style="color:var(--primary)">${sanitize(m.replyTo.name)}</strong><br><span style="opacity:0.8">${sanitize(m.replyTo.text)}</span></div>`;
                }

                const time = new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const sender = isMine ? '' : `<strong style="font-size:0.75rem; color:var(--primary); display:block; margin-bottom:2px;">${sanitize(m.username)}</strong>`;

                div.innerHTML = `${sender}${replyHTML}<span>${sanitize(m.text)}</span><span class="chat-time" style="display:block; font-size:0.65rem; margin-top:3px; opacity:0.8; text-align:right;">${time}</span>`;
                
                // LONG PRESS OPTIONS (WhatsApp style)
                div.oncontextmenu = (e) => {
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
        if(currentUser.isBlocked) return ui.showToast("Account Restricted", "error");
        if(!isGroupOpen && !isGroupAdmin) return ui.showToast("Group is locked", "error");

        const input = document.getElementById('chat-msg-input');
        const text = input.value.trim();
        if(!text) return;

        if(!isGroupAdmin && isSpamText(text)) return ui.showToast("Hauruhusiwi kutuma Namba au Link!", "error");

        const payload = { uId: currentUser.id, username: currentUser.username, text: text, timestamp: Date.now() };
        if(replyingTo) { payload.replyTo = { name: replyingTo.username, text: replyingTo.text }; }

        await addDoc(collection(db, "global_chat"), payload);
        input.value = ''; chatSystem.cancelReply();
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
        ui.hideModal('msg-options-modal'); ui.showToast('Copied!', 'success');
    },

    actionPin: async () => {
        await updateDoc(doc(db, "system", "group_settings"), { pinnedMessages: arrayUnion(selectedMsg.text) });
        ui.hideModal('msg-options-modal'); ui.showToast("Pinned!", "success");
    },

    actionDelete: async () => {
        await deleteDoc(doc(db, "global_chat", selectedMsg.id));
        ui.hideModal('msg-options-modal'); ui.showToast("Deleted", "success");
    },

    actionBlockUser: async () => {
        if(confirm(`Block ${selectedMsg.username}?`)) {
            await updateDoc(doc(db, "users", selectedMsg.uId), { isBlocked: true });
            ui.hideModal('msg-options-modal'); ui.showToast("User Blocked", "success");
        }
    },

    actionMakeAdmin: async () => {
        if(confirm(`Make ${selectedMsg.username} Group Admin?`)) {
            await updateDoc(doc(db, "system", "group_settings"), { groupAdmins: arrayUnion(selectedMsg.uId) });
            ui.hideModal('msg-options-modal'); ui.showToast("Promoted to Group Admin", "success");
        }
    },

    actionViewProfile: () => {
        ui.hideModal('msg-options-modal');
        localStorage.setItem('st_view_user', selectedMsg.uId);
        window.location.href = 'index.html';
    },

    toggleGroupLock: async () => {
        await updateDoc(doc(db, "system", "group_settings"), { isOpen: !isGroupOpen });
    },

    showGroupInfo: async () => {
        if(!isGroupAdmin) return;
        const newName = prompt("Badili jina la Group:", document.getElementById('group-title').innerText);
        if(newName) await updateDoc(doc(db, "system", "group_settings"), { groupName: newName });
    },

    editGroupImage: () => {
        if(!isGroupAdmin) return;
        const url = prompt("Weka Link ya Picha Mpya ya Group (URL):");
        if(url) updateDoc(doc(db, "system", "group_settings"), { groupPic: url });
    },

    showAllPinned: async () => {
        const snap = await getDoc(doc(db, "system", "group_settings"));
        const list = document.getElementById('pinned-list-container'); list.innerHTML = '';
        if(snap.exists() && snap.data().pinnedMessages){
            snap.data().pinnedMessages.forEach(text => { list.innerHTML += `<div class="card" style="padding:10px; margin-bottom:5px;">${sanitize(text)}</div>`; });
            ui.showModal('pinned-modal');
        }
    }
};

document.getElementById('chat-msg-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') chatSystem.sendGlobalMessage();
});

chatSystem.init();
