import * as F from "./firebase.js";

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const groupRef = id => F.doc(F.db,"groups",id);
const memberRef = (groupId,uid) => F.doc(F.db,"groups",groupId,"members",uid);
let user = null, profile = null, websiteAdmin = false, activeGroup = null, activeMember = null, stopMessages = null, toastTimer = null;
const lang = localStorage.getItem("st_lang") === "en" ? "en" : "sw";
document.documentElement.lang = lang;
document.querySelectorAll("[data-en][data-sw]").forEach(el => { el.textContent = el.dataset[lang]; });

function toast(message,type="info"){
  const host=$("toast-container");
  if(!host)return;
  host.replaceChildren();
  const item=document.createElement("div");
  item.className="toast "+type;
  item.setAttribute("role",type==="error"?"alert":"status");
  item.textContent=String(message||"");
  host.appendChild(item);
  host.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>host.classList.remove("visible"),type==="error"?4500:2500);
}
function errorText(error){
  console.error("SMS TAMU groups:",error);
  if(error?.code==="permission-denied")return "Access denied. Check that the latest Firestore rules have been published.";
  if(error?.code==="failed-precondition")return "Firestore needs an index. Check the Firebase error details.";
  if(error?.code==="unavailable")return "Connection problem. Check your internet and try again.";
  return error?.message || "Something went wrong. Please try again.";
}
function showHome(){
  if(stopMessages){stopMessages();stopMessages=null;}
  activeGroup=null;activeMember=null;
  $("group-room").hidden=true;$("groups-home").hidden=false;
}
function groupCard(group,joined=false,adminMode=false){
  const action=adminMode
    ? `<button class="btn-outline" onclick="groupsApp.toggleStatus('${group.id}','${group.status==='active'?'suspended':'active'}')">${group.status==='active'?'Suspend':'Restore'}</button> <button class="btn-outline" onclick="groupsApp.deleteGroup('${group.id}')">Delete</button>`
    : joined
      ? `<button class="btn-primary" onclick="groupsApp.openGroup('${group.id}')">Open</button>`
      : `<button class="btn-primary" onclick="groupsApp.joinGroup('${group.id}')">Join</button>`;
  return `<article class="card group-card"><div class="group-card-icon">👥</div><div class="group-card-info"><h4>${esc(group.name)}</h4><p>${esc(group.description||"A community group")}</p><small>${Number(group.memberCount||0)} members · ${group.status==='active'?'Active':'Suspended'}</small></div><div class="group-card-actions">${action}</div></article>`;
}
async function loadGroups(){
  if(!user)return;
  $("my-groups-list").innerHTML='<p class="groups-muted">Loading your groups…</p>';
  $("discover-groups-list").innerHTML='<p class="groups-muted">Loading groups…</p>';
  try{
    const snap=await F.getDocs(F.query(F.collection(F.db,"groups"),F.where("visibility","==","public"),F.where("status","==","active"),F.limit(100)));
    const groups=snap.docs.map(d=>({id:d.id,...d.data()}));
    const membership=await Promise.all(groups.map(g=>F.getDoc(memberRef(g.id,user.uid))));
    const joined=groups.filter((g,i)=>membership[i].exists());
    const discover=groups.filter((g,i)=>!membership[i].exists());
    $("my-groups-list").innerHTML=joined.map(g=>groupCard(g,true)).join("")||'<p class="card groups-muted">You have not joined a group yet.</p>';
    $("discover-groups-list").innerHTML=discover.map(g=>groupCard(g,false)).join("")||'<p class="card groups-muted">No public groups yet. Create the first one.</p>';
    if(websiteAdmin)await loadAdminGroups();
  }catch(e){
    const message=errorText(e);
    $("my-groups-list").innerHTML='<p class="card groups-error">'+esc(message)+'</p>';
    $("discover-groups-list").innerHTML='<p class="card groups-error">Groups could not be loaded.</p>';
  }
}
async function loadAdminGroups(){
  try{
    const snap=await F.getDocs(F.query(F.collection(F.db,"groups"),F.limit(100)));
    $("all-groups-list").innerHTML=snap.docs.map(d=>groupCard({id:d.id,...d.data()},false,true)).join("")||'<p class="card groups-muted">No groups have been created.</p>';
  }catch(e){$("all-groups-list").innerHTML='<p class="card groups-error">'+esc(errorText(e))+'</p>';}
}
async function createGroup(event){
  event.preventDefault();
  const name=$("new-group-name").value.trim(),description=$("new-group-description").value.trim();
  if(name.length<3||name.length>50){toast("Group name must be 3–50 characters.","error");return;}
  try{
    const created=await F.addDoc(F.collection(F.db,"groups"),{name,description,ownerId:user.uid,createdBy:user.uid,visibility:"public",status:"active",memberCount:1,createdAt:F.serverTimestamp()});
    try{
      await F.setDoc(memberRef(created.id,user.uid),{uid:user.uid,username:profile.username||user.displayName||"Member",role:"owner",joinedAt:F.serverTimestamp()});
    }catch(e){await F.deleteDoc(created);throw e;}
    $("create-group-form").reset();toast("Group created successfully.","success");await loadGroups();await openGroup(created.id);
  }catch(e){toast(errorText(e),"error");}
}
async function joinGroup(id){
  try{
    const ref=groupRef(id),snap=await F.getDoc(ref);
    if(!snap.exists()||snap.data().status!=="active"||snap.data().visibility!=="public")throw new Error("This group is not available.");
    const member=memberRef(id,user.uid),existing=await F.getDoc(member);
    if(!existing.exists()){
      await F.setDoc(member,{uid:user.uid,username:profile.username||user.displayName||"Member",role:"member",joinedAt:F.serverTimestamp()});
      await F.updateDoc(ref,{memberCount:F.increment(1)});
    }
    toast("You joined the group.","success");await loadGroups();await openGroup(id);
  }catch(e){toast(errorText(e),"error");}
}
async function leaveGroup(){
  if(!activeGroup||!activeMember)return;
  if(activeMember.role==="owner"){toast("The group owner cannot leave. Delete the group or transfer ownership first.","error");return;}
  try{
    await F.deleteDoc(memberRef(activeGroup.id,user.uid));
    await F.updateDoc(groupRef(activeGroup.id),{memberCount:F.increment(-1)});
    toast("You left the group.","success");showHome();await loadGroups();
  }catch(e){toast(errorText(e),"error");}
}
async function openGroup(id){
  try{
    const snap=await F.getDoc(groupRef(id));
    if(!snap.exists())throw new Error("Group not found.");
    const group={id,...snap.data()};
    if(group.status!=="active"&&!websiteAdmin)throw new Error("This group is currently unavailable.");
    const memberSnap=await F.getDoc(memberRef(id,user.uid));
    if(!memberSnap.exists()&&!websiteAdmin)throw new Error("Join this group before opening its chat.");
    activeGroup=group;activeMember=memberSnap.exists()?memberSnap.data():{role:"site-admin"};
    $("groups-home").hidden=true;$("group-room").hidden=false;
    $("room-name").textContent=group.name;$("room-description").textContent=group.description||"";
    $("leave-group").hidden=!memberSnap.exists()||activeMember.role==="owner";
    const tools=$("group-room-admin-tools");
    tools.hidden=!(websiteAdmin||["owner","admin"].includes(activeMember.role));
    tools.innerHTML=tools.hidden?"":`<strong>Group controls</strong><p class="groups-muted">Manage this group's membership and messages.</p><button class="btn-outline" onclick="groupsApp.showMembers()">View members</button> ${websiteAdmin?'<button class="btn-outline" onclick="groupsApp.deleteGroup(\''+id+'\')">Delete group</button>':''}<div id="group-members-list"></div>`;
    if(stopMessages)stopMessages();
    const q=F.query(F.collection(F.db,"groups",id,"messages"),F.orderBy("createdAt","asc"),F.limit(100));
    stopMessages=F.onSnapshot(q,result=>{
      const box=$("group-messages");
      box.innerHTML=result.docs.map(d=>{
        const m=d.data();
        return `<article class="group-message ${m.authorId===user.uid?'mine':''}"><b>${esc(m.username||"Member")}</b><p>${esc(m.text)}</p><small>${m.createdAt?.toDate?m.createdAt.toDate().toLocaleString():""}</small>${m.deleted?'<em>Message removed</em>':""}${(websiteAdmin||m.authorId===user.uid)?`<button class="group-message-delete" onclick="groupsApp.deleteMessage('${id}','${d.id}')">Delete</button>`:""}</article>`;
      }).join("")||'<p class="groups-muted">No messages yet. Say hello!</p>';
      box.scrollTop=box.scrollHeight;
    },e=>{$("group-messages").innerHTML='<p class="groups-error">'+esc(errorText(e))+'</p>';});
  }catch(e){toast(errorText(e),"error");}
}
async function sendMessage(event){
  event.preventDefault();
  if(!activeGroup)return;
  const text=$("group-message-input").value.trim();
  if(!text)return;
  if(text.length>2000){toast("Message is too long (maximum 2,000 characters).","error");return;}
  try{
    await F.addDoc(F.collection(F.db,"groups",activeGroup.id,"messages"),{authorId:user.uid,username:profile.username||user.displayName||"Member",text,createdAt:F.serverTimestamp(),deleted:false});
    $("group-message-input").value="";
  }catch(e){toast(errorText(e),"error");}
}
async function deleteMessage(groupId,messageId){
  try{await F.updateDoc(F.doc(F.db,"groups",groupId,"messages",messageId),{deleted:true});toast("Message removed.","success");}
  catch(e){toast(errorText(e),"error");}
}
async function showMembers(){
  if(!activeGroup)return;
  try{
    const snap=await F.getDocs(F.query(F.collection(F.db,"groups",activeGroup.id,"members"),F.limit(100)));
    const host=$("group-members-list");
    host.innerHTML=snap.docs.map(d=>{
      const m=d.data(),canManage=websiteAdmin||(activeMember&&activeMember.role==="owner");
      const controls=canManage&&m.uid!==user.uid&&m.role!=="owner"?`<button class="btn-outline" onclick="groupsApp.removeMember('${activeGroup.id}','${m.uid}')">Remove</button>`:"";
      return `<div class="group-member-row"><span>${esc(m.username||"Member")} <small>${esc(m.role||"member")}</small></span>${controls}</div>`;
    }).join("")||"No members.";
  }catch(e){toast(errorText(e),"error");}
}
async function removeMember(groupId,uid){
  try{
    await F.deleteDoc(memberRef(groupId,uid));
    await F.updateDoc(groupRef(groupId),{memberCount:F.increment(-1)});
    toast("Member removed.","success");await showMembers();
  }catch(e){toast(errorText(e),"error");}
}
async function toggleStatus(id,status){
  if(!websiteAdmin)return;
  try{await F.updateDoc(groupRef(id),{status,updatedAt:F.serverTimestamp()});toast(status==="active"?"Group restored.":"Group suspended.","success");await loadGroups();}
  catch(e){toast(errorText(e),"error");}
}
async function deleteGroup(id){
  if(!websiteAdmin)return;
  if(!confirm("Delete this group? Its messages and members will no longer be accessible."))return;
  try{await F.deleteDoc(groupRef(id));toast("Group deleted.","success");showHome();await loadGroups();}
  catch(e){toast(errorText(e),"error");}
}
window.groupsApp={openGroup,joinGroup,deleteMessage,showMembers,removeMember,toggleStatus,deleteGroup};
$("create-group-form").addEventListener("submit",createGroup);
$("group-message-form").addEventListener("submit",sendMessage);
$("back-to-groups").addEventListener("click",()=>{showHome();loadGroups();});
$("leave-group").addEventListener("click",leaveGroup);
$("refresh-groups").addEventListener("click",loadGroups);
F.onAuthStateChanged(F.auth,async current=>{
  user=current;
  if(!current){location.href="index.html";return;}
  try{
    const banned=await F.getDoc(F.doc(F.db,"banned",current.uid));
    if(banned.exists()){toast("This account is restricted.","error");await F.signOut(F.auth);location.href="index.html";return;}
    const p=await F.getDoc(F.doc(F.db,"profiles",current.uid));
    profile=p.exists()?p.data():{username:current.displayName||"Member"};
    websiteAdmin=(await F.getDoc(F.doc(F.db,"admins",current.uid))).exists();
    $("groups-admin-label").hidden=!websiteAdmin;
    $("groups-admin-panel").hidden=!websiteAdmin;
    await loadGroups();
  }catch(e){toast(errorText(e),"error");}
});
