(()=>{
const MARK='<!--blog-structure-v2-->';
const BLOCK_TAGS=new Set(['TABLE','H1','H2','H3','H4','P','DIV','BLOCKQUOTE','UL','OL','NAV','HR']);

function segmentFrom(nodes,block=false){
  const holder=document.createElement('div');
  nodes.forEach(n=>holder.appendChild(n.cloneNode(true)));
  return{nodes:nodes.map(n=>n.cloneNode(true)),html:holder.innerHTML,raw:holder.textContent||'',block,hasMedia:!!holder.querySelector('img,table,video,audio')};
}
function splitSegments(root){
  const segments=[];let pending=[];
  const flush=()=>{if(pending.length){segments.push(segmentFrom(pending));pending=[]}else segments.push(segmentFrom([]))};
  [...root.childNodes].forEach(node=>{
    if(node.nodeType===1&&node.tagName==='BR'){flush();return}
    if(node.nodeType===1&&BLOCK_TAGS.has(node.tagName)){
      if(pending.length){segments.push(segmentFrom(pending));pending=[]}
      segments.push(segmentFrom([node],true));return
    }
    pending.push(node)
  });
  if(pending.length)segments.push(segmentFrom(pending));
  return segments
}
function cleanText(value){return String(value||'').replace(/^[\s\u2003\t]+/,'').replace(/[\s\u2003\t]+$/,'')}
function isIndented(seg){return /^[\u2003\t]/.test(seg.raw||'')}
function isIndentedBlank(seg){return isIndented(seg)&&cleanText(seg.raw)===''}
function cellHtml(seg){
  const holder=document.createElement('div');holder.innerHTML=seg.html;
  let node=holder.firstChild;
  while(node&&node.nodeType===3){
    node.nodeValue=node.nodeValue.replace(/^[\s\u2003\t]+/,'');
    if(node.nodeValue)break;
    node=node.nextSibling
  }
  return holder.innerHTML
}
function tableAt(segments,index){
  const first=segments[index],firstText=cleanText(first.raw);
  if(!firstText||firstText.length>32||/[。；！？!?]/.test(firstText)||/^[a-z]+$/i.test(firstText)||first.block||first.hasMedia||isIndented(first))return null;
  let cursor=index+1,header=[];
  while(cursor<segments.length&&isIndented(segments[cursor])&&!isIndentedBlank(segments[cursor])){
    if(segments[cursor].hasMedia)return null;
    header.push(segments[cursor]);cursor++
  }
  if(!header.length||header.length>8||cursor>=segments.length||!isIndentedBlank(segments[cursor]))return null;
  cursor++;
  const groups=[];let group=[];
  while(cursor<segments.length&&isIndented(segments[cursor])){
    const seg=segments[cursor];
    if(isIndentedBlank(seg)){if(group.length){groups.push(group);group=[]}}
    else if(!seg.hasMedia)group.push(seg);
    else break;
    cursor++
  }
  if(group.length)groups.push(group);
  if(!groups.length)return null;
  const columns=header.length+1,total=groups.reduce((n,g)=>n+g.length,0);
  if(total<columns)return null;
  const rows=[];
  groups.forEach(g=>{
    for(let start=0;start<g.length;start+=columns){
      const row=g.slice(start,start+columns);
      while(row.length<columns)row.push(null);
      rows.push(row)
    }
  });
  return{end:cursor,first,header,rows,columns}
}
function createTable(info){
  const wrap=document.createElement('div');wrap.className='table-scroll';
  const table=document.createElement('table'),thead=document.createElement('thead'),headRow=document.createElement('tr');
  const first=document.createElement('th');first.innerHTML=info.first.html;headRow.appendChild(first);
  info.header.forEach(seg=>{const th=document.createElement('th');th.innerHTML=cellHtml(seg);headRow.appendChild(th)});
  thead.appendChild(headRow);table.appendChild(thead);
  const tbody=document.createElement('tbody');
  info.rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(seg=>{const td=document.createElement('td');td.innerHTML=seg?cellHtml(seg):'';tr.appendChild(td)});tbody.appendChild(tr)});
  table.appendChild(tbody);wrap.appendChild(table);return wrap
}
function headingLevel(text){
  const t=cleanText(text);
  if(!t||t.length>180||/^协议版本[:：]/.test(t))return 0;
  let m=t.match(/^(\d+)(?:[、．]\s*|\s+)(\S.*)$/);
  if(m)return 2;
  m=t.match(/^(\d+(?:\.\d+)+(?:-\d+(?:\.\d+)*)?)(?:[、．:：]|\s)*(.*)$/);
  if(!m)return 0;
  const depth=(m[1].match(/\./g)||[]).length;
  return Math.min(4,depth+2)
}
function appendSegment(fragment,seg,asHeading,headingIndex){
  if(asHeading){
    const heading=document.createElement('h'+asHeading);heading.innerHTML=seg.html;
    heading.id='section-'+headingIndex;fragment.appendChild(heading);return
  }
  seg.nodes.forEach(n=>fragment.appendChild(n.cloneNode(true)));
  fragment.appendChild(document.createElement('br'))
}
function structureHtml(html,noteId=''){
  const original=String(html||''),legacy=String(noteId)==='mdb-protocol-study'||/DDR5MDB02|协议版本[:：]\s*DDR5MDB02/i.test(original);
  if(!legacy||original.includes(MARK)){
    const probe=document.createElement('div');probe.innerHTML=original;
    return{html:original,changed:false,tables:probe.querySelectorAll('table').length,headings:probe.querySelectorAll('h1,h2,h3,h4').length}
  }
  const root=document.createElement('div');root.innerHTML=original;
  const segments=splitSegments(root),fragment=document.createDocumentFragment();
  let contentStarted=false,tableCount=0,headingCount=0;
  for(let i=0;i<segments.length;){
    const seg=segments[i],text=cleanText(seg.raw);
    if(/^协议版本[:：]/.test(text))contentStarted=true;
    if(contentStarted){
      const info=tableAt(segments,i);
      if(info){fragment.appendChild(createTable(info));tableCount++;i=info.end;continue}
      const level=!seg.block&&!seg.hasMedia?headingLevel(text):0;
      if(level){headingCount++;appendSegment(fragment,seg,level,headingCount);i++;continue}
    }
    appendSegment(fragment,seg,0,0);i++
  }
  const output=document.createElement('div');output.appendChild(fragment);
  return{html:MARK+output.innerHTML,changed:true,tables:tableCount,headings:headingCount}
}
window.blogStructure={structureHtml,mark:MARK};
})();
