import * as F from "./firebase.js";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let user,profile,admin=false,selected=null,reply=null,locked=false;
let toastTimer=null;
const toast=(message,type)=>{
 const host=$("toast-container");if(!host)return;
 host.replaceChildren();const item=document.createElement("div");
 item.className="toast "+(type||"info");item.textContent=String(message??"");
 item.setAttribute("role",type==="error"?"alert":"status");host.appendChild(item);host.classList.add("visible");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>host.classList.remove("visible"),type==="error"?4500:2500);
};
window.ui={showModal:id=>$(id)?.classList.add("active"),hideModal:id=>$(id)?.classList.remove("active")};
window.chatSystem={
 async sendGlobalMessage(){if(!user)return toast("Sign in first","error");const t=$("chat-msg-input").value.trim();if(!t)return;if(locked&&!admin)return toast("Chat is locked","error");try{await F.addDoc(F.collection(F.db,"messages"),{uid:user.uid,username:profile.username||user.displayName||"Member",text:t,replyTo:reply,createdAt:F.serverTimestamp(),deleted:false});$("chat-msg-input").value="";reply=null;$("reply-preview").style.display="none";}catch(e){console.error("Global chat send failed:",e);toast(e?.code==="permission-denied"?"You cannot send a message in this chat.":"Message could not be sent. Check your connection and try again.","error");}},
 cancelReply(){reply=null;$("reply-preview").style.display="none";},
 async showAllPinned(){const x=await F.getDocs(F.query(F.collection(F.db,"messages"),F.where("pinned","==",true),F.limit(50)));$("pinned-list-container").innerHTML=x.docs.map(d=>esc(d.data().text)).join("<hr>")||"No pinned messages";ui.showModal("pinned-modal");},
 async editGroupName(){if(!admin)return;const n=prompt("New group name");if(n)await F.setDoc(F.doc(F.db,"settings","group"),{name:n},{merge:true});},
 async toggleGroupLock(){if(!admin)return;locked=!locked;await F.setDoc(F.doc(F.db,"settings","group"),{locked},{merge:true});$("toggle-lock-btn").textContent=locked?"🔓 Fungua Group (Unlock)":"🔒 Funga Group (Lock)";toast(locked?"Group locked":"Group unlocked");},
 actionReply(){if(!selected)return;reply={id:selected.id,text:selected.text,username:selected.username};$("reply-name").textContent=selected.username;$("reply-text").textContent=selected.text;$("reply-preview").style.display="block";ui.hideModal("msg-options-modal");},
 actionCopy(){if(selected)navigator.clipboard?.writeText(selected.text);ui.hideModal("msg-options-modal");},
 actionViewProfile(){ui.hideModal("msg-options-modal");location.href="index.html";},
 async actionPin(){if(admin&&selected)await F.updateDoc(F.doc(F.db,"messages",selected.id),{pinned:!selected.pinned});ui.hideModal("msg-options-modal");},
 actionMakeAdmin(){toast("Manage admin access in Firebase Console.");},actionRemoveAdmin(){toast("Manage admin access in Firebase Console.");},actionBlockUser(){toast("User restriction tools are not enabled yet.");},
 async actionDelete(){if(selected&&(admin||selected.uid===user.uid))await F.updateDoc(F.doc(F.db,"messages",selected.id),{deleted:true});ui.hideModal("msg-options-modal");},
 async uploadGroupImage(ev){if(!admin)return toast("Admin access only");const file=ev?.target?.files?.[0];if(!file)return;if(file.size>3000000)return toast("Choose an image under 3 MB");try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const canvas=document.createElement("canvas"),scale=Math.min(1,500/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.65));};img.src=reader.result;};reader.readAsDataURL(file);});if(data.length>700000)return toast("Image is too large after compression");await F.setDoc(F.doc(F.db,"settings","group"),{photoURL:data},{merge:true});$("group-pic").src=data;toast("Group picture updated");}catch(e){console.error(e);toast("Could not update group picture");}}

};
let activeGroupChat=null, stopGroupMessages=null, groupChatAdmin=false;
const groupDoc=id=>F.doc(F.db,"groups",id);
const groupMemberDoc=(id,uid)=>F.doc(F.db,"groups",id,"members",uid);
function switchChatTab(which){
 const groups=which==="groups";
 $("my-groups-panel").hidden=!groups;
 $("global-chat-box").hidden=groups;
 $("chat-input-area")?.classList.toggle("chat-input-hidden",groups);
 $("tab-global-chat").classList.toggle("active",!groups);
 $("tab-my-groups").classList.toggle("active",groups);
 if(groups)loadChatGroups();
 else closeGroupChat();
}
async function loadChatGroups(){
 try{
  const snap=await F.getDocs(F.query(F.collection(F.db,"groups"),F.where("visibility","==","public"),F.limit(100)));
  const all=snap.docs.map(d=>({id:d.id,...d.data()})).filter(g=>g.status==="active");
  const memberSnaps=await Promise.all(all.map(g=>F.getDoc(groupMemberDoc(g.id,user.uid))));
  const joined=all.filter((g,i)=>memberSnaps[i].exists());
  const discover=all.filter((g,i)=>!memberSnaps[i].exists());
  const card=(g,member)=>`<article class="chat-group-card"><div class="chat-group-avatar">👥</div><div class="chat-group-info"><b>${esc(g.name)}</b><small>${esc(g.description||"Community group")}</small></div><button class="btn-outline" onclick="groupChatActions.${member?"open":"join"}('${g.id}')">${member?"Open":"Join"}</button></article>`;
  let adminGroups="";
  if(groupChatAdmin){
   const adminSnap=await F.getDocs(F.query(F.collection(F.db,"groups"),F.limit(100)));
   adminGroups=adminSnap.docs.map(d=>({id:d.id,...d.data()})).filter(g=>g.status!=="active").map(g=>`<article class="chat-group-card"><div class="chat-group-avatar">🛡️</div><div class="chat-group-info"><b>${esc(g.name)}</b><small>${esc(g.status||"")}</small></div><button class="btn-outline" onclick="groupChatActions.restore('${g.id}')">Restore</button></article>`).join("");
  }
  $("chat-groups-list").innerHTML='<h4>Joined groups</h4>'+(joined.map(g=>card(g,true)).join("")||'<p class="groups-empty">You have not joined any groups yet.</p>')+'<h4>Discover groups</h4>'+(discover.map(g=>card(g,false)).join("")||'<p class="groups-empty">No public groups available.</p>')+(groupChatAdmin?'<h4>Website admin · Removed groups</h4>'+adminGroups:'');
  if(groupChatAdmin){
   const adminSnap=await F.getDocs(F.query(F.collection(F.db,"groups"),F.limit(100)));
   const adminCards=adminSnap.docs.map(d=>{const g={id:d.id,...d.data()};return `<article class="chat-group-card"><div class="chat-group-avatar">🛡️</div><div class="chat-group-info"><b>${esc(g.name)}</b><small>Status: ${esc(g.status||"unknown")}</small></div>${g.status==="active"?`<button class="btn-outline" onclick="groupChatActions.moderate('${g.id}','suspended')">Suspend</button>`:`<button class="btn-outline" onclick="groupChatActions.restore('${g.id}')">Restore</button>`}<button class="btn-outline" onclick="groupChatActions.moderate('${g.id}','removed')">Remove</button></article>`;}).join("");
   $("chat-groups-list").innerHTML+='<h4>Website admin · Manage all groups</h4>'+(adminCards||'<p class="groups-empty">No groups yet.</p>');
  }
 }catch(e){console.error("Chat groups load failed:",e);$("chat-groups-list").textContent=e?.code==="permission-denied"?"Groups are unavailable. Publish the latest Firestore rules.":"Could not load groups. Check your connection.";}
}
async function createChatGroup(event){
 event.preventDefault();
 const name=$("chat-group-name").value.trim(),description=$("chat-group-description").value.trim();
 if(name.length<3||name.length>50)return toast("Group name must be 3–50 characters.","error");
 try{
  const created=await F.addDoc(F.collection(F.db,"groups"),{name,description,ownerId:user.uid,createdBy:user.uid,visibility:"public",status:"active",createdAt:F.serverTimestamp()});
  await F.setDoc(groupMemberDoc(created.id,user.uid),{uid:user.uid,username:profile.username||user.displayName||"Member",role:"owner",joinedAt:F.serverTimestamp()});
  $("new-chat-group-form").reset();$("new-chat-group-form").hidden=true;toast("Group created.","success");await loadChatGroups();await openChatGroup(created.id);
 }catch(e){console.error("Create group failed:",e);toast(e?.code==="permission-denied"?"You cannot create a group. Check Firestore rules.":"Group could not be created.","error");}
}
async function joinChatGroup(id){
 try{
  const ref=groupDoc(id),s=await F.getDoc(ref);
  if(!s.exists()||s.data().status!=="active")throw new Error("This group is unavailable.");
  await F.setDoc(groupMemberDoc(id,user.uid),{uid:user.uid,username:profile.username||user.displayName||"Member",role:"member",joinedAt:F.serverTimestamp()});
  toast("You joined the group.","success");await loadChatGroups();await openChatGroup(id);
 }catch(e){console.error("Join group failed:",e);toast(e?.code==="permission-denied"?"Could not join. Check Firestore rules.":e.message||"Could not join group.","error");}
}
async function openChatGroup(id){
 try{
  const s=await F.getDoc(groupDoc(id));if(!s.exists()||s.data().status!=="active")throw new Error("This group is unavailable.");
  const m=await F.getDoc(groupMemberDoc(id,user.uid));if(!m.exists()&&!groupChatAdmin)throw new Error("Join this group first.");
  activeGroupChat={id,...s.data(),member:m.exists()?m.data():{role:"site-admin"}};
  $("chat-groups-list").hidden=true;$("chat-group-room").hidden=false;
  $("chat-group-room-name").textContent=activeGroupChat.name;
  $("chat-group-room-description").textContent=activeGroupChat.description||"";
  $("chat-group-members-btn").hidden=!(groupChatAdmin||["owner","admin"].includes(activeGroupChat.member.role));
  if(stopGroupMessages)stopGroupMessages();
  const q=F.query(F.collection(F.db,"groups",id,"messages"),F.orderBy("createdAt","asc"),F.limit(150));
  stopGroupMessages=F.onSnapshot(q,snap=>{
   $("chat-group-messages").innerHTML=snap.docs.map(d=>{const m=d.data();return `<div class="msg-bubble ${m.authorId===user.uid?"msg-mine":"msg-others"}"><b>${esc(m.username||"Member")}</b><p>${m.deleted?"This message was removed.":esc(m.text)}</p><small class="chat-time">${m.createdAt?.toDate?m.createdAt.toDate().toLocaleString():""}</small>${(groupChatAdmin||["owner","admin"].includes(activeGroupChat.member.role))&&!m.deleted?`<button class="chat-group-remove-msg" onclick="groupChatActions.removeMessage('${id}','${d.id}')">Remove</button>`:""}</div>`;}).join("")||'<p class="groups-empty">No messages yet. Start the conversation.</p>';
   $("chat-group-messages").scrollTop=$("chat-group-messages").scrollHeight;
  },e=>{console.error("Group messages listener:",e);$("chat-group-messages").textContent="Could not load group messages. Check Firestore rules.";});
 }catch(e){toast(e.message||"Could not open group.","error");}
}
async function sendChatGroupMessage(event){
 event.preventDefault();if(!activeGroupChat)return;
 const input=$("chat-group-message"),text=input.value.trim();if(!text)return;
 try{await F.addDoc(F.collection(F.db,"groups",activeGroupChat.id,"messages"),{authorId:user.uid,username:profile.username||user.displayName||"Member",text,createdAt:F.serverTimestamp(),deleted:false});input.value="";}
 catch(e){console.error("Group message send failed:",e);toast(e?.code==="permission-denied"?"You cannot send to this group.":"Message could not be sent.","error");}
}
async function showChatGroupMembers(){
 if(!activeGroupChat)return;
 try{
  const snap=await F.getDocs(F.query(F.collection(F.db,"groups",activeGroupChat.id,"members"),F.limit(100)));
  $("chat-group-members").hidden=false;
  $("chat-group-members").innerHTML=snap.docs.map(d=>{const m=d.data(),can=groupChatAdmin||["owner","admin"].includes(activeGroupChat.member.role);return `<div class="chat-group-member"><span>${esc(m.username||"Member")} · ${esc(m.role||"member")}</span>${can&&m.uid!==user.uid&&m.role!=="owner"?`<button onclick="groupChatActions.removeMember('${activeGroupChat.id}','${m.uid}')">Remove</button>`:""}</div>`;}).join("")||"No members.";
 }catch(e){toast("Could not load group members.","error");}
}
async function removeChatGroupMember(id,uid){
 try{await F.deleteDoc(groupMemberDoc(id,uid));toast("Member removed.","success");await showChatGroupMembers();}
 catch(e){toast("Could not remove member. Check group permissions.","error");}
}
async function removeChatGroupMessage(id,messageId){
 try{await F.updateDoc(F.doc(F.db,"groups",id,"messages",messageId),{deleted:true});toast("Message removed.","success");}
 catch(e){toast("Could not remove message.","error");}
}
async function moderateChatGroup(id,status){
 if(!groupChatAdmin||!["suspended","removed"].includes(status))return;
 try{await F.updateDoc(groupDoc(id),{status,updatedAt:F.serverTimestamp()});toast(status==="removed"?"Group removed.":"Group suspended.","success");await loadChatGroups();if(activeGroupChat?.id===id)closeGroupChat();}
 catch(e){toast("Could not update group status.","error");}
}
async function restoreChatGroup(id){
 if(!groupChatAdmin)return;
 try{await F.updateDoc(groupDoc(id),{status:"active",updatedAt:F.serverTimestamp()});toast("Group restored.","success");await loadChatGroups();}
 catch(e){toast("Could not restore group.","error");}
}
function closeGroupChat(){
 if(stopGroupMessages){stopGroupMessages();stopGroupMessages=null;}
 activeGroupChat=null;
 if($("chat-groups-list"))$("chat-groups-list").hidden=false;
 if($("chat-group-room"))$("chat-group-room").hidden=true;
}
window.groupChatActions={open:openChatGroup,join:joinChatGroup,removeMember:removeChatGroupMember,removeMessage:removeChatGroupMessage,restore:restoreChatGroup,moderate:moderateChatGroup};
$("tab-global-chat").addEventListener("click",()=>switchChatTab("global"));
$("tab-my-groups").addEventListener("click",()=>switchChatTab("groups"));
$("new-chat-group-btn").addEventListener("click",()=>$("new-chat-group-form").hidden=false);
$("cancel-chat-group").addEventListener("click",()=>$("new-chat-group-form").hidden=true);
$("new-chat-group-form").addEventListener("submit",createChatGroup);
$("chat-group-send-form").addEventListener("submit",sendChatGroupMessage);
$("back-chat-groups").addEventListener("click",()=>{closeGroupChat();});
$("chat-group-members-btn").addEventListener("click",showChatGroupMembers);
window.chatSystemSelect=async id=>{const snap=await F.getDoc(F.doc(F.db,"messages",id));if(snap.exists()){selected={id,...snap.data()};$("opt-pin").style.display=admin?"block":"none";$("opt-delete").style.display=(admin||selected.uid===user.uid)?"block":"none";$("opt-block").style.display=admin&&selected.uid!==user.uid?"block":"none";$("opt-admin-make").style.display="none";$("opt-admin-remove").style.display="none";ui.showModal("msg-options-modal");}};
$("chat-msg-input")?.addEventListener("keydown",e=>{if(e.key==="Enter")chatSystem.sendGlobalMessage();});
F.onAuthStateChanged(F.auth,async u=>{user=u;if(!u){location.href="index.html";return;}if((await F.getDoc(F.doc(F.db,"banned",u.uid))).exists()){alert("This account is restricted. Contact the administrator.");await F.signOut(F.auth);location.href="index.html";return;}const p=await F.getDoc(F.doc(F.db,"profiles",u.uid));profile=p.exists()?p.data():{username:u.displayName||"Member"};admin=(await F.getDoc(F.db,"admins",u.uid)).exists();$("group-settings-btn").style.display=admin?"block":"none";const g=await F.getDoc(F.doc(F.db,"settings","group"));if(g.exists()){locked=!!g.data().locked;$("group-title").textContent=g.data().name||"🌍 Global Group";if(g.data().photoURL)$("group-pic").src=g.data().photoURL;} $("group-status").textContent="Connected";$("toggle-lock-btn").textContent=locked?"🔓 Fungua Group (Unlock)":"🔒 Funga Group (Lock)";F.onSnapshot(F.query(F.collection(F.db,"messages"),F.orderBy("createdAt","asc"),F.limit(150)),x=>{$("global-chat-box").innerHTML=x.docs.map(d=>{const m={id:d.id,...d.data()};if(m.deleted)return "";return `<div class="chat-message"><b>${esc(m.username)}</b><p>${esc(m.text)}</p><small>${m.pinned?"📌 ":""}</small><button onclick="chatSystemSelect('${m.id}')">⋯</button></div>`;}).join("");$("global-chat-box").scrollTop=$("global-chat-box").scrollHeight;});F.onSnapshot(F.query(F.collection(F.db,"messages"),F.where("pinned","==",true),F.limit(50)),x=>{const bar=$("pinned-bar");$("pin-count").textContent=x.size;bar.style.display=x.size?"block":"none";if(x.size){const first=x.docs[0].data();bar.setAttribute("title",first.text||"Pinned message");}});});
