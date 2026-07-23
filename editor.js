const KEY='my_blog_notes_v1',AUTO_KEY='my_blog_autosave_v1';
let data=load();
const requestedId=new URLSearchParams(location.search).get('id');
let current=data.some(n=>n.id===requestedId)?requestedId:(data[0]?.id||null);
let autoSave=localStorage.getItem(AUTO_KEY)!=='false',dirty=false,saveTimer,historyTimer,history=[],historyIndex=-1,restoring=false,diagnosticMode=false,savedRange=null;
const $=s=>document.querySelector(s),title=$('#title'),content=$('#content'),status=$('#status'),autoSaveToggle=$('#autoSaveToggle');
if(!data.length)create();

function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)?x:[]}catch{return[]}}
function savedLabel(){const n=data.find(x=>x.id===current);return n?.published?'已保存 · 已发布':'已保存'}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));dirty=false;status.textContent=savedLabel()}catch(e){status.textContent='存储空间不足';alert('文章中的图片已超过浏览器存储容量。文字不会被限制，请导出备份，并删除或压缩部分图片。')}}
function save(){if(!current)return;const n=data.find(x=>x.id===current);if(!n)return;n.title=title.value;n.body=content.innerHTML;n.updated=Date.now();persist();render();count();updateOutline()}
function changed(){if(restoring)return;dirty=true;status.textContent=autoSave?'正在自动保存…':'有未保存更改';clearTimeout(saveTimer);if(autoSave)saveTimer=setTimeout(save,700);clearTimeout(historyTimer);historyTimer=setTimeout(recordHistory,250);count();updateOutline()}
function state(){return{title:title.value,body:content.innerHTML}}
function recordHistory(){const s=state(),last=history[historyIndex];if(last&&last.title===s.title&&last.body===s.body)return;history=history.slice(0,historyIndex+1);history.push(s);if(history.length>100)history.shift();historyIndex=history.length-1}
function resetHistory(){history=[state()];historyIndex=0}
function restore(i){if(i<0||i>=history.length)return;restoring=true;historyIndex=i;title.value=history[i].title;content.innerHTML=history[i].body;restoring=false;save();content.focus()}
function undo(){clearTimeout(historyTimer);recordHistory();if(historyIndex>0)restore(historyIndex-1)}
function redo(){if(historyIndex<history.length-1)restore(historyIndex+1)}

function create(){if(current&&dirty&&!autoSave&&!confirm('当前文章有未保存更改。确定放弃更改并新建文章吗？'))return;const n={id:crypto.randomUUID?.()||Date.now().toString(),title:'',body:'',updated:Date.now(),published:false};data.unshift(n);current=n.id;persist();show();render()}
function show(){const n=data.find(x=>x.id===current);if(!n)return;restoring=true;title.value=n.title||'';content.innerHTML=n.body||'';restoring=false;$('#publishBtn').textContent=n.published?'取消发布':'发布';dirty=false;status.textContent=savedLabel();window.history.replaceState(null,'','editor.html?id='+encodeURIComponent(current));count();resetHistory();updateOutline()}
function render(filter=''){const q=filter.toLowerCase();$('#noteList').innerHTML=data.filter(n=>(n.title||'无标题文章').toLowerCase().includes(q)).sort((a,b)=>b.updated-a.updated).map(n=>`<button class="note ${n.id===current?'active':''}" data-id="${n.id}"><b>${escapeHtml(n.title||'无标题文章')}</b><span>${n.published?'● 已发布 · ':''}${new Date(n.updated).toLocaleDateString('zh-CN')}</span></button>`).join('')}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function count(){const t=content.innerText.trim();$('#words').textContent=(t?t.replace(/\s/g,'').length:0)+' 字'}

title.addEventListener('input',changed);content.addEventListener('input',changed);
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey))return;const k=e.key.toLowerCase();if(k==='s'){e.preventDefault();clearTimeout(saveTimer);save()}else if(k==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(k==='y'){e.preventDefault();redo()}});
content.addEventListener('paste',async e=>{
 const cb=e.clipboardData;
 const types=[...cb.types],html=cb.getData('text/html')||'',plain=cb.getData('text/plain')||'',rtf=cb.getData('text/rtf')||'';
 const files=[...cb.items].filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);
 const images=files.filter(f=>f.type.startsWith('image/'));
 const isWord=/mso-|urn:schemas-microsoft-com|Microsoft Word|WordDocument/i.test(html);
 e.preventDefault();
 let broken=0,mode='';
 if(rtf&&!html){
   const parsed=parseRtf(rtf),best=parsed.text.length>plain.length?parsed.text:plain;
   insertPlainWithLines(best);mode='RTF兼容模式';
   if(parsed.images.length){const range=getRange();for(const src of parsed.images)insertImage(src,range)}
 }else if(isWord&&plain){
   insertPlainWithLines(plain);mode='Word纯文字完整模式';
 }else if(html){
   const cleaned=sanitizeWordHtml(html);broken=cleaned.broken;insertHtml(cleaned.html);mode='HTML格式模式';
 }else if(plain){
   if(looksLikeTable(plain)){insertTableFromTSV(plain);mode='制表符表格模式'}
   else{insertPlainWithLines(plain);mode='纯文字模式'}
 }
 if(images.length){
   const range=getRange();for(const f of images)insertImage(await compressImage(f),range);
 }
 changed();
 const report='剪贴板检查结果：\\n数据类型：'+(types.join(', ')||'无')+
   '\\n纯文字长度：'+plain.length+' 字符'+
   '\\nHTML长度：'+html.length+' 字符'+
   '\\nRTF长度：'+rtf.length+' 字符'+
   '\\n是否来自Word：'+(isWord?'是':'否')+
   '\\n图片文件：'+images.length+' 个'+
   '\\n失效图片引用：'+broken+' 个'+
   '\\n本次处理：'+(mode||'未发现可粘贴内容');
 if(diagnosticMode){diagnosticMode=false;setTimeout(()=>alert(report),100)}
 else if(isWord&&broken>images.length)setTimeout(()=>alert('文字已按完整模式粘贴。Word没有把其中 '+broken+' 张图片作为真实图片交给浏览器，请点击“插入图片”批量选择原图。需要详细信息可点“检查剪贴板”。'),100);
});
function insertPlainWithLines(text){
 content.focus();const r=getRange(),frag=document.createDocumentFragment(),lines=text.replace(/\r\n/g,'\n').split('\n');
 lines.forEach((line,i)=>{if(i)frag.appendChild(document.createElement('br'));frag.appendChild(document.createTextNode(line))});
 r.deleteContents();r.insertNode(frag);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);
}
function parseRtf(rtf){
 const images=[];
 const pict=/\{\\pict[\s\S]*?\}/gi;
 rtf=rtf.replace(pict,block=>{
   const mime=/\\pngblip/i.test(block)?'image/png':(/\\jpe?gblip/i.test(block)?'image/jpeg':'');
   const runs=block.match(/[0-9a-fA-F][0-9a-fA-F\s]{199,}/g)||[];
   const hex=runs.map(x=>x.replace(/\s/g,'')).sort((a,b)=>b.length-a.length)[0]||'';
   if(mime&&hex.length>200){try{let bin='';for(let i=0;i<hex.length-1;i+=2)bin+=String.fromCharCode(parseInt(hex.slice(i,i+2),16));images.push('data:'+mime+';base64,'+btoa(bin))}catch(e){}}
   return ' ';
 });
 let out='',i=0,uc=1,skip=0,stack=[],ign=false;
 const destinations=new Set(['fonttbl','colortbl','stylesheet','info','header','footer','object','datastore','themedata','xmlnstbl','listtable','listoverridetable','generator']);
 while(i<rtf.length){
   const c=rtf[i];
   if(c==='{'){stack.push({uc,ign});i++;continue}
   if(c==='}'){const s=stack.pop();if(s){uc=s.uc;ign=s.ign}i++;continue}
   if(c!=='\\'){if(!ign&&skip===0&&c!=='\r'&&c!=='\n')out+=c;else if(skip>0)skip--;i++;continue}
   i++;const n=rtf[i];
   if(n==='\\'||n==='{'||n==='}'){if(!ign&&skip===0)out+=n;else if(skip>0)skip--;i++;continue}
   if(n==="'"){const h=rtf.slice(i+1,i+3);if(!ign&&skip===0)out+=new TextDecoder('windows-1252').decode(Uint8Array.of(parseInt(h,16)));else if(skip>0)skip--;i+=3;continue}
   if(n==='*'){ign=true;i++;continue}
   const m=rtf.slice(i).match(/^([a-zA-Z]+)(-?\d+)? ?/);
   if(!m){i++;continue}
   const word=m[1].toLowerCase(),num=m[2]===undefined?null:Number(m[2]);i+=m[0].length;
   if(destinations.has(word)){ign=true;continue}
   if(ign)continue;
   if(word==='uc'){uc=num||1;continue}
   if(word==='u'){let code=num||0;if(code<0)code+=65536;out+=String.fromCharCode(code);skip=uc;continue}
   if(word==='par'||word==='line')out+='\n';else if(word==='tab')out+='\t';
 }
 return{text:out.replace(/\n{3,}/g,'\n\n').trim(),images};
}
function sanitizeWordHtml(raw){const doc=new DOMParser().parseFromString(raw,'text/html');doc.querySelectorAll('script,style,meta,link,object,iframe').forEach(x=>x.remove());let broken=0;doc.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{if(a.name.startsWith('on')||['class','id','lang'].includes(a.name))el.removeAttribute(a.name)});if(el.tagName==='IMG'){const src=el.getAttribute('src')||'';if(!src||/^(file:|blob:|cid:)/i.test(src)){broken++;el.remove()}}});return{html:doc.body.innerHTML,broken}}
function insertHtml(html){restoreSelection();document.execCommand('insertHTML',false,html);rememberRange()}
function insertText(text){restoreSelection();document.execCommand('insertText',false,text);rememberRange()}
function getRange(){const s=getSelection();if(s.rangeCount&&content.contains(s.anchorNode))return s.getRangeAt(0);if(savedRange)return savedRange.cloneRange();const r=document.createRange();r.selectNodeContents(content);r.collapse(false);return r}
function rememberRange(){const s=getSelection();if(s.rangeCount&&content.contains(s.anchorNode))savedRange=s.getRangeAt(0).cloneRange()}
function restoreSelection(){content.focus();const s=getSelection();s.removeAllRanges();s.addRange(savedRange?savedRange.cloneRange():getRange())}
function insertImage(src,range){const img=document.createElement('img');img.src=src;img.alt='文章图片';range.deleteContents();range.insertNode(img);range.setStartAfter(img);range.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(range)}
function compressImage(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);resolve(c.toDataURL('image/jpeg',.72))};img.onerror=reject;img.src=u})}


function looksLikeTable(text){const lines=text.replace(/\r\n/g,'\n').split('\n').filter(x=>x.trim());return lines.length>1&&lines.filter(x=>x.includes('\t')).length>=2}
function insertTableFromTSV(text){const rows=text.replace(/\r\n/g,'\n').split('\n').filter((x,i,a)=>x.length||i<a.length-1).map(x=>x.split('\t'));const cols=Math.max(...rows.map(r=>r.length));let html='<table><tbody>';rows.forEach((row,ri)=>{html+='<tr>';for(let i=0;i<cols;i++){const tag=ri===0?'th':'td';html+='<'+tag+'>'+escapeHtml(row[i]||'')+'</'+tag+'>'}html+='</tr>'});insertHtml(html+'</tbody></table><p><br></p>')}
function makeTable(rows,cols){let html='<table><tbody>';for(let r=0;r<rows;r++){html+='<tr>';for(let c=0;c<cols;c++){const tag=r===0?'th':'td';html+='<'+tag+'><br></'+tag+'>'}html+='</tr>'}insertHtml(html+'</tbody></table><p><br></p>');changed()}
function currentCell(){const s=getSelection();if(!s.rangeCount)return null;let n=s.anchorNode?.nodeType===3?s.anchorNode.parentElement:s.anchorNode;return n?.closest?.('td,th')||null}
function tableAction(type){restoreSelection();const cell=currentCell(),table=cell?.closest('table');if(!cell||!table){alert('请先把光标放进需要编辑的表格单元格中。');return}const row=cell.parentElement,index=[...row.children].indexOf(cell);
 if(type==='addRow'){const n=document.createElement('tr');for(let i=0;i<row.children.length;i++){const td=document.createElement('td');td.innerHTML='<br>';n.appendChild(td)}row.after(n)}
 if(type==='addCol'){[...table.rows].forEach((r,ri)=>{const tag=ri===0?'th':'td',x=document.createElement(tag);x.innerHTML='<br>';r.children[index]?.after(x)})}
 if(type==='delRow'){row.remove();if(!table.rows.length)table.remove()}
 if(type==='delCol'){[...table.rows].forEach(r=>r.children[index]?.remove());if(!table.rows[0]?.cells.length)table.remove()}
 if(type==='delTable'&&confirm('确定删除整个表格吗？'))table.remove();changed()
}
function getBlocksInSelection(){const r=getRange(),all=[...content.querySelectorAll('p,div,h1,h2,h3,h4,blockquote,li,td,th')];const hit=all.filter(x=>{try{return r.intersectsNode(x)}catch{return false}});if(hit.length)return hit.filter(x=>!hit.some(y=>y!==x&&y.contains(x)));let n=r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer;return[n.closest('p,div,h1,h2,h3,h4,blockquote,li,td,th')||content]}
function applyLineHeight(value){restoreSelection();getBlocksInSelection().forEach(x=>x.style.lineHeight=value);changed()}
function applyCommand(cmd,value=null){restoreSelection();document.execCommand('styleWithCSS',false,true);document.execCommand(cmd,false,value);rememberRange();changed()}
function setFontSize(value){restoreSelection();document.execCommand('fontSize',false,value);content.querySelectorAll('font[size]').forEach(x=>{const map={1:'10px',2:'12px',3:'14px',4:'16px',5:'18px',6:'24px',7:'32px'};x.style.fontSize=map[x.getAttribute('size')]||'14px';x.removeAttribute('size')});rememberRange();changed()}
function headingItems(){return[...content.querySelectorAll('h1,h2,h3,h4')].filter(h=>!h.closest('.doc-toc')).map((h,i)=>{if(!h.id)h.id='section-'+Date.now().toString(36)+'-'+i;return h})}
function updateOutline(){const box=$('#outlineList');if(!box)return;const hs=headingItems();box.innerHTML=hs.length?hs.map(h=>'<button class="level-'+h.tagName.slice(1)+'" data-target="'+h.id+'">'+escapeHtml(h.innerText.trim()||'未命名标题')+'</button>').join(''):'<div class="outline-empty">把段落设置为“标题 1～4”，这里会自动生成导航。</div>'}
function insertOrUpdateTOC(){const hs=headingItems();if(!hs.length){alert('请先使用“标题级别”设置至少一个标题。');return}const items=hs.map(h=>'<li class="toc-l'+h.tagName.slice(1)+'"><a href="#'+h.id+'">'+escapeHtml(h.innerText.trim()||'未命名标题')+'</a></li>').join('');let toc=content.querySelector('.doc-toc');if(toc)toc.innerHTML='<h2>目录</h2><ol>'+items+'</ol>';else insertHtml('<nav class="doc-toc" contenteditable="false"><h2>目录</h2><ol>'+items+'</ol></nav><p><br></p>');changed()}
document.addEventListener('selectionchange',rememberRange);
document.querySelectorAll('.pane-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.pane-tabs button').forEach(x=>x.classList.toggle('active',x===b));$('#notesPane').hidden=b.dataset.pane!=='notes';$('#outlinePane').hidden=b.dataset.pane!=='outline';if(b.dataset.pane==='outline')updateOutline()});
$('#outlineList').onclick=e=>{const b=e.target.closest('[data-target]');if(!b)return;const h=document.getElementById(b.dataset.target);h?.scrollIntoView({behavior:'smooth',block:'center'});h?.classList.add('outline-flash');setTimeout(()=>h?.classList.remove('outline-flash'),800)};
$('#fontFamily').onchange=e=>applyCommand('fontName',e.target.value);
$('#fontSize').onchange=e=>setFontSize(e.target.value);
$('#textColor').oninput=e=>{document.documentElement.style.setProperty('--tool-color',e.target.value);applyCommand('foreColor',e.target.value)};
$('#highlightColor').oninput=e=>applyCommand('hiliteColor',e.target.value);
$('#blockFormat').onchange=e=>{applyCommand('formatBlock',e.target.value);updateOutline()};
$('#lineHeight').onchange=e=>applyLineHeight(e.target.value);
$('#tableBtn').onclick=()=>{const rv=prompt('表格行数（1～30）：','4');if(rv===null)return;const cv=prompt('表格列数（1～12）：','3');if(cv===null)return;const r=Math.min(30,Math.max(1,parseInt(rv)||1)),c=Math.min(12,Math.max(1,parseInt(cv)||1));makeTable(r,c)};
$('#tocBtn').onclick=insertOrUpdateTOC;
$('#addRowBtn').onclick=()=>tableAction('addRow');$('#addColBtn').onclick=()=>tableAction('addCol');$('#delRowBtn').onclick=()=>tableAction('delRow');$('#delColBtn').onclick=()=>tableAction('delCol');$('#delTableBtn').onclick=()=>tableAction('delTable');
content.addEventListener('click',e=>{const a=e.target.closest('.doc-toc a');if(a){e.preventDefault();content.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth',block:'center'})}});
autoSaveToggle.checked=autoSave;
autoSaveToggle.onchange=()=>{autoSave=autoSaveToggle.checked;localStorage.setItem(AUTO_KEY,String(autoSave));if(autoSave){status.textContent='正在自动保存…';save()}else status.textContent=dirty?'有未保存更改':savedLabel()};
$('#saveBtn').onclick=()=>{clearTimeout(saveTimer);save()};
$('#newBtn').onclick=create;
$('#noteList').onclick=e=>{const b=e.target.closest('.note');if(!b||b.dataset.id===current)return;if(dirty&&!autoSave&&!confirm('当前文章尚未保存。确定放弃更改并切换文章吗？'))return;if(autoSave&&dirty)save();current=b.dataset.id;show();render()};
$('#search').oninput=e=>render(e.target.value);
document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const cmd=b.dataset.cmd;if(cmd==='undo')return undo();if(cmd==='redo')return redo();applyCommand(cmd,b.dataset.value||null)});
$('#linkBtn').onclick=()=>{const u=prompt('请输入链接地址：','https://');if(u){content.focus();document.execCommand('createLink',false,u);changed()}};
$('#clipboardBtn').onclick=()=>{diagnosticMode=true;content.focus();alert('现在请回到正文区域，按 Ctrl+V 粘贴刚才从 Word 复制的内容。粘贴后会显示检查结果。')};
$('#imageFile').onchange=async e=>{content.focus();const range=getRange();for(const file of e.target.files)insertImage(await compressImage(file),range);e.target.value='';changed()};
$('#publishBtn').onclick=()=>{const n=data.find(x=>x.id===current);n.published=!n.published;save();show();alert(n.published?'已发布：现在可在本机浏览器的首页看到。':'已取消发布')};
$('#deleteBtn').onclick=()=>{if(!confirm('确定删除这篇文章吗？此操作不能撤销。'))return;data=data.filter(x=>x.id!==current);current=data[0]?.id||null;persist();current?show():create();render()};
$('#exportBtn').onclick=()=>{save();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='我的笔记备份-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)};
$('#importFile').onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(!Array.isArray(x))throw 0;if(confirm('导入会替换当前浏览器里的文章，确定继续吗？')){data=x;current=data[0]?.id||null;persist();current?show():create();render()}}catch{alert('备份文件格式不正确')}e.target.value=''};
window.addEventListener('beforeunload',e=>{if(autoSave&&dirty)save();else if(dirty){e.preventDefault();e.returnValue=''}});show();render();