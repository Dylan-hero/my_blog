const KEY='my_blog_notes_v1';
const samples=[
 {id:'welcome',title:'欢迎来到我的笔记',body:'<p>这是你的个人记录空间。点击右上角“开始写作”，就可以像使用 Word 一样编辑内容。</p><h2>可以做什么？</h2><p>自动保存、撤销重做，以及把文章显示在首页。</p>',updated:Date.now(),published:true},
 {id:'sample2',title:'从记录开始',body:'<p>不必等到想法完整才落笔。先写下一句话，知识会在反复整理中慢慢形成。</p>',updated:Date.now()-86400000,published:true}
];
const staticPosts=[
 {id:'mdb-protocol-study',title:'MDB 协议学习记录',excerpt:'DDR5 MDB 协议、数据通路、初始化、CRC 与训练相关学习记录。',legacy:true,url:'articles/mdb-protocol-study.html',updated:Date.UTC(2026,6,23),published:true}
];
function storedNotes(){if(Array.isArray(window.__CLOUD_NOTES__))return window.__CLOUD_NOTES__;try{const n=JSON.parse(localStorage.getItem(KEY));return Array.isArray(n)?n:[]}catch{return[]}}
function hasDraft(n){return n&&(n.draftSaved===true||'draftTitle'in n||'draftBody'in n)}
function draftTitle(n){return n&&'draftTitle'in n?(n.draftTitle||''):(n.title||'')}
function draftBody(n){return n&&'draftBody'in n?(n.draftBody||''):(n.body||'')}
function normalizeTitle(s){return String(s||'').replace(/\\s+/g,'').toLowerCase()}
const box=document.querySelector('#posts');
let view='published',stored=[],usingSamples=true,published=[],drafts=[];
function reloadData(){
 stored=storedNotes();usingSamples=!window.__PRIVATE_MODE__&&!stored.length;
 const source=usingSamples?samples:stored.filter(n=>n.published);
 const sourceIds=new Set(source.map(n=>String(n.id))),sourceTitles=new Set(source.map(n=>normalizeTitle(n.title)));
 const fallbacks=staticPosts.filter(s=>!sourceIds.has(String(s.id))&&!sourceTitles.has(normalizeTitle(s.title)));
 published=[...source,...fallbacks].sort((a,b)=>b.updated-a.updated);
 drafts=stored.filter(n=>!n.published||hasDraft(n)).sort((a,b)=>b.updated-a.updated);
 publishedCount.textContent=published.length;draftCount.textContent=drafts.length;render();
}
function render(){
 const list=view==='published'?published:drafts;
 sectionTitle.textContent=view==='published'?'已发布文章':'草稿箱';
 count.textContent=list.length+' 篇';
 box.innerHTML=list.length?list.map(p=>{
   const isDraft=view==='drafts',t=isDraft?draftTitle(p):(p.title||''),body=isDraft?draftBody(p):(p.body||''),summary=p.excerpt||strip(body);
   const tag=isDraft?(p.published?'有未发布修改':'草稿'):'已发布';
   return '<article class="card '+(isDraft?'draft-card':'')+'" data-id="'+p.id+'"><span class="card-meta">'+tag+' · '+new Date(p.updated).toLocaleDateString('zh-CN')+'</span><h3>'+esc(t||'无标题文章')+'</h3><p>'+esc(summary).slice(0,100)+'</p><b>'+(isDraft?'继续编辑 →':'阅读全文 →')+'</b></article>'
 }).join(''):'<div class="empty">'+(view==='published'?'还没有发布文章。':'草稿箱是空的。')+'</div>'
}
document.querySelectorAll('.library-tab').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('.library-tab').forEach(x=>x.classList.toggle('active',x===b));render()});
box.onclick=e=>{const c=e.target.closest('.card');if(!c)return;const p=(view==='published'?published:drafts).find(x=>String(x.id)===c.dataset.id);if(!p)return;if(view==='drafts'){location.href='editor.html?id='+encodeURIComponent(p.id);return}location.href='article.html?id='+encodeURIComponent(p.id)};
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function strip(s){const d=document.createElement('div');d.innerHTML=s||'';return(d.textContent||'').trim()}
let cloudRefreshing=false;async function refreshAll(){if(cloudRefreshing)return;cloudRefreshing=true;try{if(window.__PRIVATE_MODE__&&window.blogCloud)await window.blogCloud.refresh()}catch(e){console.warn(e)}cloudRefreshing=false;reloadData()}
window.addEventListener('pageshow',refreshAll);window.addEventListener('focus',refreshAll);
window.addEventListener('storage',e=>{if(e.key===KEY)reloadData()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAll()});reloadData();