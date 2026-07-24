(()=>{
const CFG=window.BLOG_CLOUD_CONFIG,LOCAL_KEY='my_blog_notes_v1';
if(!CFG||!window.supabase){document.addEventListener('DOMContentLoaded',()=>showFatal('云端配置没有加载。'));return}
const client=window.supabase.createClient(CFG.url,CFG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'dylan-private-blog-auth'}});
let session=null;
const hasDraft=n=>n&&(n.draftSaved===true||'draftTitle'in n||'draftBody'in n);
function fromRow(r){const n={id:r.id,title:r.title||'',body:r.body||'',published:!!r.published,updated:Date.parse(r.updated_at)||Date.now(),createdAt:Date.parse(r.created_at)||Date.now(),publishedAt:r.published_at?Date.parse(r.published_at):null};if(r.draft_saved){n.draftSaved=true;if(r.draft_title!==null)n.draftTitle=r.draft_title;if(r.draft_body!==null)n.draftBody=r.draft_body}return n}
function toRow(n,userId){return{user_id:userId,id:String(n.id),title:n.title||'',body:n.body||'',draft_title:'draftTitle'in n?n.draftTitle:null,draft_body:'draftBody'in n?n.draftBody:null,draft_saved:hasDraft(n),published:!!n.published,created_at:new Date(n.createdAt||n.updated||Date.now()).toISOString(),updated_at:new Date(n.updated||Date.now()).toISOString(),published_at:n.published?(new Date(n.publishedAt||n.updated||Date.now()).toISOString()):null}}
async function loadNotes(){if(!session)return[];const{data,error}=await client.from('blog_notes').select('*').order('updated_at',{ascending:false});if(error)throw error;return(data||[]).map(fromRow)}
async function saveNote(n){if(!session)throw new Error('尚未登录');const{error}=await client.from('blog_notes').upsert(toRow(n,session.user.id),{onConflict:'user_id,id'});if(error)throw error;return true}
async function deleteNote(id){if(!session)return;const{error}=await client.from('blog_notes').delete().eq('id',String(id));if(error)throw error}
async function migrateLocal(notes){for(const n of notes)await saveNote(n);return loadNotes()}
function getLocal(){try{const n=JSON.parse(localStorage.getItem(LOCAL_KEY));return Array.isArray(n)?n:[]}catch{return[]}}
function githubName(user){const m=user?.user_metadata||{};return m.user_name||m.preferred_username||m.userName||m.name||user?.email||'GitHub用户'}
function showFatal(message){const g=document.getElementById('authGate');if(g){g.hidden=false;g.innerHTML='<div class="auth-card"><h1>连接失败</h1><p>'+escapeHtml(message)+'</p></div>'}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function loadMain(){const src=document.body.dataset.main;if(!src)return;const s=document.createElement('script');s.src=src;s.onerror=()=>showFatal('页面程序加载失败，请强制刷新。');document.body.appendChild(s)}
async function signIn(){const redirectTo=location.origin+location.pathname;const{error}=await client.auth.signInWithOAuth({provider:'github',options:{redirectTo}});if(error)alert('GitHub登录失败：'+error.message)}
async function signOut(){await client.auth.signOut();localStorage.removeItem('dylan-private-blog-auth');location.reload()}
async function boot(){
 const gate=document.getElementById('authGate'),shell=document.getElementById('appShell'),login=document.getElementById('githubLogin');
 if(login)login.onclick=signIn;
 try{
  const{data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
  if(!session){gate.hidden=false;shell.hidden=true;return}
  const name=githubName(session.user);
  if(String(name).toLowerCase()!=='dylan-hero'){await client.auth.signOut();gate.hidden=false;shell.hidden=true;const msg=document.getElementById('authMessage');if(msg)msg.textContent='该GitHub账号不是此私人博客的所有者。';return}
  const msg=document.getElementById('authMessage');if(msg)msg.textContent='正在读取私人云端…';
  let notes=await loadNotes(),local=getLocal();
  if(!notes.length&&local.length&&confirm('发现当前浏览器中有 '+local.length+' 篇本地文章。是否立即迁移到私人云端？')){notes=await migrateLocal(local);alert('本地文章已迁移到私人云端。')}
  window.__PRIVATE_MODE__=true;window.__CLOUD_NOTES__=notes;localStorage.setItem(LOCAL_KEY,JSON.stringify(notes));
  document.querySelectorAll('[data-cloud-user]').forEach(x=>x.textContent=name);
  document.querySelectorAll('[data-cloud-logout]').forEach(x=>x.onclick=signOut);
  gate.hidden=true;shell.hidden=false;loadMain();
 }catch(e){showFatal(e.message||String(e))}
}
window.blogCloud={client,loadNotes,saveNote,deleteNote,signIn,signOut,get session(){return session},async refresh(){const n=await loadNotes();window.__CLOUD_NOTES__=n;localStorage.setItem(LOCAL_KEY,JSON.stringify(n));return n}};
document.addEventListener('DOMContentLoaded',boot);
})();