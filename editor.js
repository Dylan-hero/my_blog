const KEY='my_blog_notes_v1',AUTO_KEY='my_blog_autosave_v1';
let data=load();
const params=new URLSearchParams(location.search),requestedId=params.get('id');
let current=data.some(n=>String(n.id)===String(requestedId))?String(requestedId):(data[0]?.id||null);
let autoSave=localStorage.getItem(AUTO_KEY)!=='false',dirty=false,saveTimer,historyTimer,history=[],historyIndex=-1,restoring=false,diagnosticMode=false,savedRange=null;
let cloudSyncQueue=Promise.resolve(),lastCloudSync=Promise.resolve(true),syncRevision=0;
const $=s=>document.querySelector(s),title=$('#title'),content=$('#content'),status=$('#status'),autoSaveToggle=$('#autoSaveToggle');

function normalizeNotes(list){return list.map(n=>({...n,id:String(n.id)}))}
function load(){if(Array.isArray(window.__CLOUD_NOTES__))return normalizeNotes(window.__CLOUD_NOTES__);try{const x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)?normalizeNotes(x):[]}catch{return[]}}
function normalizeTitle(s){return String(s||'').replace(/\\s+/g,'').toLowerCase()}
function hasDraft(n){return n&&(n.draftSaved===true||'draftTitle'in n||'draftBody'in n)}
function editTitle(n){return n&&'draftTitle'in n?(n.draftTitle||''):(n?.title||'')}
function editBody(n){return n&&'draftBody'in n?(n.draftBody||''):(n?.body||'')}
function savedLabel(){const n=data.find(x=>x.id===current);if(n?.published&&hasDraft(n))return'草稿已保存 · 线上仍为旧版本';if(n?.published)return'已保存 · 已发布';return'已存入草稿箱'}
function queueCloudSync(n){
 const snapshot=JSON.parse(JSON.stringify(n)),noteId=String(n.id),label=savedLabel(),revision=++syncRevision;
 status.textContent=label+' · 正在同步云端';
 const task=cloudSyncQueue.then(()=>window.blogCloud.saveNote(snapshot));
 cloudSyncQueue=task.catch(()=>{});
 lastCloudSync=task.then(()=>{if(revision===syncRevision&&String(current)===noteId)status.textContent=label+' · 已同步云端';return true}).catch(e=>{if(revision===syncRevision&&String(current)===noteId)status.textContent='本地已保存 · 云端同步失败';console.error(e);return false});
 return lastCloudSync;
}
function persist(){try{const raw=JSON.stringify(data);localStorage.setItem(KEY,raw);if(!localStorage.getItem(KEY))throw new Error('verify failed');dirty=false;status.textContent=savedLabel();const n=data.find(x=>String(x.id)===String(current));if(n&&window.blogCloud?.session)queueCloudSync(n);else lastCloudSync=Promise.resolve(true);return true}catch(e){status.textContent='草稿保存失败 · 存储空间不足';alert('草稿没有写入成功。当前文章中的图片可能超过浏览器本地存储容量，请先导出备份或删除部分大图。');return false}}
function save(forceDraft=false){if(!current)return false;const n=data.find(x=>x.id===current);if(!n)return false;const same=n.published&&n.title===title.value&&n.body===content.innerHTML;if(same&&!forceDraft){delete n.draftSaved;delete n.draftTitle;delete n.draftBody}else{n.draftSaved=true;if(same){delete n.draftTitle;delete n.draftBody}else{n.draftTitle=title.value;n.draftBody=content.innerHTML}}n.updated=Date.now();const ok=persist();render();count();updateOutline();updatePublishControls();return ok}
async function publishCurrent(){const n=data.find(x=>String(x.id)===String(current));if(!n)return;n.title=title.value;n.body=content.innerHTML;n.published=true;n.publishedAt=Date.now();n.updated=Date.now();delete n.draftSaved;delete n.draftTitle;delete n.draftBody;dirty=false;if(!persist())return;render();show();const ok=await lastCloudSync;alert(ok?'已发布并同步到私人云端。其他电脑使用同一GitHub账号登录后即可看到。':'文章已保存在当前电脑，但云端同步失败，请不要关闭页面，稍后再次点击发布。')}
async function unpublishCurrent(){
 const n=data.find(x=>String(x.id)===String(current));
 if(!n||!confirm('取消发布后，文章将只保留在草稿箱，确定继续吗？'))return;
 const button=$('#unpublishBtn');button.disabled=true;
 n.draftSaved=true;n.draftTitle=title.value;n.draftBody=content.innerHTML;n.published=false;n.updated=Date.now();
 if(!persist()){button.disabled=false;return}
 show();render();
 const ok=await lastCloudSync;button.disabled=false;
 alert(ok?'已取消发布并同步到云端草稿箱。返回主页后，已发布数量会立即减少。':'当前电脑已取消发布，但云端同步失败，请稍后再试。')
}
function updatePublishControls(){const n=data.find(x=>x.id===current);if(!n)return;$('#publishBtn').textContent=n.published?(dirty||hasDraft(n)?'发布更新':'重新发布'):'发布';$('#unpublishBtn').hidden=!n.published}
function resolvePending(action){if(!dirty)return true;if(confirm('当前内容还没有保存。是否先存入草稿箱，再'+action+'？')){save();return true}return confirm('不保存这些修改，直接'+action+'？')}
function changed(){if(restoring)return;dirty=true;status.textContent=autoSave?'正在自动保存草稿…':'有未保存的草稿';updatePublishControls();clearTimeout(saveTimer);if(autoSave)saveTimer=setTimeout(save,700);clearTimeout(historyTimer);historyTimer=setTimeout(recordHistory,250);count();updateOutline()}
function state(){return{title:title.value,body:content.innerHTML}}
function recordHistory(){const s=state(),last=history[historyIndex];if(last&&last.title===s.title&&last.body===s.body)return;history=history.slice(0,historyIndex+1);history.push(s);if(history.length>100)history.shift();historyIndex=history.length-1}
function resetHistory(){history=[state()];historyIndex=0}
function restore(i){if(i<0||i>=history.length)return;restoring=true;historyIndex=i;title.value=history[i].title;content.innerHTML=history[i].body;restoring=false;save();content.focus()}
function undo(){clearTimeout(historyTimer);recordHistory();if(historyIndex>0)restore(historyIndex-1)}
function redo(){if(historyIndex<history.length-1)restore(historyIndex+1)}

function create(){if(current&&!resolvePending('新建文章'))return;const n={id:crypto.randomUUID?.()||Date.now().toString(),title:'',body:'',updated:Date.now(),published:false};data.unshift(n);current=n.id;persist();show();render()}
function show(){const n=data.find(x=>x.id===current);if(!n)return;hideTablePicker();hideTableTools();restoring=true;title.value=editTitle(n);content.innerHTML=editBody(n);restoring=false;dirty=false;status.textContent=savedLabel();updatePublishControls();window.history.replaceState(null,'','editor.html?id='+encodeURIComponent(current));count();resetHistory();updateOutline()}
function render(filter=''){const q=filter.toLowerCase();$('#noteList').innerHTML=data.filter(n=>(editTitle(n)||'无标题文章').toLowerCase().includes(q)).sort((a,b)=>b.updated-a.updated).map(n=>`<button class="note ${n.id===current?'active':''}" data-id="${n.id}"><b>${escapeHtml(editTitle(n)||'无标题文章')}</b><span>${n.published?(hasDraft(n)?'● 已发布 · 有草稿 · ':'● 已发布 · '):'○ 草稿 · '}${new Date(n.updated).toLocaleDateString('zh-CN')}</span></button>`).join('')}
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
 if(html){
   // Word 同时提供 HTML 和纯文字时必须优先 HTML，否则表格、颜色和标题级别都会被主动丢弃。
   const cleaned=sanitizeWordHtml(html);broken=cleaned.broken;insertHtml(cleaned.html);mode=isWord?'Word HTML富文本模式':'HTML格式模式';
   if(rtf&&broken){
     const parsed=parseRtf(rtf),range=getRange();
     for(const src of parsed.images.slice(0,broken))insertImage(src,range)
   }
 }else if(rtf){
   const parsed=parseRtf(rtf),best=parsed.text.length>plain.length?parsed.text:plain;
   insertPlainWithLines(best);mode='RTF兼容模式';
   if(parsed.images.length){const range=getRange();for(const src of parsed.images)insertImage(src,range)}
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
function sanitizeWordHtml(raw){
 const doc=new DOMParser().parseFromString(raw,'text/html');
 doc.querySelectorAll('script,style,meta,link,object,iframe').forEach(x=>x.remove());
 // Word 的“标题 1～4”通常是带 MsoHeading 类的段落；转成语义标题后才能生成导航。
 doc.querySelectorAll('p,div').forEach(el=>{
   const cls=el.getAttribute('class')||'',style=el.getAttribute('style')||'';
   const match=cls.match(/(?:Mso)?Heading\s*([1-4])/i)||style.match(/mso-outline-level\s*:\s*([1-4])/i);
   if(!match)return;
   const heading=doc.createElement('h'+Math.min(4,Math.max(1,Number(match[1]))));
   [...el.attributes].forEach(a=>heading.setAttribute(a.name,a.value));
   while(el.firstChild)heading.appendChild(el.firstChild);
   el.replaceWith(heading)
 });
 let broken=0;
 doc.querySelectorAll('*').forEach(el=>{
   [...el.attributes].forEach(a=>{
     if(a.name.startsWith('on')||['class','id','lang'].includes(a.name))el.removeAttribute(a.name);
     if(a.name==='style'&&/(?:expression\s*\(|javascript:|vbscript:|url\s*\()/i.test(a.value))el.removeAttribute(a.name)
   });
   if(el.tagName==='IMG'){
     const src=el.getAttribute('src')||'';
     if(!src||/^(file:|blob:|cid:)/i.test(src)){broken++;el.remove()}
   }
 });
 return{html:doc.body.innerHTML,broken}
}
function insertHtml(html){restoreSelection();document.execCommand('insertHTML',false,html);rememberRange()}
function insertText(text){restoreSelection();document.execCommand('insertText',false,text);rememberRange()}
function getRange(){const s=getSelection();if(s.rangeCount&&content.contains(s.anchorNode))return s.getRangeAt(0);if(savedRange)return savedRange.cloneRange();const r=document.createRange();r.selectNodeContents(content);r.collapse(false);return r}
function rememberRange(){const s=getSelection();if(s.rangeCount&&content.contains(s.anchorNode))savedRange=s.getRangeAt(0).cloneRange()}
function restoreSelection(){content.focus();const s=getSelection();s.removeAllRanges();s.addRange(savedRange?savedRange.cloneRange():getRange())}
function insertImage(src,range){const img=document.createElement('img');img.src=src;img.alt='文章图片';range.deleteContents();range.insertNode(img);range.setStartAfter(img);range.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(range)}
function compressImage(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);resolve(c.toDataURL('image/jpeg',.72))};img.onerror=reject;img.src=u})}


function looksLikeTable(text){const lines=text.replace(/\r\n/g,'\n').split('\n').filter(x=>x.trim());return lines.length>1&&lines.filter(x=>x.includes('\t')).length>=2}
function insertTableFromTSV(text){const rows=text.replace(/\r\n/g,'\n').split('\n').filter((x,i,a)=>x.length||i<a.length-1).map(x=>x.split('\t'));const cols=Math.max(...rows.map(r=>r.length));let html='<table><tbody>';rows.forEach((row,ri)=>{html+='<tr>';for(let i=0;i<cols;i++){const tag=ri===0?'th':'td';html+='<'+tag+'>'+escapeHtml(row[i]||'')+'</'+tag+'>'}html+='</tr>'});insertHtml(html+'</tbody></table><p><br></p>')}
const TABLE_PICK_ROWS=8,TABLE_PICK_COLS=20,TABLE_THEMES=['#1f1f1f','#4472c4','#ed7d31','#ffc000','#70ad47','#2fb8b3','#e84c5b','#dcecf7'];
let selectedTableTheme='#dcecf7',pickerRows=1,pickerCols=1;
function selectCell(cell){
 if(!cell)return;const range=document.createRange();range.selectNodeContents(cell);range.collapse(true);
 const selection=getSelection();selection.removeAllRanges();selection.addRange(range);savedRange=range.cloneRange();activeTableCell=cell
}
function makeTable(rows,cols,theme=selectedTableTheme){
 const marker='new-table-'+Date.now().toString(36);let html='<table id="'+marker+'" data-user-table="true" style="--table-theme:'+theme+'"><tbody>';
 for(let r=0;r<rows;r++){html+='<tr>';for(let c=0;c<cols;c++){const tag=r===0?'th':'td',style=r===0?' style="background-color:'+theme+'"':'';html+='<'+tag+style+'><br></'+tag+'>'}html+='</tr>'}
 insertHtml(html+'</tbody></table><p><br></p>');
 const table=document.getElementById(marker);if(table){table.removeAttribute('id');const cell=table.rows[0]?.cells[0];selectCell(cell);showTableTools(cell)}
 changed()
}
function paintTablePicker(rows=pickerRows,cols=pickerCols){
 pickerRows=Math.max(1,Math.min(TABLE_PICK_ROWS,rows));pickerCols=Math.max(1,Math.min(TABLE_PICK_COLS,cols));
 $('#tablePickerLabel').textContent=pickerRows+' 行 × '+pickerCols+' 列 表格';
 $('#tableGrid').querySelectorAll('button').forEach(button=>button.classList.toggle('active',Number(button.dataset.row)<=pickerRows&&Number(button.dataset.col)<=pickerCols))
}
function buildTablePicker(){
 $('#tableGrid').innerHTML=Array.from({length:TABLE_PICK_ROWS},(_,row)=>Array.from({length:TABLE_PICK_COLS},(_,col)=>'<button type="button" role="gridcell" data-row="'+(row+1)+'" data-col="'+(col+1)+'" aria-label="'+(row+1)+' 行 '+(col+1)+' 列"></button>').join('')).join('');
 $('#tableGrid').onpointerover=event=>{const cell=event.target.closest('[data-row]');if(cell)paintTablePicker(Number(cell.dataset.row),Number(cell.dataset.col))};
 $('#tableGrid').onclick=event=>{const cell=event.target.closest('[data-row]');if(!cell)return;makeTable(Number(cell.dataset.row),Number(cell.dataset.col));hideTablePicker()};
 $('#tableThemeColors').innerHTML=TABLE_THEMES.map((color,index)=>'<button type="button" data-color="'+color+'" aria-label="主题颜色 '+(index+1)+'" style="--swatch:'+color+'"></button>').join('');
 $('#tableThemeColors').onclick=event=>{const button=event.target.closest('[data-color]');if(!button)return;selectedTableTheme=button.dataset.color;$('#tableThemeColors').querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button))};
 $('#tableThemeColors').querySelector('[data-color="'+selectedTableTheme+'"]')?.classList.add('active');paintTablePicker()
}
function positionTablePicker(){
 const picker=$('#tablePicker'),button=$('#tableBtn'),rect=button.getBoundingClientRect();picker.hidden=false;
 const width=picker.offsetWidth||500,left=Math.max(8,Math.min(rect.left,innerWidth-width-8)),top=Math.min(rect.bottom+7,innerHeight-(picker.offsetHeight||390)-8);
 picker.style.left=left+'px';picker.style.top=Math.max(8,top)+'px';button.setAttribute('aria-expanded','true')
}
function hideTablePicker(){$('#tablePicker').hidden=true;$('#tableBtn').setAttribute('aria-expanded','false')}
function toggleTablePicker(){if($('#tablePicker').hidden)positionTablePicker();else hideTablePicker()}
function currentCell(){const s=getSelection();if(!s.rangeCount)return null;let n=s.anchorNode?.nodeType===3?s.anchorNode.parentElement:s.anchorNode;return n?.closest?.('td,th')||null}
function tableAction(type){restoreSelection();const cell=currentCell()||activeTableCell?.isConnected&&activeTableCell,table=cell?.closest('table');if(!cell||!table){alert('请先把光标放进需要编辑的表格单元格中。');return}activeTableCell=cell;const row=cell.parentElement,index=[...row.children].indexOf(cell);
 if(type==='addRow'){const n=document.createElement('tr');for(let i=0;i<row.children.length;i++){const td=document.createElement('td');td.innerHTML='<br>';n.appendChild(td)}row.after(n)}
 if(type==='addCol'){[...table.rows].forEach((r,ri)=>{const tag=ri===0?'th':'td',x=document.createElement(tag);x.innerHTML='<br>';r.children[index]?.after(x)})}
 if(type==='delRow'){row.remove();if(!table.rows.length)table.remove()}
 if(type==='delCol'){[...table.rows].forEach(r=>r.children[index]?.remove());if(!table.rows[0]?.cells.length)table.remove()}
 if(type==='delTable'&&confirm('确定删除整个表格吗？')){table.remove();activeTableCell=null;hideTableTools()}
 if(table.isConnected)ensureColgroup(table);changed();requestAnimationFrame(updateTableTools)
}

let activeTableCell=null,tableResize=null;
function logicalColumnIndex(cell){let index=0;for(const sibling of cell.parentElement.cells){if(sibling===cell)break;index+=Math.max(1,sibling.colSpan||1)}return index}
function tableColumnCount(table){return Math.max(1,...[...table.rows].map(row=>[...row.cells].reduce((sum,cell)=>sum+Math.max(1,cell.colSpan||1),0)))}
function ensureColgroup(table){
 let group=table.querySelector(':scope > colgroup');
 if(!group){group=document.createElement('colgroup');group.dataset.userColumns='true';table.insertBefore(group,table.firstChild)}
 const count=tableColumnCount(table);
 while(group.children.length<count)group.appendChild(document.createElement('col'));
 while(group.children.length>count)group.lastElementChild.remove();
 return group
}
function tableColumnCells(cell){
 const column=logicalColumnIndex(cell),table=cell.closest('table');
 return[...table.querySelectorAll('th,td')].filter(item=>{const start=logicalColumnIndex(item);return start<=column&&column<start+Math.max(1,item.colSpan||1)})
}
function tableTargets(cell,scope){
 const table=cell.closest('table');
 if(scope==='row')return[...cell.parentElement.cells];
 if(scope==='column')return tableColumnCells(cell);
 if(scope==='table')return[...table.querySelectorAll('th,td')];
 return[cell]
}
function styleNumber(element,property,fallback=0){const value=parseFloat(getComputedStyle(element)[property]);return Number.isFinite(value)?Math.round(value):fallback}
function colorHex(value,fallback='#ffffff'){
 const parts=String(value||'').match(/[\d.]+/g);if(!parts||parts.length<3||Number(parts[3])===0)return fallback;
 return'#'+parts.slice(0,3).map(value=>Math.max(0,Math.min(255,Math.round(Number(value)))).toString(16).padStart(2,'0')).join('')
}
function tableAlignment(table){
 if(table.dataset.tableAlign)return table.dataset.tableAlign;
 const style=getComputedStyle(table);if(style.marginLeft==='auto'&&style.marginRight==='auto')return'center';if(style.marginLeft==='auto')return'right';return'left'
}
function hideTableTools(){$('#tableTools').hidden=true;$('#tableResizeGuide').className='table-resize-guide'}
function updateTableTools(){
 const cell=activeTableCell?.isConnected?activeTableCell:null,table=cell?.closest('table');if(!cell||!table){hideTableTools();return}
 const rect=table.getBoundingClientRect(),tools=$('#tableTools');if(rect.bottom<58||rect.top>innerHeight||rect.right<0||rect.left>innerWidth){tools.hidden=true;return}
 tools.hidden=false;const frame=$('#tableSelectionFrame'),move=$('#tableMoveHandle'),addCol=$('#quickAddCol'),addRow=$('#quickAddRow');
 Object.assign(frame.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
 Object.assign(move.style,{left:Math.max(4,rect.left-27)+'px',top:Math.max(62,rect.top-27)+'px'});
 Object.assign(addCol.style,{left:Math.max(4,Math.min(innerWidth-29,rect.right+6))+'px',top:Math.max(62,Math.min(innerHeight-30,rect.top+rect.height/2-13))+'px'});
 Object.assign(addRow.style,{left:Math.max(4,Math.min(innerWidth-29,rect.left+rect.width/2-13))+'px',top:Math.max(62,Math.min(innerHeight-30,rect.bottom+6))+'px'})
}
function showTableTools(cell){if(!cell?.isConnected)return;activeTableCell=cell;updateTableTools()}
function showResizeGuide(cell,mode,coordinate){
 const guide=$('#tableResizeGuide'),table=cell.closest('table'),rect=table.getBoundingClientRect(),cellRect=cell.getBoundingClientRect();guide.className='table-resize-guide '+mode;
 if(mode==='column')Object.assign(guide.style,{left:(coordinate??cellRect.right)+'px',top:rect.top+'px',width:'2px',height:rect.height+'px'});
 else Object.assign(guide.style,{left:rect.left+'px',top:(coordinate??cellRect.bottom)+'px',width:rect.width+'px',height:'2px'})
}
function closeTableDialog(){const dialog=$('#tableDialog');if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')}
function openTableDialog(){
 restoreSelection();const cell=currentCell()||activeTableCell?.isConnected&&activeTableCell,table=cell?.closest('table');
 if(!cell||!table){alert('请先把光标放进需要设置的表格单元格中。');return}
 activeTableCell=cell;hideTablePicker();
 const cellStyle=getComputedStyle(cell),tableRect=table.getBoundingClientRect(),contentRect=content.getBoundingClientRect();
 $('#tableAutoFit').value=table.style.tableLayout==='fixed'?'fixed':table.style.width==='100%'?'window':'content';
 $('#tableWidth').value=Math.max(20,Math.min(200,Math.round(tableRect.width/Math.max(1,contentRect.width)*100)))||100;
 $('#columnWidth').value=Math.max(40,Math.round(cell.getBoundingClientRect().width/Math.max(1,cell.colSpan||1)));
 $('#rowHeight').value=Math.max(24,Math.round(cell.parentElement.getBoundingClientRect().height));
 $('#cellPaddingTop').value=styleNumber(cell,'paddingTop',8);$('#cellPaddingBottom').value=styleNumber(cell,'paddingBottom',8);
 $('#cellPaddingLeft').value=styleNumber(cell,'paddingLeft',10);$('#cellPaddingRight').value=styleNumber(cell,'paddingRight',10);
 $('#cellSpacing').value=Math.max(0,parseFloat(getComputedStyle(table).borderSpacing)||0);
 const ratio=parseFloat(cellStyle.lineHeight)/Math.max(1,parseFloat(cellStyle.fontSize)),choices=[1,1.15,1.5,1.75,2,2.5];
 $('#cellLineHeight').value=String(choices.reduce((best,value)=>Math.abs(value-ratio)<Math.abs(best-ratio)?value:best,1.5));
 $('#tableBorderWidth').value=styleNumber(cell,'borderTopWidth',1);
 $('#tableBorderColor').value=colorHex(cellStyle.borderTopColor,'#565656');$('#tableFillColor').value=colorHex(cellStyle.backgroundColor,'#ffffff');
 $('#tableAlign').value=tableAlignment(table);
 $('#tableTextAlign').value=['center','right'].includes(cellStyle.textAlign)?cellStyle.textAlign:'left';
 $('#tableVerticalAlign').value=['middle','bottom'].includes(cellStyle.verticalAlign)?cellStyle.verticalAlign:'top';
 const dialog=$('#tableDialog');if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')
}
function applyTableProperties(){
 const cell=activeTableCell?.isConnected?activeTableCell:null,table=cell?.closest('table');if(!cell||!table){closeTableDialog();return}
 const scope=$('#tableScope').value,targets=tableTargets(cell,scope);
 const width=Math.max(20,Math.min(200,Number($('#tableWidth').value)||100)),columnWidth=Math.max(40,Math.min(800,Number($('#columnWidth').value)||120));
 const rowHeight=Math.max(24,Math.min(500,Number($('#rowHeight').value)||32));
 const paddingTop=Math.max(0,Math.min(80,Number($('#cellPaddingTop').value)||0)),paddingBottom=Math.max(0,Math.min(80,Number($('#cellPaddingBottom').value)||0));
 const paddingLeft=Math.max(0,Math.min(120,Number($('#cellPaddingLeft').value)||0)),paddingRight=Math.max(0,Math.min(120,Number($('#cellPaddingRight').value)||0)),spacing=Math.max(0,Math.min(30,Number($('#cellSpacing').value)||0));
 const lineHeight=$('#cellLineHeight').value,borderWidth=Math.max(0,Math.min(12,Number($('#tableBorderWidth').value)||0)),borderColor=$('#tableBorderColor').value,fillColor=$('#tableFillColor').value;
 const autoFit=$('#tableAutoFit').value;
 if(autoFit==='fixed'){table.style.width=width+'%';table.style.minWidth='0';table.style.maxWidth='none';table.style.tableLayout='fixed'}
 else if(autoFit==='window'){table.style.width='100%';table.style.minWidth='0';table.style.maxWidth='100%';table.style.tableLayout='auto'}
 else{table.style.width='auto';table.style.minWidth='0';table.style.maxWidth='none';table.style.tableLayout='auto'}
 table.style.borderCollapse=spacing?'separate':'collapse';table.style.borderSpacing=spacing+'px';
 const align=$('#tableAlign').value;table.dataset.tableAlign=align;
 table.style.marginLeft=align==='left'?'0':'auto';table.style.marginRight=align==='right'?'0':'auto';
 const group=ensureColgroup(table),column=logicalColumnIndex(cell);if(group.children[column])group.children[column].style.width=columnWidth+'px';
 const rows=scope==='table'?[...table.rows]:[cell.parentElement];rows.forEach(row=>row.style.height=rowHeight+'px');
 targets.forEach(target=>{
   target.style.padding=paddingTop+'px '+paddingRight+'px '+paddingBottom+'px '+paddingLeft+'px';target.style.lineHeight=lineHeight;target.style.borderStyle='solid';target.style.borderWidth=borderWidth+'px';target.style.borderColor=borderColor;
   target.style.backgroundColor=fillColor;target.style.textAlign=$('#tableTextAlign').value;target.style.verticalAlign=$('#tableVerticalAlign').value
 });
 closeTableDialog();changed();requestAnimationFrame(updateTableTools)
}
function resetTableSizing(){
 const cell=activeTableCell?.isConnected?activeTableCell:null,table=cell?.closest('table');if(!table){closeTableDialog();return}
 ['width','min-width','max-width','table-layout'].forEach(property=>table.style.removeProperty(property));
 table.querySelectorAll(':scope > colgroup > col').forEach(col=>col.style.removeProperty('width'));
 [...table.rows].forEach(row=>row.style.removeProperty('height'));
 table.querySelectorAll('th,td').forEach(item=>{item.style.removeProperty('width');item.style.removeProperty('height')});
 closeTableDialog();changed();requestAnimationFrame(updateTableTools)
}
function resizeEdge(event,cell){
 const rect=cell.getBoundingClientRect(),distance=9;
 if(Math.abs(event.clientX-rect.right)<=distance)return'column';
 if(Math.abs(event.clientY-rect.bottom)<=distance)return'row';
 return''
}
content.addEventListener('pointermove',event=>{
 if(tableResize)return;const cell=event.target.closest?.('td,th');const mode=cell?resizeEdge(event,cell):'';
 content.style.cursor=mode==='column'?'col-resize':mode==='row'?'row-resize':'';if(mode)showResizeGuide(cell,mode);else $('#tableResizeGuide').className='table-resize-guide'
});
content.addEventListener('pointerleave',()=>{if(!tableResize){content.style.cursor='';$('#tableResizeGuide').className='table-resize-guide'}});
content.addEventListener('pointerdown',event=>{
 if(event.button!==0)return;const cell=event.target.closest?.('td,th'),mode=cell?resizeEdge(event,cell):'';if(!mode)return;
 event.preventDefault();showTableTools(cell);const table=cell.closest('table'),rect=cell.getBoundingClientRect();
 if(mode==='column'){
   const group=ensureColgroup(table),column=logicalColumnIndex(cell),col=group.children[column],startSize=rect.width/Math.max(1,cell.colSpan||1);
   tableResize={mode,start:event.clientX,startSize,startTableWidth:table.getBoundingClientRect().width,table,col}
 }else tableResize={mode,start:event.clientY,startSize:cell.parentElement.getBoundingClientRect().height,row:cell.parentElement}
});
document.addEventListener('pointermove',event=>{
 if(!tableResize)return;
 if(tableResize.mode==='column'){
   const size=Math.max(40,Math.min(800,tableResize.startSize+event.clientX-tableResize.start)),delta=size-tableResize.startSize;
   tableResize.col.style.width=size+'px';tableResize.table.style.tableLayout='fixed';tableResize.table.style.width=Math.max(120,tableResize.startTableWidth+delta)+'px';tableResize.table.style.maxWidth='none';showResizeGuide(activeTableCell,'column',event.clientX)
 }else{tableResize.row.style.height=Math.max(24,Math.min(500,tableResize.startSize+event.clientY-tableResize.start))+'px';showResizeGuide(activeTableCell,'row',event.clientY)}
});
document.addEventListener('pointerup',()=>{if(!tableResize)return;tableResize=null;content.style.cursor='';$('#tableResizeGuide').className='table-resize-guide';changed();requestAnimationFrame(updateTableTools)});

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
buildTablePicker();
$('#tableBtn').onclick=toggleTablePicker;
$('#moreTableBtn').onclick=()=>{const rv=prompt('更多表格行数（1～100）：',String(pickerRows));if(rv===null)return;const cv=prompt('更多表格列数（1～30）：',String(pickerCols));if(cv===null)return;makeTable(Math.min(100,Math.max(1,parseInt(rv)||1)),Math.min(30,Math.max(1,parseInt(cv)||1)));hideTablePicker()};
$('#tocBtn').onclick=insertOrUpdateTOC;
$('#addRowBtn').onclick=()=>tableAction('addRow');$('#addColBtn').onclick=()=>tableAction('addCol');$('#delRowBtn').onclick=()=>tableAction('delRow');$('#delColBtn').onclick=()=>tableAction('delCol');$('#delTableBtn').onclick=()=>tableAction('delTable');
$('#tablePropsBtn').onclick=openTableDialog;$('#tableDialogClose').onclick=closeTableDialog;$('#tableApplyBtn').onclick=applyTableProperties;$('#tableResetBtn').onclick=resetTableSizing;
$('#quickAddCol').onclick=()=>{selectCell(activeTableCell);tableAction('addCol')};$('#quickAddRow').onclick=()=>{selectCell(activeTableCell);tableAction('addRow')};
$('#tableMoveHandle').onclick=()=>{selectCell(activeTableCell);$('#tableScope').value='table'};$('#tableMoveHandle').ondblclick=openTableDialog;
content.addEventListener('click',e=>{const cell=e.target.closest('td,th');if(cell)showTableTools(cell);else if(!e.target.closest('table'))hideTableTools();const a=e.target.closest('.doc-toc a');if(a){e.preventDefault();content.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth',block:'center'})}});
document.addEventListener('pointerdown',e=>{if(!$('#tablePicker').hidden&&!e.target.closest('#tablePicker')&&!e.target.closest('#tableBtn'))hideTablePicker()});
let tableToolFrame=0;const queueTableToolUpdate=()=>{if(tableToolFrame)return;tableToolFrame=requestAnimationFrame(()=>{tableToolFrame=0;updateTableTools()})};
document.addEventListener('scroll',queueTableToolUpdate,true);window.addEventListener('resize',()=>{hideTablePicker();queueTableToolUpdate()});
autoSaveToggle.checked=autoSave;
autoSaveToggle.onchange=()=>{autoSave=autoSaveToggle.checked;localStorage.setItem(AUTO_KEY,String(autoSave));if(autoSave){status.textContent='正在自动保存…';save()}else status.textContent=dirty?'有未保存更改':savedLabel()};
$('#saveBtn').onclick=async()=>{clearTimeout(saveTimer);if(save()){const ok=await lastCloudSync;if(!ok)alert('当前电脑已保存，但云端同步失败，请稍后再按一次 Ctrl+S。')}};
$('#draftBtn').onclick=async()=>{clearTimeout(saveTimer);if(save(true)){const ok=await lastCloudSync;alert(ok?'已经存入云端草稿箱。返回主页后点击“草稿箱”即可看到。':'当前电脑已保存草稿，但云端同步失败，请不要关闭页面，稍后再次点击“存入草稿箱”。')}};
$('#newBtn').onclick=create;
$('#noteList').onclick=e=>{const b=e.target.closest('.note');if(!b||b.dataset.id===current)return;if(!resolvePending('切换文章'))return;current=b.dataset.id;show();render()};
$('#search').oninput=e=>render(e.target.value);
document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const cmd=b.dataset.cmd;if(cmd==='undo')return undo();if(cmd==='redo')return redo();applyCommand(cmd,b.dataset.value||null)});
$('#linkBtn').onclick=()=>{const u=prompt('请输入链接地址：','https://');if(u){content.focus();document.execCommand('createLink',false,u);changed()}};
$('#clipboardBtn').onclick=()=>{diagnosticMode=true;content.focus();alert('现在请回到正文区域，按 Ctrl+V 粘贴刚才从 Word 复制的内容。粘贴后会显示检查结果。')};
$('#imageFile').onchange=async e=>{content.focus();const range=getRange();for(const file of e.target.files)insertImage(await compressImage(file),range);e.target.value='';changed()};
$('#publishBtn').onclick=publishCurrent;
$('#unpublishBtn').onclick=unpublishCurrent;
$('#deleteBtn').onclick=()=>{if(!confirm('确定删除这篇文章吗？此操作不能撤销。'))return;const deleted=current;data=data.filter(x=>x.id!==current);current=data[0]?.id||null;localStorage.setItem(KEY,JSON.stringify(data));window.blogCloud?.deleteNote(deleted).catch(e=>alert('云端删除失败：'+e.message));current?show():create();render()};
$('#exportBtn').onclick=()=>{save();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='我的笔记备份-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)};
$('#importFile').onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(!Array.isArray(x))throw 0;if(confirm('导入会替换当前浏览器里的文章，确定继续吗？')){data=x;current=data[0]?.id||null;persist();current?show():create();render()}}catch{alert('备份文件格式不正确')}e.target.value=''};
window.addEventListener('beforeunload',e=>{if(autoSave&&dirty)save();else if(dirty){e.preventDefault();e.returnValue=''}});
async function restoreLegacyAndPublishIfRequested(){
 if(params.get('restore')!=='mdb'||requestedId!=='mdb-protocol-study')return false;
 if(!confirm('这会用原始 MDB 学习记录重新覆盖云端中的同名文章，并立即发布。确定继续吗？')){
   history.replaceState(null,'','editor.html?id='+encodeURIComponent(requestedId));
   return false
 }
 status.textContent='正在重新生成 MDB 表格和导航…';
 const response=await fetch('legacy/mdb-protocol-study-source.html',{cache:'no-store'});
 if(!response.ok)throw new Error('无法读取原始 MDB 文章');
 const doc=new DOMParser().parseFromString(await response.text(),'text/html'),bodyNode=doc.querySelector('.study-content');
 if(!bodyNode)throw new Error('原始 MDB 文章正文格式无法识别');
 const fixed=window.blogStructure?.structureHtml(bodyNode.innerHTML,'mdb-protocol-study')||{html:bodyNode.innerHTML,tables:0,headings:0};
 let n=data.find(x=>String(x.id)==='mdb-protocol-study'||normalizeTitle(x.title)==='mdb协议学习记录');
 if(!n){
   n={id:'mdb-protocol-study',createdAt:Date.UTC(2026,6,23)};
   data.unshift(n)
 }
 current=String(n.id);
 n.title=doc.querySelector('h1')?.textContent?.trim()||'MDB 协议学习记录';
 n.body=fixed.html;n.published=true;n.publishedAt=Date.now();n.updated=Date.now();
 delete n.draftSaved;delete n.draftTitle;delete n.draftBody;
 if(!persist())throw new Error('当前浏览器保存失败');
 if(!await lastCloudSync)throw new Error('Supabase 云端同步失败');
 alert('MDB 学习记录已重新发布：恢复 '+(fixed.tables||0)+' 个表格、'+(fixed.headings||0)+' 个导航标题。');
 location.replace('article.html?id='+encodeURIComponent(n.id));
 return true
}
async function importLegacyIfNeeded(){
 if(params.get('legacy')!=='1'||requestedId!=='mdb-protocol-study')return;
 const existing=data.find(n=>String(n.id)===requestedId||normalizeTitle(n.title)==='mdb协议学习记录');
 if(existing){current=String(existing.id);return}
 status.textContent='正在把旧文章导入私人云端…';
 const response=await fetch('legacy/mdb-protocol-study-source.html',{cache:'no-store'});
 if(!response.ok)throw new Error('无法读取旧文章');
 const doc=new DOMParser().parseFromString(await response.text(),'text/html'),bodyNode=doc.querySelector('.study-content');
 if(!bodyNode)throw new Error('旧文章正文格式无法识别');
 const fixed=window.blogStructure?.structureHtml(bodyNode.innerHTML,'mdb-protocol-study')||{html:bodyNode.innerHTML};
 const n={id:'mdb-protocol-study',title:doc.querySelector('h1')?.textContent?.trim()||'MDB 协议学习记录',body:fixed.html,published:true,updated:Date.UTC(2026,6,23),createdAt:Date.UTC(2026,6,23),publishedAt:Date.UTC(2026,6,23)};
 data.unshift(n);current=n.id;
 if(!persist())throw new Error('本地保存失败');
 if(!await lastCloudSync)throw new Error('Supabase 云端同步失败');
 alert('旧版 MDB 文章已转为云端文章。以后它和其他文章一样可以重新编辑、保存草稿和发布更新。')
}
async function repairLegacyStructureIfNeeded(){
 const n=data.find(x=>String(x.id)===String(current));
 if(!n||!window.blogStructure||(String(n.id)!=='mdb-protocol-study'&&normalizeTitle(n.title)!=='mdb协议学习记录'))return;
 let changed=false,tables=0,headings=0;
 for(const field of ['body','draftBody']){
  if(typeof n[field]!=='string')continue;
  const result=window.blogStructure.structureHtml(n[field],'mdb-protocol-study');
  if(result.changed){n[field]=result.html;changed=true;tables=Math.max(tables,result.tables);headings=Math.max(headings,result.headings)}
 }
 if(!changed)return;
 n.updated=Date.now();
 if(!persist())throw new Error('结构恢复后的文章无法保存到当前浏览器');
 if(!await lastCloudSync)throw new Error('结构恢复后的文章无法同步到 Supabase');
 alert('MDB 文章结构已修复并同步云端：恢复 '+tables+' 个表格、'+headings+' 个导航标题。')
}
async function bootstrap(){
 try{if(await restoreLegacyAndPublishIfRequested())return;await importLegacyIfNeeded();await repairLegacyStructureIfNeeded()}catch(e){console.error(e);alert('旧文章处理失败：'+e.message+'。原文章没有删除，请稍后重试。')}
 if(!data.length){create();return}
 if(requestedId&&data.some(n=>String(n.id)===String(requestedId)))current=String(requestedId);
 else if(!data.some(n=>String(n.id)===String(current)))current=String(data[0].id);
 show();render()
}
bootstrap();
