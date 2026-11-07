import * as F from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let user,profile,admin=false,selected=null,reply=null,locked=false;
const toast=s=>$("toast-container").textContent=s;
window.ui={showModal:id=>$(id)?.classList.add("active"),hideModal:id=>$(id)?.classList.remove("active")};
window.chatSystem={
 async sendGlobalMessage(){if(!user)return toast("Sign in first");const t=$("chat-msg-input").value.trim();if(!t)return;if(locked&&!admin)return toast("Chat is locked");await F.addDoc(F.collection(F.db,"messages"),{uid:user.uid,username:profile.username,text:t,replyTo:reply,createdAt:F.serverTimestamp(),deleted:false});$("chat-msg-input").value="";reply=null;$("reply-preview").style.display="none";},
 cancelReply(){reply=null;$("reply-preview").style.display="none";},
 async showAllPinned(){const x=await F.getDocs(F.query(F.collection(F.db,"messages"),F.where("pinned","==",true),F.limit(50)));$("pinned-list-container").innerHTML=x.docs.map(d=>esc(d.data().text)).join("<hr>")||"No pinned messages";ui.showModal("pinned-modal");},
 async editGroupName(){if(!admin)return;const n=prompt("New group name");if(n)await F.setDoc(F.doc(F.db,"settings","group"),{name:n},{merge:true});},
 async toggleGroupLock(){if(!admin)return;locked=!locked;await F.setDoc(F.doc(F.db,"settings","group"),{locked},{merge:true});toast(locked?"Group locked":"Group unlocked");},
 actionReply(){if(!selected)return;reply={id:selected.id,text:selected.text,username:selected.username};$("reply-name").textContent=selected.username;$("reply-text").textContent=selected.text;$("reply-preview").style.display="block";ui.hideModal("msg-options-modal");},
 actionCopy(){if(selected)navigator.clipboard?.writeText(selected.text);ui.hideModal("msg-options-modal");},
 actionViewProfile(){ui.hideModal("msg-options-modal");location.href="index.html";},
 async actionPin(){if(admin&&selected)await F.updateDoc(F.doc(F.db,"messages",selected.id),{pinned:!selected.pinned});ui.hideModal("msg-options-modal");},
 actionMakeAdmin(){toast("Manage admin access in Firebase Console.");},actionRemoveAdmin(){toast("Manage admin access in Firebase Console.");},actionBlockUser(){toast("User restriction tools are not enabled yet.");},
 async actionDelete(){if(selected&&(admin||selected.uid===user.uid))await F.updateDoc(F.doc(F.db,"messages",selected.id),{deleted:true});ui.hideModal("msg-options-modal");},
 uploadGroupImage(){toast("Group image upload is not enabled yet.");}
};
window.chatSystemSelect=async id=>{const s=await F.getDoc(F.doc(F.db,"messages",id));if(s.exists()){selected={id,...s.data()};ui.showModal("msg-options-modal");}};
$("chat-msg-input")?.addEventListener("keydown",e=>{if(e.key==="Enter")chatSystem.sendGlobalMessage();});
F.onAuthStateChanged(F.auth,async u=>{user=u;if(!u){location.href="index.html";return;}const p=await F.getDoc(F.doc(F.db,"profiles",u.uid));profile=p.exists()?p.data():{username:u.displayName||"Member"};admin=(await F.getDoc(F.db,"admins",u.uid)).exists();$("group-settings-btn").style.display=admin?"block":"none";const g=await F.getDoc(F.doc(F.db,"settings","group"));if(g.exists()){locked=!!g.data().locked;$("group-title").textContent=g.data().name||"🌍 Global Group";}$("group-status").textContent="Connected";F.onSnapshot(F.query(F.collection(F.db,"messages"),F.orderBy("createdAt","asc"),F.limit(150)),x=>{$("global-chat-box").innerHTML=x.docs.map(d=>{const m={id:d.id,...d.data()};if(m.deleted)return "";return `<div class="chat-message"><b>${esc(m.username)}</b><p>${esc(m.text)}</p><small>${m.pinned?"📌 ":""}</small><button onclick="chatSystemSelect('${m.id}')">⋯</button></div>`;}).join("");$("global-chat-box").scrollTop=$("global-chat-box").scrollHeight;});});
