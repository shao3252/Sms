import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, 
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
let selectedMsg = null;

if (!currentUser) window.location.href = 'index.html';

// SPAM FILTER
const isSpamText = (text) => {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.(com|net|org|co|tz|me|io|info))/i;
    const phoneRegex = /\d{8,}/;
    return linkRegex.test(text) || phoneRegex.test(text);
};

window.chatSystem = {
    init: () => {
        localStorage.setItem('st_chat_last_seen', Date.now());

        const groupRef = doc(db, "system", "group_settings");
        onSnapshot(groupRef, (snap) => {
            if(snap.exists()){
                const pins = snap.data().pinnedMessages || [];
                const badge = document.getElementById('pinned-count-badge');
                if(pins.length > 0) {
                    badge.style.display = 'block';
                    badge.innerText = `📌 ${pins.length} Pinned Message(s)`;
                } else {
                    badge.style.display = 'none';
                }
            }
        });

        const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"), limit(50));
        onSnapshot(q, (snap) => {
            const box = document.getElementById('global-chat-box');
            box.innerHTML = '';
            snap.forEach(d => {
                const msg = d.data();
                const isMine = msg.uId === currentUser.id;
                const msgDiv = document.createElement('div');
                msgDiv.className = `msg-bubble ${isMine ? 'msg-mine' : 'msg-others'}`;
                
                const timeString = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                msgDiv.innerHTML = `${msg.text} <span class="chat-time" style="display:block; font-size:0.65rem; margin-top:3px; opacity:0.8; text-align:right;">${timeString}</span>`;
                
                msgDiv.oncontextmenu = (e) => {
                    e.preventDefault();
                    selectedMsg = { id: d.id, text: msg.text, uId: msg.uId };
                    
                    // Kama wewe sio Admin na meseji sio yako, huwezi kuifuta.
                    if(currentUser.role !== 'admin' && selectedMsg.uId !== currentUser.id) {
                        return; // Kataa kuonesha options
                    }
                    window.ui.showModal('msg-options-modal');
                };
                
                box.appendChild(msgDiv);
            });
            box.scrollTop = box.scrollHeight;
            localStorage.setItem('st_chat_last_seen', Date.now());
        });
    },

    sendGlobalMessage: async () => {
        const input = document.getElementById('chat-msg-input');
        const text = input.value.trim();
        if(!text) return;
        
        // ZUIA KUTUMA LINK AU NAMBA KAMA SIO ADMIN
        if(currentUser.role !== 'admin' && isSpamText(text)) {
            return window.ui.showToast('Hauruhusiwi kuweka Link au Namba ya simu kwenye Group!', 'error');
        }

        input.value = '';
        await addDoc(collection(db, "global_chat"), {
            uId: currentUser.id,
            username: currentUser.username,
            text: text,
            timestamp: Date.now()
        });
    },

    actionPin: async () => {
        const groupRef = doc(db, "system", "group_settings");
        await updateDoc(groupRef, {
            pinnedMessages: arrayUnion(selectedMsg.text)
        });
        window.ui.hideModal('msg-options-modal');
        window.ui.showToast("Message Pinned!", "success");
    },

    actionDelete: async () => {
        if(confirm("Delete this message?")) {
            await deleteDoc(doc(db, "global_chat", selectedMsg.id));
            window.ui.hideModal('msg-options-modal');
            window.ui.showToast('Deleted', 'success');
        }
    },

    showAllPinned: async () => {
        const groupRef = doc(db, "system", "group_settings");
        const snap = await getDoc(groupRef);
        const list = document.getElementById('pinned-list-container');
        list.innerHTML = '';
        if(snap.exists() && snap.data().pinnedMessages){
            snap.data().pinnedMessages.forEach(text => {
                list.innerHTML += `<div class="card" style="margin-bottom:8px; font-size:0.9rem;">${text}</div>`;
            });
            window.ui.showModal('pinned-modal');
        } else {
            window.ui.showToast("No pinned messages.");
        }
    }
};

chatSystem.init();
