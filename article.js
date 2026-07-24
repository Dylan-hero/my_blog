(()=>{
const id=new URLSearchParams(location.search).get('id');
const $=s=>document.querySelector(s);
const title=$('#articleTitle'),body=$('#articleBody'),date=$('#articleDate'),outline=$('#readerOutline'),edit=$('#editArticle');
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function noteById(){return(window.__CLOUD_NOTES__||[]).find(n=>String(n.id)===String(id))}
async function legacyFallback(){
  if(id!=='mdb-protocol-study')return null;
  const response=await fetch('legacy/mdb-protocol-study-source.html',{cache:'no-store'});
  if(!response.ok)return null;
  const doc=new DOMParser().parseFromString(await response.text(),'text/html'),source=doc.querySelector('.study-content');
  if(!source)return null;
  return{id,title:doc.querySelector('h1')?.textContent?.trim()||'MDB 协议学习记录',body:source.innerHTML,published:true,updated:Date.UTC(2026,6,23),legacy:true}
}
async function persistStructuredNote(note,bodyStructured){
 if(!note||note.legacy||!window.blogCloud?.session)return;
 let changed=!!bodyStructured.changed;
 if(bodyStructured.changed)note.body=bodyStructured.html;
 if(typeof note.draftBody==='string'){
   const draft=window.blogStructure?.structureHtml(note.draftBody,note.id)||{html:note.draftBody,changed:false};
   if(draft.changed){note.draftBody=draft.html;changed=true}
 }
 if(!changed)return;
 note.updated=Date.now();
 try{
   localStorage.setItem('my_blog_notes_v1',JSON.stringify(window.__CLOUD_NOTES__||[]));
   await window.blogCloud.saveNote(note);
   console.info('文章结构已自动修复并同步云端')
 }catch(error){console.warn('文章结构云端同步失败',error)}
}
function buildOutline(){
  const headings=[...body.querySelectorAll('h1,h2,h3,h4')].filter(h=>!h.closest('.doc-toc'));
  if(!headings.length){outline.innerHTML='<div class="outline-empty">这篇文章还没有设置标题级别。</div>';return}
  outline.innerHTML=headings.map((h,index)=>{
    if(!h.id)h.id='reader-section-'+index;
    return'<button class="level-'+h.tagName.slice(1)+'" data-target="'+esc(h.id)+'">'+esc(h.textContent.trim()||'未命名标题')+'</button>'
  }).join('')
}
outline.onclick=e=>{const button=e.target.closest('[data-target]');if(!button)return;document.getElementById(button.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'})};
body.onclick=e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const target=body.querySelector(a.getAttribute('href'));if(target){e.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'})}};
async function boot(){
  let note=noteById();
  if(!note)note=await legacyFallback();
  if(!note||!note.published){title.textContent='文章不存在或尚未发布';body.innerHTML='<p>请返回主页重新选择文章。</p>';edit.hidden=true;outline.innerHTML='';return}
  const structured=window.blogStructure?.structureHtml(note.body,id)||{html:note.body};
  document.title=(note.title||'无标题文章')+' · 我的笔记';
  title.textContent=note.title||'无标题文章';
  date.textContent=new Date(note.publishedAt||note.updated||Date.now()).toLocaleDateString('zh-CN');
  body.innerHTML=structured.html||'';
  body.querySelectorAll('img').forEach(image=>{image.loading='lazy';image.decoding='async';image.fetchPriority='low'});
  edit.href='editor.html?id='+encodeURIComponent(note.id)+(note.legacy?'&legacy=1':'');
  edit.hidden=false;
  const schedule=window.requestIdleCallback||((callback)=>setTimeout(callback,0));
  schedule(buildOutline);
  await persistStructuredNote(note,structured)
}
boot().catch(e=>{console.error(e);title.textContent='文章读取失败';body.innerHTML='<p>'+esc(e.message||String(e))+'</p>';edit.hidden=true});
})();
