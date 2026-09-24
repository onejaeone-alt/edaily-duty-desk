'use client';
import { useEffect, useMemo, useState } from 'react';

type Category='생활'|'경제'|'문화'|'사회'|'정치'|'국제'|'스포츠'|'기타';
type Item={id:string;title:string;link:string;source:string;publishedAt:string;category:Category;score:number;exclusive:boolean;via?:string;edailyMatch?:{title:string;link:string;similarity:number}|null};
type Api={generatedAt?:string;items:Item[];sourceStatus:Record<string,{ok:boolean;count:number;mode:string}>};
const cats:Array<'전체'|Category>=['전체','생활','경제','문화','사회','정치','국제','스포츠','기타'];

function ago(iso:string){const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));return m<1?'방금':m<60?`${m}분 전`:m<1440?`${Math.floor(m/60)}시간 전`:`${Math.floor(m/1440)}일 전`;}

export default function Page(){
  const [data,setData]=useState<Api>({items:[],sourceStatus:{}}); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [tab,setTab]=useState<'전체최신'|'통신3사'|'타사단독'|'이데일리대조'>('전체최신'); const [cat,setCat]=useState<'전체'|Category>('전체'); const [q,setQ]=useState('');
  const [processed,setProcessed]=useState<Set<string>>(new Set());
  useEffect(()=>{try{const d=JSON.parse(localStorage.getItem('duty-processed')||'[]');setProcessed(new Set(d));}catch{}},[]);
  async function load(){try{setErr('');const r=await fetch('/api/news',{cache:'no-store'}); if(!r.ok)throw new Error('수집 실패'); const j=await r.json(); setData(j);}catch(e:any){setErr(e.message||'수집 실패')}finally{setLoading(false)}}
  useEffect(()=>{load(); const t=setInterval(load,30000); return()=>clearInterval(t)},[]);
  const shown=useMemo(()=>{
    let a = tab==='전체최신' ? data.items : tab==='통신3사'?data.items.filter(x=>['연합뉴스','뉴시스','뉴스1'].includes(x.source)):tab==='타사단독'?data.items.filter(x=>x.exclusive||x.source==='타사 단독'):data.items.filter(x=>x.edailyMatch);
    a=[...a].sort((x,y)=>new Date(y.publishedAt).getTime()-new Date(x.publishedAt).getTime());
    if(cat!=='전체') a=a.filter(x=>x.category===cat); if(q.trim()){const qq=q.trim().toLowerCase();a=a.filter(x=>(x.title+' '+x.source).toLowerCase().includes(qq));} return a;
  },[tab,data.items,cat,q]);
  function toggle(id:string){const n=new Set(processed);n.has(id)?n.delete(id):n.add(id);setProcessed(n);localStorage.setItem('duty-processed',JSON.stringify([...n]));}
  async function copyReport(x:Item){const t=`[당직 확인] ${x.title}\n- ${x.source} / ${x.category}\n- ${x.link}${x.edailyMatch?`\n- 이데일리 유사 기사 있음: ${x.edailyMatch.title}\n  ${x.edailyMatch.link}`:'\n- 이데일리 유사 기사 미확인'}`; await navigator.clipboard.writeText(t);}
  const count=processed.size;
  return <main>
    <header><div><p className="eyebrow">LIVE NEWS MONITOR</p><h1>이데일리 당직 데스크</h1><p className="sub">연합뉴스·뉴시스·뉴스1과 타사 단독을 최신 송고순으로 한눈에 확인합니다.</p></div><div className="headerActions"><button onClick={load}>↻ 지금 갱신</button><span className="refresh">30초 자동 갱신</span></div></header>
    <section className="status">{Object.entries(data.sourceStatus||{}).map(([k,v])=><div key={k} className={v.ok?'ok':'bad'}><b>{k==='newsis'?'뉴시스':k==='news1'?'뉴스1':k==='yonhap'?'연합뉴스':k==='exclusive'?'타사 단독':'이데일리'}</b><span>{v.ok?`${v.count}건`:'연결 실패'}</span><small>{v.mode}</small></div>)}</section>
    <section className="workflow"><b>01</b> 최신 기사 확인 <i>→</i> <b>02</b> 이데일리 보도 여부 대조 <i>→</i> <b>03</b> 당직방 보고 후 기사 작성 <span>오늘 처리한 기사 <strong>{count}</strong>건</span></section>
    <nav className="tabs">{(['전체최신','통신3사','타사단독','이데일리대조'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='전체최신'?'전체 최신':t==='타사단독'?'타사 단독':t==='이데일리대조'?'이데일리 대조':t}</button>)}</nav>
    <div className="filters"><div>{cats.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="제목·매체 검색" /></div>
    {err&&<div className="error">{err}</div>}{loading&&<div className="empty">최신 기사를 가져오고 있습니다…</div>}
    {!loading&&shown.length===0&&<div className="empty">조건에 맞는 기사가 없습니다.</div>}
    <section className="list">{shown.map((x,i)=><article key={x.id} className={processed.has(x.id)?'processed':''}>
      <div className="rank">{String(i+1).padStart(2,'0')}</div><div className="body"><div className="meta"><span className={`cat c-${x.category}`}>{x.category}</span><b>{x.source}</b><span>{ago(x.publishedAt)}</span>{x.via&&<span className="via">{x.via}</span>}{x.exclusive&&<span className="exclusive">단독</span>}</div>
      <a className="title" href={x.link} target="_blank" rel="noreferrer">{x.title}</a><div className="foot">{x.edailyMatch?<a className="match" href={x.edailyMatch.link} target="_blank" rel="noreferrer">이데일리 유사 기사 있음 · {Math.round(x.edailyMatch.similarity*100)}%</a>:<span className="nomatch">이데일리 유사 기사 미확인</span>}</div></div>
      <div className="actions"><button onClick={()=>copyReport(x)}>보고 문구 복사</button><button className={processed.has(x.id)?'done':''} onClick={()=>toggle(x.id)}>{processed.has(x.id)?'처리 취소':'처리 완료'}</button></div></article>)}</section>
    <footer>첫 화면은 분야별 가중치 없이 수집된 기사를 최신 송고순으로 표시합니다. 분야 버튼은 원하는 기사만 좁혀 볼 때 사용합니다. 이데일리 대조는 제목 유사도 기반이므로 최종 확인은 원문으로 해주세요.</footer>
  </main>
}
