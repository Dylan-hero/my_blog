const KEY='my_blog_notes_v1';
let data=load(),current=data[0]?.id||null,saveTimer,historyTimer,history=[],historyIndex=-1,restoring=false;
const $=s=>document.querySelector(s),title=$('#title'),content=$('#content'),status=$('#status');
if(!data.length)create();

function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)?x:[]}catch{return[]}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));status.textContent='已保存'}catch(e){status.textContent='存储空间不足';alert('文章中的图片已超过浏览器存储容量。文字不会被限制，请导出备份，并删除或压缩部分图片。')}}
function save(){if(!current)return;const n=data.find(x=>x.id===current);if(!n)return;n.title=title.value;n.body=content.innerHTML;n.updated=Date.now();persist();render();count()}
function changed(){if(restoring)return;status.textContent='正在保存…';clearTimeout(saveTimer);saveTimer=setTimeout(save,600);clearTimeout(historyTimer);historyTimer=setTimeout(recordHistory,250);count()}
function state(){return{title:title.value,body:content.innerHTML}}
function recordHistory(){const s=state(),last=history[historyIndex];if(last&&last.title===s.title&&last.body===s.body)return;history=history.slice(0,historyIndex+1);history.push(s);if(history.length>100)history.shift();historyIndex=history.length-1}
function resetHistory(){history=[state()];historyIndex=0}
function restore(i){if(i<0||i>=history.length)return;restoring=true;historyIndex=i;title.value=history[i].title;content.innerHTML=history[i].body;restoring=false;save();content.focus()}
function undo(){clearTimeout(historyTimer);recordHistory();if(historyIndex>0)restore(historyIndex-1)}
function redo(){if(historyIndex<history.length-1)restore(historyIndex+1)}

function create(){const n={id:crypto.randomUUID?.()||Date.now().toString(),title:'',body:'',updated:Date.now(),published:false};data.unshift(n);current=n.id;persist();show();render()}
function show(){const n=data.find(x=>x.id===current);if(!n)return;restoring=true;title.value=n.title||'';content.innerHTML=n.body||'';restoring=false;$('#publishBtn').textContent=n.published?'取消发布':'发布';count();resetHistory()}
function render(filter=''){const q=filter.toLowerCase();$('#noteList').innerHTML=data.filter(n=>(n.title||'无标题文章').toLowerCase().includes(q)).sort((a,b)=>b.updated-a.updated).map(n=>`<button class="note ${n.id===current?'active':''}" data-id="${n.id}"><b>${escapeHtml(n.title||'无标题文章')}</b><span>${n.published?'● 已发布 · ':''}${new Date(n.updated).toLocaleDateString('zh-CN')}</span></button>`).join('')}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function count(){const t=content.innerText.trim();$('#words').textContent=(t?t.replace(/\s/g,'').length:0)+' 字'}

title.addEventListener('input',changed);content.addEventListener('input',changed);
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey))return;const k=e.key.toLowerCase();if(k==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(k==='y'){e.preventDefault();redo()}});
content.addEventListener('paste',async e=>{
 const cb=e.clipboardData,html=cb.getData('text/html'),plain=cb.getData('text/plain');
 const images=[...cb.items].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
 if(!html&&!plain&&images.length){e.preventDefault();const range=getRange();for(const f of images)insertImage(await compressImage(f),range);changed();return}
 if(html||plain){
   e.preventDefault();let broken=0;
   if(html){const cleaned=sanitizeWordHtml(html);broken=cleaned.broken;insertHtml(cleaned.html)}
   else insertText(plain);
   if(images.length&&broken){const range=getRange();for(const f of images)insertImage(await compressImage(f),range)}
   changed();
   if(broken>images.length)setTimeout(()=>alert('文字已完整粘贴。Word 中有 '+broken+' 张图片属于本地临时文件，浏览器无法直接读取；请使用“插入图片”一次多选这些原图。'),50);
 }
});
function sanitizeWordHtml(raw){const doc=new DOMParser().parseFromString(raw,'text/html');doc.querySelectorAll('script,style,meta,link,object,iframe').forEach(x=>x.remove());let broken=0;doc.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{if(a.name.startsWith('on')||['class','id','lang'].includes(a.name))el.removeAttribute(a.name)});if(el.tagName==='IMG'){const src=el.getAttribute('src')||'';if(!src||/^(file:|blob:|cid:)/i.test(src)){broken++;el.remove()}}});return{html:doc.body.innerHTML,broken}}
function insertHtml(html){content.focus();document.execCommand('insertHTML',false,html)}
function insertText(text){content.focus();document.execCommand('insertText',false,text)}
function getRange(){content.focus();const s=getSelection();if(s.rangeCount&&content.contains(s.anchorNode))return s.getRangeAt(0);const r=document.createRange();r.selectNodeContents(content);r.collapse(false);return r}
function insertImage(src,range){const img=document.createElement('img');img.src=src;img.alt='文章图片';range.deleteContents();range.insertNode(img);range.setStartAfter(img);range.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(range)}
function compressImage(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);resolve(c.toDataURL('image/jpeg',.72))};img.onerror=reject;img.src=u})}

$('#newBtn').onclick=create;
$('#noteList').onclick=e=>{const b=e.target.closest('.note');if(b){save();current=b.dataset.id;show();render()}};
$('#search').oninput=e=>render(e.target.value);
document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const cmd=b.dataset.cmd;if(cmd==='undo')return undo();if(cmd==='redo')return redo();content.focus();document.execCommand(cmd,false,b.dataset.value||null);changed()});
$('#linkBtn').onclick=()=>{const u=prompt('请输入链接地址：','https://');if(u){content.focus();document.execCommand('createLink',false,u);changed()}};
$('#imageFile').onchange=async e=>{content.focus();const range=getRange();for(const file of e.target.files)insertImage(await compressImage(file),range);e.target.value='';changed()};
$('#publishBtn').onclick=()=>{const n=data.find(x=>x.id===current);n.published=!n.published;save();show();alert(n.published?'已发布：现在可在本机浏览器的首页看到。':'已取消发布')};
$('#deleteBtn').onclick=()=>{if(!confirm('确定删除这篇文章吗？此操作不能撤销。'))return;data=data.filter(x=>x.id!==current);current=data[0]?.id||null;persist();current?show():create();render()};
$('#exportBtn').onclick=()=>{save();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='我的笔记备份-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)};
$('#importFile').onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(!Array.isArray(x))throw 0;if(confirm('导入会替换当前浏览器里的文章，确定继续吗？')){data=x;current=data[0]?.id||null;persist();current?show():create();render()}}catch{alert('备份文件格式不正确')}e.target.value=''};
window.addEventListener('beforeunload',save);show();render();