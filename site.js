const KEY='my_blog_notes_v1';
const samples=[
 {id:'welcome',title:'欢迎来到我的笔记',body:'<p>这是你的个人记录空间。点击右上角“开始写作”，就可以像使用 Word 一样编辑内容。</p><h2>可以做什么？</h2><p>自动保存、撤销重做，以及把文章显示在首页。</p>',updated:Date.now(),published:true},
 {id:'sample2',title:'从记录开始',body:'<p>不必等到想法完整才落笔。先写下一句话，知识会在反复整理中慢慢形成。</p>',updated:Date.now()-86400000,published:true}
];
function storedNotes(){try{const n=JSON.parse(localStorage.getItem(KEY));return Array.isArray(n)?n:[]}catch{return[]}}
function hasDraft(n){return n&&(n.draftSaved===true||'draftTitle'in n||'draftBody'in n)}
function draftTitle(n){return n&&'draftTitle'in n?(n.draftTitle||''):(n.title||'')}
function draftBody(n){return n&&'draftBody'in n?(n.draftBody||''):(n.body||'')}
const stored=storedNotes(),usingSamples=!stored.length;
const published=(usingSamples?samples:stored.filter(n=>n.published)).sort((a,b)=>b.updated-a.updated);
const drafts=stored.filter(n=>!n.published||hasDraft(n)).sort((a,b)=>b.updated-a.updated);
const box=document.querySelector('#posts'),dlg=document.querySelector('#reader');
let view='published';
publishedCount.textContent=published.length;draftCount.textContent=drafts.length;
function render(){
 const list=view==='published'?published:drafts;
 sectionTitle.textContent=view==='published'?'已发布文章':'草稿箱';
 count.textContent=list.length+' 篇';
 box.innerHTML=list.length?list.map(p=>{
   const isDraft=view==='drafts',t=isDraft?draftTitle(p):(p.title||''),body=isDraft?draftBody(p):(p.body||'');
   const tag=isDraft?(p.published?'有未发布修改':'草稿'):'已发布';
   return '<article class="card '+(isDraft?'draft-card':'')+'" data-id="'+p.id+'"><span class="card-meta">'+tag+' · '+new Date(p.updated).toLocaleDateString('zh-CN')+'</span><h3>'+esc(t||'无标题文章')+'</h3><p>'+esc(strip(body)).slice(0,100)+'</p><b>'+(isDraft?'继续编辑 →':'阅读全文 →')+'</b></article>'
 }).join(''):'<div class="empty">'+(view==='published'?'还没有发布文章。':'草稿箱是空的。')+'</div>'
}
document.querySelectorAll('.library-tab').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('.library-tab').forEach(x=>x.classList.toggle('active',x===b));render()});
box.onclick=e=>{const c=e.target.closest('.card');if(!c)return;const p=(view==='published'?published:drafts).find(x=>x.id===c.dataset.id);if(!p)return;if(view==='drafts'){location.href='editor.html?id='+encodeURIComponent(p.id);return}readTitle.textContent=p.title||'无标题文章';readDate.textContent=new Date(p.updated).toLocaleDateString('zh-CN');readBody.innerHTML=p.body||'';editPost.hidden=usingSamples;editPost.href='editor.html?id='+encodeURIComponent(p.id);dlg.showModal()};
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function strip(s){const d=document.createElement('div');d.innerHTML=s||'';return(d.textContent||'').trim()}
document.querySelector('.close').onclick=()=>dlg.close();dlg.onclick=e=>{if(e.target===dlg)dlg.close()};render();