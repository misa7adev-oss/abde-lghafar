import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const $ = (id) => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

async function loadPublicContent() {
  try {
    const [aboutSnap, programSnap, postsSnap] = await Promise.all([
      get(ref(database, "public/about")),
      get(ref(database, "public/program")),
      get(ref(database, "public/posts"))
    ]);
    if (aboutSnap.exists()) $("aboutText").textContent = aboutSnap.val();
    const program = programSnap.exists() ? Object.entries(programSnap.val()).map(([id, v]) => ({id,...v})).filter(x => x.visible !== false) : [];
    $("programList").innerHTML = program.length ? program.map(x => `<article class="card"><div class="card-icon">✦</div><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.body)}</p></article>`).join("") : '<div class="empty">لا توجد مجالات منشورة حالياً.</div>';
    const posts = postsSnap.exists() ? Object.entries(postsSnap.val()).map(([id,v])=>({id,...v})).filter(x=>x.status==="published").sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,6) : [];
    $("newsList").innerHTML = posts.length ? posts.map(x=>`<article class="news"><div class="news-body"><small>${x.createdAt ? new Date(x.createdAt).toLocaleDateString("ar-DZ") : ""}</small><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.body).replace(/\n/g,"<br>")}</p></div></article>`).join("") : '<div class="empty">لا توجد نشاطات منشورة حالياً.</div>';
  } catch (error) {
    console.error(error);
    $("programList").innerHTML = '<div class="empty">تعذر تحميل البيانات. تحقق من إعدادات Firebase وقواعد الوصول.</div>';
    $("newsList").innerHTML = '<div class="empty">تعذر تحميل الأخبار حالياً.</div>';
  }
}
function escapeHtml(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, data = new FormData(form), status = $("formStatus");
  const payload = {
    name: String(data.get("name")||"").trim(),
    contact: String(data.get("contact")||"").trim(),
    topic: String(data.get("topic")||""),
    message: String(data.get("message")||"").trim(),
    createdAt: Date.now(),
    status: "new"
  };
  if (!payload.name || !payload.message) return;
  status.textContent = "جارٍ إرسال رسالتك...";
  try {
    await set(push(ref(database, "messages")), payload);
    form.reset(); status.textContent = "تم إرسال رسالتك بنجاح. شكراً لتواصلك.";
  } catch (error) {
    console.error(error); status.textContent = "لم نتمكن من إرسال الرسالة. يرجى المحاولة لاحقاً.";
  }
});
loadPublicContent();
