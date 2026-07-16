const KEY='my_blog_notes_v1';let data=load(),current=data[0]?.id||null,timer;
const $=s=>document.querySelector(s), title=$('#title'),content=$('#content'),status=$('#status');
if(!data.length)create();
function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}}
function save(){if(!current)return;const n=data.find(x=>x.id===current);if(!n)return;n.title=title.value;n.body=content.innerHTML;n.updated=Date.now();localStorage.setItem(KEY,JSON.stringify(data));status.textContent='已保存';render();count()}
function changed(){status.textContent='正在保存…';clearTimeout(timer);timer=setTimeout(save,500);count()}
function create(){const n={id:crypto.randomUUID?.()||Date.now().toString(),title:'',body:'',updated:Date.now(),published:false};data.unshift(n);current=n.id;localStorage.setItem(KEY,JSON.stringify(data));show();render()}
function show(){const n=data.find(x=>x.id===current);if(!n)return;title.value=n.title||'';content.innerHTML=n.body||'';$('#publishBtn').textContent=n.published?'取消发布':'发布';count()}
function render(filter=''){const q=filter.toLowerCase();$('#noteList').innerHTML=data.filter(n=>(n.title||'无标题文章').toLowerCase().includes(q)).sort((a,b)=>b.updated-a.updated).map(n=>`<button class="note ${n.id===current?'active':''}" data-id="${n.id}"><b>${escape(n.title||'无标题文章')}</b><span>${n.published?'● 已发布 · ':''}${new Date(n.updated).toLocaleDateString('zh-CN')}</span></button>`).join('')}
function escape(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function count(){const t=content.innerText.trim();$('#words').textContent=(t?t.replace(/\s/g,'').length:0)+' 字'}
title.oninput=changed;content.oninput=changed;content.onpaste=()=>setTimeout(changed);
$('#newBtn').onclick=create;$('#noteList').onclick=e=>{const b=e.target.closest('.note');if(b){save();current=b.dataset.id;show();render()}};
$('#search').oninput=e=>render(e.target.value);
document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{content.focus();document.execCommand(b.dataset.cmd,false,b.dataset.value||null);changed()});
$('#linkBtn').onclick=()=>{const u=prompt('请输入链接地址：','https://');if(u){content.focus();document.execCommand('createLink',false,u);changed()}};
$('#publishBtn').onclick=()=>{const n=data.find(x=>x.id===current);n.published=!n.published;save();show();alert(n.published?'已发布：现在可在本机浏览器的首页看到。':'已取消发布')};
$('#deleteBtn').onclick=()=>{if(!confirm('确定删除这篇文章吗？此操作不能撤销。'))return;data=data.filter(x=>x.id!==current);current=data[0]?.id||null;localStorage.setItem(KEY,JSON.stringify(data));current?show():create();render()};
$('#exportBtn').onclick=()=>{save();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='我的笔记备份-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)};
$('#importFile').onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(!Array.isArray(x))throw 0;if(confirm('导入会替换当前浏览器里的文章，确定继续吗？')){data=x;current=data[0]?.id||null;localStorage.setItem(KEY,JSON.stringify(data));current?show():create();render()}}catch{alert('备份文件格式不正确')}e.target.value=''};
window.addEventListener('beforeunload',save);show();render();