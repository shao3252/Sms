import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, 
    doc, query, where, orderBy, onSnapshot, deleteDoc, arrayUnion, arrayRemove, getDoc 
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

window.ui = {
    showToast: (m, type = 'info') => { 
        const c = document.getElementById('toast-container'); 
        const t = document.createElement('div'); 
        t.className = `toast ${type}`; 
        t.innerText = m; 
        c.appendChild(t); 
        setTimeout(() => t.remove(), 3500); 
    }
};

const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

window.premiumSystem = {
    init: () => {
        // 1. CHUKUA SETTINGS ZA MALIPO KUTOKA FIREBASE
        onSnapshot(doc(db, "system", "app_settings"), (snap) => {
            let price = "3000";
            let methods = [{ network: "Vodacom", number: "255799178372", name: "Gumba Gumba" }];
            
            if(snap.exists()) {
                const data = snap.data();
                if(data.premiumPrice) price = data.premiumPrice;
                if(data.paymentMethods && data.paymentMethods.length > 0) methods = data.paymentMethods;
            }

            const box = document.getElementById('payment-details-box');
            box.innerHTML = `<strong style="font-size:1.2rem; color:#d4af37; display:block; margin-bottom:10px;">Gharama: Tsh ${price} Tu!</strong><p style="margin-bottom:15px; font-size:0.9rem; color:var(--text-muted);">Tuma kiasi hicho kwenye namba zifuatazo, kisha jaza jina la muamala chini:</p>`;
            
            methods.forEach(pm => {
                box.innerHTML += `
                <div style="padding:10px; background:var(--card-bg); border-radius:8px; margin-bottom:10px; border:1px solid var(--border);">
                    <strong style="font-size:1rem;">${pm.network}</strong><br>
                    <span style="color:var(--secondary); font-size:1.2rem; font-weight:bold;">${pm.number}</span><br>
                    <small style="color:var(--text-muted);">Jina: ${pm.name}</small>
                </div>`;
            });
        });

        // 2. ANGALIA KAMA MTU NI VIP
        if (currentUser.isPremium || currentUser.role === 'admin') {
            document.getElementById('paywall-section').style.display = 'none';
            document.getElementById('premium-feed-section').style.display = 'block';
            premiumSystem.loadPremiumFeed();
        } else {
            document.getElementById('paywall-section').style.display = 'block';
            document.getElementById('premium-feed-section').style.display = 'none';
        }
    },

    submitPremium: async () => {
        const transName = document.getElementById('premium-trans-name').value.trim();
        if(!transName) {
            return ui.showToast("Tafadhali weka jina la muamala!", "error");
        }
        
        await addDoc(collection(db, "premium_requests"), {
            uId: currentUser.id, 
            username: currentUser.username, 
            transaction: transName, 
            status: 'pending', 
            timestamp: Date.now()
        });
        
        ui.showToast("Ombi limepokelewa! Subiri Admin akubali.", "success");
        document.getElementById('premium-trans-name').value = '';
        document.getElementById('premium-form-area').style.display = 'none';
        document.getElementById('show-pay-form-btn').style.display = 'block';
    },

    loadPremiumFeed: () => {
        const q = query(collection(db, "posts"), where("category", "==", "Message Kuntu"), orderBy("timestamp", "desc"));
        
        onSnapshot(q, (snap) => {
            const container = document.getElementById('premium-container');
            container.innerHTML = '';
            let hasPosts = false;
            
            snap.forEach(docSnap => {
                hasPosts = true;
                const post = { id: docSnap.id, ...docSnap.data() };
                const isLiked = post.likes && post.likes.includes(currentUser.id);
                const isAdmin = currentUser.role === 'admin';
                
                // Meseji za Kuntu zinaficha jina la aliyetuma. (Single Plane)
                let html = `
                <div class="card" style="border: 2px solid #d4af37; background: linear-gradient(to bottom right, var(--card-bg), rgba(212, 175, 55, 0.05));">
                    <div style="display:flex; align-items:center; margin-bottom:15px;">
                        <div style="background:#d4af37; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">🌟</div>
                        <div style="margin-left:10px;">
                            <strong style="color:#d4af37; font-size:1.1rem;">Sms Tamu VIP</strong>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${premiumSystem.timeAgo(post.timestamp)}</div>
                        </div>
                    </div>
                    
                    <div style="font-size:1.1rem; line-height:1.6; margin-bottom:15px; white-space:pre-wrap;">${sanitize(post.text)}</div>
                    
                    <div style="display:flex; justify-content:space-around; border-top:1px solid var(--border); padding-top:12px;">
                        <button style="background:none; border:none; color:${isLiked ? '#ff477e' : 'var(--text-muted)'}; font-size:1rem; cursor:pointer; font-weight:bold;" onclick="premiumSystem.toggleLike('${post.id}')">
                            ${isLiked ? '❤️ Liked' : '🤍 Like'}
                        </button>
                        
                        <button style="background:none; border:none; color:var(--text-muted); font-size:1rem; cursor:pointer;" onclick="premiumSystem.copyText('${encodeURIComponent(post.text)}')">📋 Copy</button>
                        <button style="background:none; border:none; color:var(--text-muted); font-size:1rem; cursor:pointer;" onclick="premiumSystem.sharePost('${encodeURIComponent(post.text)}')">🚀 Share</button>
                    </div>
                `;

                // Admin pekee ndio anaruhusiwa kufuta na kuedit Kuntu
                if(isAdmin) {
                    html += `
                    <div style="text-align:right; margin-top:15px; border-top:1px dashed #d4af37; padding-top:10px;">
                        <button style="background:none; border:none; color:var(--secondary); font-weight:bold; cursor:pointer; margin-right:15px;" onclick="premiumSystem.editPost('${post.id}', '${encodeURIComponent(post.text)}')">✏️ Edit</button>
                        <button style="background:none; border:none; color:var(--danger); font-weight:bold; cursor:pointer;" onclick="premiumSystem.deletePost('${post.id}')">🗑️ Delete</button>
                    </div>`;
                }

                html += `</div>`;
                container.innerHTML += html;
            });
            
            if(!hasPosts) {
                container.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Hakuna meseji za VIP kwa sasa.</p>`;
            }
        });
    },

    toggleLike: async (postId) => {
        const postRef = doc(db, "posts", postId);
        const snap = await getDoc(postRef);
        if(snap.exists()) {
            if(snap.data().likes && snap.data().likes.includes(currentUser.id)) {
                await updateDoc(postRef, { likes: arrayRemove(currentUser.id) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(currentUser.id) });
            }
        }
    },

    copyText: (encodedText) => {
        navigator.clipboard.writeText(decodeURIComponent(encodedText)).then(() => {
            ui.showToast('Imecopyiwa Kikamilifu!', 'success');
        });
    },

    sharePost: async (encodedText) => {
        const text = decodeURIComponent(encodedText);
        const shareData = {
            title: 'Sms Tamu VIP',
            text: text + '\n\n- Kutoka Sms Tamu VIP 🌟'
        };
        if (navigator.share && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (err) { console.log('Share canceled'); }
        } else {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.text)}`);
        }
    },

    editPost: async (postId, encodedText) => {
        const oldText = decodeURIComponent(encodedText);
        const newText = prompt("Edit Meseji ya VIP:", oldText);
        if(newText && newText.trim() !== "") {
            await updateDoc(doc(db, "posts", postId), { text: newText.trim() });
            ui.showToast("Meseji imebadilishwa", "success");
        }
    },

    deletePost: async (postId) => {
        if(confirm("Uhakika unataka kufuta meseji hii ya VIP?")) {
            await deleteDoc(doc(db, "posts", postId));
            ui.showToast("Meseji imefutwa", "success");
        }
    },

    timeAgo: (ts) => {
        const s = Math.floor((Date.now() - ts) / 1000);
        let i = s / 86400; if (i > 1) return Math.floor(i) + "d ago";
        i = s / 3600; if (i > 1) return Math.floor(i) + "h ago";
        i = s / 60; if (i > 1) return Math.floor(i) + "m ago";
        return "Just now";
    }
};

document.addEventListener('DOMContentLoaded', () => {
    premiumSystem.init();
});
