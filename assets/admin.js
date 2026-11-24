import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, push, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function status(text){ $("adminStatus").textContent=text; }

let adminUid = undefined;   // undefined = جارٍ التحميل، null = لم يُنشأ مدير بعد، نص = UID المدير
let shownDashboard = false;

async function loadAdminUid(){
  try{ const s=await get(ref(db,"config/adminUid")); adminUid=s.exists()?s.val():null; }
  catch(err){ console.error(err); adminUid=undefined; $("loginPanel").hidden=false; $("loginStatus").textContent="تعذر الاتصال بقاعدة البيانات. تأكد من نشر القواعد (Rules)."; return; }
  evaluate();
}
function evaluate(){
  if(adminUid===undefined) return;
  const user=auth.currentUser;
  const allowed=!!user && adminUid!==null && user.uid===adminUid;
  $("setupPanel").hidden = !(adminUid===null);
  $("loginPanel").hidden = !(adminUid!==null && !allowed);
  $("dashboard").hidden = !allowed;
  if(user && adminUid!==null && !allowed){ signOut(auth); $("loginStatus").textContent="هذا الحساب غير مخوّل لإدارة الموقع."; }
  if(allowed && !shownDashboard){ shownDashboard=true; refreshDashboard(); }
}
onAuthStateChanged(auth, ()=>evaluate());
loadAdminUid();

$("setupForm").addEventListener("submit", async e=>{
  e.preventDefault(); const d=new FormData(e.currentTarget); const st=$("setupStatus");
  const email=d.get("email").trim(), pass=d.get("password");
  if(pass!==d.get("password2")){ st.textContent="كلمتا المرور غير متطابقتين."; return; }
  st.textContent="جارٍ إنشاء الحساب...";
  let cred;
  try{ cred=await createUserWithEmailAndPassword(auth,email,pass); }
  catch(err){
    if(err.code==="auth/email-already-in-use"){
      try{ cred=await signInWithEmailAndPassword(auth,email,pass); }
      catch(e2){ st.textContent="هذا البريد مسجل مسبقاً وكلمة المرور غير صحيحة."; return; }
    }else if(err.code==="auth/operation-not-allowed"){ st.textContent="فعّل Email/Password من Firebase: Authentication ← Sign-in method."; return; }
    else if(err.code==="auth/weak-password"){ st.textContent="كلمة المرور ضعيفة."; return; }
    else { console.error(err); st.textContent="تعذر إنشاء الحساب: "+(err.code||""); return; }
  }
  try{
    await set(ref(db,"config/adminUid"),cred.user.uid);
    adminUid=cred.user.uid; st.textContent="";
    evaluate();
  }catch(err){
    console.error(err);
    st.textContent="تعذر تعيين المدير. انشر قواعد قاعدة البيانات الجديدة (Rules) أو ربما تم إنشاء المدير مسبقاً.";
    await signOut(auth); await loadAdminUid();
  }
});
$("loginForm").addEventListener("submit", async e=>{
  e.preventDefault(); const d=new FormData(e.currentTarget);
  $("loginStatus").textContent="جارٍ تسجيل الدخول...";
  try { await signInWithEmailAndPassword(auth,d.get("email"),d.get("password")); $("loginStatus").textContent=""; }
  catch(err){ $("loginStatus").textContent="تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور."; }
});
$("logoutBtn").addEventListener("click",()=>{shownDashboard=false;signOut(auth);});

async function refreshDashboard(){
  try{
    const [about,program,posts,messages]=await Promise.all([
      get(ref(db,"public/about")),get(ref(db,"public/program")),get(ref(db,"public/posts")),get(ref(db,"messages"))
    ]);
    $("aboutInput").value=about.exists()?about.val():"";
    const p=program.exists()?Object.entries(program.val()):[];
    $("adminProgram").innerHTML=p.map(([id,x])=>`<div><span><b>${esc(x.title)}</b><small>${esc(x.body)}</small></span><button class="danger-btn" data-delete-program="${esc(id)}">حذف</button></div>`).join("")||"<p>لا توجد مجالات.</p>";
    const n=posts.exists()?Object.entries(posts.val()).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0)):[];
    $("adminPosts").innerHTML=n.map(([id,x])=>`<div><span><b>${esc(x.title)}</b><small>${x.status==="published"?"منشور":"مسودة"}</small></span><button class="danger-btn" data-delete-post="${esc(id)}">حذف</button></div>`).join("")||"<p>لا توجد أخبار.</p>";
    const m=messages.exists()?Object.entries(messages.val()).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0)):[];
    $("adminMessages").innerHTML=m.map(([id,x])=>`<article class="message"><div class="flex-between"><b>${esc(x.name)} · ${esc(x.topic)}</b><small>${x.createdAt?new Date(x.createdAt).toLocaleString("ar-DZ"):""}</small></div><p>${esc(x.message).replace(/\n/g,"<br>")}</p><small>وسيلة التواصل: ${esc(x.contact||"غير مذكورة")} · الحالة: ${esc(x.status||"جديدة")}</small><div class="actions"><button class="small-btn" data-read-message="${esc(id)}">${x.status==="read"?"إعادة كجديدة":"تحديد كمقروءة"}</button><button class="danger-btn" data-delete-message="${esc(id)}">حذف</button></div></article>`).join("")||"<p>لا توجد رسائل واردة.</p>";
    status("تم تحميل بيانات لوحة الإدارة.");
  }catch(err){console.error(err);status("تعذر تحميل البيانات. راجع صلاحيات قاعدة البيانات.");}
}
$("aboutForm").addEventListener("submit",async e=>{e.preventDefault();try{await set(ref(db,"public/about"),$("aboutInput").value.trim());status("تم حفظ النبذة.");}catch(err){status("فشل حفظ النبذة.");}});
$("programForm").addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(e.currentTarget);try{await set(push(ref(db,"public/program")),{title:d.get("title").trim(),body:d.get("body").trim(),visible:true,createdAt:Date.now()});e.currentTarget.reset();await refreshDashboard();status("تمت إضافة المجال.");}catch(err){status("تعذرت إضافة المجال.");}});
$("postForm").addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(e.currentTarget);try{await set(push(ref(db,"public/posts")),{title:d.get("title").trim(),body:d.get("body").trim(),status:"published",createdAt:Date.now()});e.currentTarget.reset();await refreshDashboard();status("تم نشر الخبر.");}catch(err){status("تعذر نشر الخبر.");}});
document.addEventListener("click",async e=>{
 const b=e.target.closest("button"); if(!b)return;
 try{
  if(b.dataset.deleteProgram){if(confirm("حذف هذا المجال؟"))await remove(ref(db,"public/program/"+b.dataset.deleteProgram));}
  if(b.dataset.deletePost){if(confirm("حذف هذا الخبر؟"))await remove(ref(db,"public/posts/"+b.dataset.deletePost));}
  if(b.dataset.deleteMessage){if(confirm("حذف هذه الرسالة؟"))await remove(ref(db,"messages/"+b.dataset.deleteMessage));}
  if(b.dataset.readMessage){const snap=await get(ref(db,"messages/"+b.dataset.readMessage+"/status"));await set(ref(db,"messages/"+b.dataset.readMessage+"/status"),snap.val()==="read"?"new":"read");}
  if(b.dataset.deleteProgram||b.dataset.deletePost||b.dataset.deleteMessage||b.dataset.readMessage)await refreshDashboard();
 }catch(err){console.error(err);status("تعذر تنفيذ العملية. تحقق من قواعد الصلاحيات.");}
});
