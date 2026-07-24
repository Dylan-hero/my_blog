(()=>{
const MARK='<!--blog-structure-v4-->';
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
function topChild(root,node){while(node&&node.parentNode!==root)node=node.parentNode;return node}
function findTopByText(root,pattern){
  const walker=document.createTreeWalker(root,4);let node;
  while((node=walker.nextNode()))if(pattern.test(cleanText(node.nodeValue)))return topChild(root,node);
  return null
}
function restoreModeSummaryTable(root){
  if(root.querySelector('table[data-restored-table="3.2-3.3"]'))return false;
  const start=findTopByText(root,/^3\.2-3\.3总结$/),end=findTopByText(root,/^3\.4\s+Early Swizzle Discovery$/i);
  if(!start||!end||start===end)return false;
  let node=start.nextSibling;
  while(node&&node!==end){const next=node.nextSibling;node.remove();node=next}
  if(node!==end)return false;
  const wrap=document.createElement('div');wrap.className='table-scroll';
  wrap.innerHTML=`<table data-restored-table="3.2-3.3">
    <thead><tr><th>工作模式</th><th>DRAM interface</th><th>HOST interface</th><th>tHDQS（DQS 的虚拟周期或 2UI 时间）</th><th>接口说明</th></tr></thead>
    <tbody>
      <tr><th rowspan="4">MUX MODE</th><td>X4</td><td>Nibble mode</td><td rowspan="4">tHDQS = tBCK / 2<br>细分速率档位七个</td><td>DRAM侧：MDQS0/1 都作选通，总共 8bit，接两个 x4 颗粒。<br>HOST侧：DQS0/1 都使用，总共 8bit，速率 ≤ 8.8GT/s，CRC 禁用。</td></tr>
      <tr><td>X4</td><td>Byte mode</td><td>DRAM侧：MDQS0/1 都作选通，总共 8bit，接两个 x4 颗粒。<br>HOST侧：仅 DQS0 作选通，总共 8bit，速率 ≥ 8.0GT/s；启用 CRC 时速率要求 ≥ 8.8GT/s，DQS1_t/c 作为差分 CRC 信号。</td></tr>
      <tr><td>X8</td><td>Byte mode</td><td>DRAM侧：MDQS0 作选通，接一个 x8 颗粒，MDQS1 悬空（RTT_PARK）。<br>HOST侧：仅 DQS0 作选通，总共 8bit，速率 ≥ 8.0GT/s；启用 CRC 时速率要求 ≥ 8.8GT/s，DQS1_t/c 作为差分 CRC 信号。</td></tr>
      <tr><td>X8</td><td>Nibble mode</td><td>DRAM侧：MDQS0 作选通，接一个 x8 颗粒，MDQS1 悬空。<br>HOST侧：DQS0/1 都作选通，速率 ≤ 8.8GT/s，CRC 禁用。</td></tr>
      <tr><th rowspan="4">RANK MODE</th><td>X4</td><td>Nibble mode</td><td rowspan="4">tHDQS = tBCK<br>细分速率档位四个</td><td>DRAM侧：MDQS0/1 都作选通，总共 8bit，接两个 x4 颗粒。<br>HOST侧：DQS0/1 都作选通，总共 8bit，速率 ≤ 8.8GT/s，CRC 禁用。</td></tr>
      <tr><td>X4</td><td>Byte mode</td><td>不支持（3.3 节：RANK 模式下，Host interface 只支持 X4）。</td></tr>
      <tr><td>X8</td><td>Byte mode</td><td>不支持（3.3 节：RANK 模式下，Host interface 只支持 X4）。</td></tr>
      <tr><td>X8</td><td>Nibble mode</td><td>DRAM侧：MDQS0 作选通，总共 8bit，接两个 x4 颗粒，MDQS1 断开。<br>HOST侧：DQS0/1 都作选通，速率 ≤ 8.8GT/s，CRC 禁用。</td></tr>
    </tbody>
  </table>`;
  root.insertBefore(wrap,end);root.insertBefore(document.createElement('br'),end);return true
}
function knownCell(value){
  if(typeof value==='string')return{html:value};
  return value
}
function createKnownTable(id,headers,rows){
  const wrap=document.createElement('div');wrap.className='table-scroll';
  const table=document.createElement('table');table.dataset.restoredTable=id;
  const thead=document.createElement('thead'),head=document.createElement('tr');
  headers.forEach(value=>{const th=document.createElement('th');th.textContent=value;head.appendChild(th)});
  thead.appendChild(head);table.appendChild(thead);
  const tbody=document.createElement('tbody');
  rows.forEach(values=>{
    const tr=document.createElement('tr');
    values.map(knownCell).forEach(value=>{
      const el=document.createElement(value.header?'th':'td');el.innerHTML=value.html||'';
      if(value.rowspan)el.rowSpan=value.rowspan;if(value.colspan)el.colSpan=value.colspan;
      tr.appendChild(el)
    });
    tbody.appendChild(tr)
  });
  table.appendChild(tbody);wrap.appendChild(table);return wrap
}
function findTopBetween(start,end,pattern){
  let node=start?.nextSibling;
  while(node&&node!==end){
    const text=cleanText(node.textContent||node.nodeValue||'');
    if(pattern.test(text))return node;
    node=node.nextSibling
  }
  return null
}
function replaceThroughEnd(first,end,wrap){
  let node=first;
  while(node&&node!==end){const next=node.nextSibling;node.remove();node=next}
  if(node!==end)return false;
  end.parentNode.insertBefore(wrap,end);end.parentNode.insertBefore(document.createElement('br'),end);return true
}
function flowRows(writeConfig,readConfig){
  const ps0='PG[70]RWE4[2]=0<br>(PS0)',ps1='PG[70]RWE4[2]=1<br>(PS1)';
  const disabled='PG[70]RWE4[0]=0<br>Disable',enabled='PG[70]RWE4[0]=1<br>Enable';
  return[
    [{html:'Mux mode',rowspan:5,header:true},writeConfig,'—','—','DQ/DQS → PS0、PS1 MDQ/MDQS'],
    [readConfig,ps0,disabled,'DQS：PS0 → HOST<br>DQ：PS0 → HOST'],
    [readConfig,ps0,enabled,'DQS：PS0 → HOST<br>DQ：PG[70]RWE5 逐位选择'],
    [readConfig,ps1,disabled,'DQS：PS1 → HOST<br>DQ：PS1 → HOST'],
    [readConfig,ps1,enabled,'DQS：PS1 → HOST<br>DQ：PG[70]RWE5 逐位选择'],
    [{html:'Rank mode',rowspan:3,header:true},'BCS_n=“1”<br>BCOM[2:0]=“111”<br>写方向','—','—','DQ/DQS → A/B_MDQ/MDQS'],
    ['BCS_n=“1”<br>BCOM[2:0]=“000”<br>读方向','PG[60]RWE4[0]=0<br>(Default)','—','A_MDQS/MDQ → DQS/DQ'],
    ['BCS_n=“1”<br>BCOM[2:0]=“000”<br>读方向','PG[60]RWE4[0]=1','—','B_MDQS/MDQ → DQS/DQ']
  ]
}
function restoreFlowTable(root,id,startPattern,endPattern,writeConfig,readConfig){
  if(root.querySelector('table[data-restored-table="'+id+'"]'))return false;
  const start=findTopByText(root,startPattern),end=findTopByText(root,endPattern);
  if(!start||!end)return false;
  const first=findTopBetween(start,end,/^Mode$/);
  if(!first)return false;
  const wrap=createKnownTable(id,['Mode','数据流向配置（其他输入均无效）','PS SEL','DQ Static Mux Mode','数据流向'],flowRows(writeConfig,readConfig));
  return replaceThroughEnd(first,end,wrap)
}
function restoreSelfRefreshTable(root){
  const id='4.1-self-refresh';
  if(root.querySelector('table[data-restored-table="'+id+'"]'))return false;
  const start=findTopByText(root,/^4\.1\.2-4\.1\.3总结$/),end=findTopByText(root,/^4\.1\.4\s+Self Refresh Mode without Clock Stop Exit$/i);
  if(!start||!end)return false;
  const first=findTopBetween(start,end,/^模式维度$/);
  if(!first)return false;
  const rows=[
    ['with Clock Stop Entry','SRE 后 BCK 停止并保持 HIGH。依靠 clock-stop detection 关闭 command bus receivers，以及 DQ/DQS、MDQ/MDQS on-die termination（含 RTT_PARK）。<br>图：Fig.58。','SRE 后 BCK 可停止。termination 可由 SRE command 关闭，也可依靠 clock-stop detection 关闭。<br>图：Fig.60–63。','重点检查：BCK/BCOM/BCS_n 是否 HIGH、command bus receiver 是否关闭、数据接口 termination 是否 disabled/off。'],
    ['with Clock Stop 状态中','BCK_t/BCK_c、BCOM[2:0]、BCS_n 保持 HIGH；Self Refresh 期间 BCS_n 不拉低；termination-disabled 图中的 DQ[S]_RTT、A/B_MDQ[S]_RTT 处于 off/disabled。','BCK/BCOM/BCS_n 同样保持 HIGH；termination 取决于 vendor-specific 策略：SRE command 或 clock-stop detection。','不能只看命令，还要检查接口状态、数据总线状态和 termination。'],
    ['with Clock Stop Exit','MRCD 先启动并稳定 BCK，BCOM[2:0]、BCS_n 保持 HIGH；退出 Clock Stop 会重新启用 termination；未训练 BCOM timing 时可在 tSTAB_DB 后进入 BCOMTM。','termination 可由第一个 NOP command 或退出 Clock Stop 重新启用；BCS_n 在 tSTAB_DB 后才允许合法 LOW pulse。','非数据路径命令看 tSTAB_DBCMD；WR/RD 看 tSTAB_DBDATA；timing 未训练可进入 BCOMTM。'],
    ['without Clock Stop Entry','BCK 不停止，MDB 保持 on-die termination enabled，DQ[S]_RTT、A/B_MDQ[S]_RTT 维持 RTT_PARK。<br>图：Fig.59。','BCK 不停止；可用 SRE command 关闭 termination，也可保持 enabled。<br>图：Fig.64 / Fig.65。','Clock circuitry 继续 locked；Mux 通常保持 termination，Rank 取决于 SRE/厂商策略。'],
    ['without Clock Stop 状态中','BCK 持续 toggle，BCS_n 保持 HIGH，RTT_PARK remains enabled；不进行普通 WR/RD。','若用 SRE 关闭 termination，可进入 off/disabled；若选择 RTT_PARK remains enabled，则一直 park。','without Clock Stop 不等于 termination 一定开或一定关；Rank Mode 两种都允许。'],
    ['without Clock Stop Exit','因为 Data Buffer clock circuitry 一直 locked，不需要等待 tSTAB_DB；依靠 BCS_n active pulse 和后续 NOP/Valid 时序退出。<br>图：Fig.59。','同样不等待 tSTAB_DB；若 termination 曾关闭，按 tSR_PARKon(max) 恢复；若一直 enabled，则无需从 off 恢复。<br>图：Fig.64 / Fig.65。','关键检查 tCPDED2SRX_DB，以及 termination 是否需要从 disabled 恢复到 RTT_PARK。']
  ];
  const wrap=createKnownTable(id,['模式维度','Mux Mode','Rank Mode','你要记住'],rows);
  return replaceThroughEnd(first,end,wrap)
}
function restoreAllKnownTables(root){
  restoreModeSummaryTable(root);
  restoreFlowTable(root,'3.6-transparent',/^3\.6\s+Transparent Mode$/i,/^3\.7\s+DQ Pass-Through Mode$/i,'BCS_n=“1”<br>BCOM[2:0]=“111”<br>(Host → DRAM)','BCS_n=“1”<br>BCOM[2:0]=“000”<br>(DRAM → Host)');
  restoreFlowTable(root,'3.7-pass-through',/^3\.7\s+DQ Pass-Through Mode$/i,/^3\.8\s+DQ Bus CRC$/i,'RW82[3]=0（default）<br>(Host → DRAM)','RW82[3]=1<br>(DRAM → Host)');
  restoreSelfRefreshTable(root)
}
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
  const existingTables=(original.match(/<table\b/gi)||[]).length,existingHeadings=(original.match(/<h[1-4]\b/gi)||[]).length;
  const requiredTables=['3.2-3.3','3.6-transparent','3.7-pass-through','4.1-self-refresh'];
  const hasAllKnownTables=requiredTables.every(id=>original.includes('data-restored-table="'+id+'"'));
  // 已完成恢复的长文直接用字符串标记判断，避免每次打开文章都重复解析整份 HTML。
  if(!legacy||(original.includes(MARK)&&existingTables>0&&existingHeadings>0&&hasAllKnownTables)){
    return{html:original,changed:false,tables:existingTables,headings:existingHeadings}
  }
  const probe=document.createElement('div');probe.innerHTML=original;
  const root=document.createElement('div');root.innerHTML=original.replace(/<!--blog-structure-v\d+-->/g,'');
  restoreAllKnownTables(root);
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
  return{html:MARK+output.innerHTML,changed:true,tables:output.querySelectorAll('table').length,headings:output.querySelectorAll('h1,h2,h3,h4').length}
}
window.blogStructure={structureHtml,mark:MARK};
})();
