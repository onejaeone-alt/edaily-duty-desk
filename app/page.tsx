'use client';
import { useEffect, useMemo, useState } from 'react';

type Category='생활'|'경제'|'문화'|'사회'|'정치'|'국제'|'스포츠'|'기타';
type Match={title:string;link:string;similarity:number};
type Item={id:string;title:string;link:string;source:string;publishedAt:string;category:Category;score:number;exclusive:boolean;via?:string;edailyMatch?:Match|null};
type Api={generatedAt?:string;items:Item[];sourceStatus:Record<string,{ok:boolean;count:number;mode:string}>};
type Preview={description:string;paragraphs:string[];resolvedUrl?:string};
const cats:Array<'전체'|Category>=['전체','생활','경제','문화','사회','정치','국제','스포츠','기타'];

function ago(iso:string){const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));return m<1?'방금':m<60?`${m}분 전`:m<1440?`${Math.floor(m/60)}시간 전`:`${Math.floor(m/1440)}일 전`;}
function clock(iso:string){return new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});}

export default function Page(){
  const [data,setData]=useState<Api>({items:[],sourceStatus:{}});
  const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [tab,setTab]=useState<'전체최신'|'통신3사'|'타사단독'|'이데일리대조'>('전체최신');
  const [cat,setCat]=useState<'전체'|Category>('전체'); const [q,setQ]=useState('');
  const [selected,setSelected]=useState<Item|null>(null);
  const [preview,setPreview]=useState<Preview>({description:'',paragraphs:[]});
  const [previewLoading,setPreviewLoading]=useState(false);

  async function load(){
    try{setErr('');const r=await fetch('/api/news',{cache:'no-store'});if(!r.ok)throw new Error('수집 실패');const j=await r.json();setData(j);setSelected(s=>s||j.items?.[0]||null)}
    catch(e:any){setErr(e.message||'수집 실패')}finally{setLoading(false)}
  }
  useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[]);
  useEffect(()=>{
    if(!selected){setPreview({description:'',paragraphs:[]});return}
    let alive=true;setPreviewLoading(true);
    fetch('/api/article?url='+encodeURIComponent(selected.link),{cache:'no-store'})
      .then(r=>r.json()).then(j=>{if(alive)setPreview(j)}).catch(()=>{if(alive)setPreview({description:'',paragraphs:[]})})
      .finally(()=>{if(alive)setPreviewLoading(false)});
    return()=>{alive=false};
  },[selected?.id]);

  const shown=useMemo(()=>{
    let a=tab==='전체최신'?data.items:tab==='통신3사'?data.items.filter(x=>['연합뉴스','뉴시스','뉴스1'].includes(x.source)):tab==='타사단독'?data.items.filter(x=>x.exclusive||x.source==='타사 단독'):data.items.filter(x=>x.edailyMatch);
    a=[...a].sort((x,y)=>new Date(y.publishedAt).getTime()-new Date(x.publishedAt).getTime());
    if(cat!=='전체')a=a.filter(x=>x.category===cat);
    if(q.trim()){const qq=q.trim().toLowerCase();a=a.filter(x=>(x.title+' '+x.source).toLowerCase().includes(qq))}
    return a;
  },[tab,data.items,cat,q]);

  return <div className="appShell">
    <header className="topbar">
      <div className="brand"><div className="brandIcon"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="3.2" fill="currentColor"/><path d="M26.4 27.1c-2.9 2.9-2.9 6.9 0 9.8" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/><path d="M37.6 27.1c2.9 2.9 2.9 6.9 0 9.8" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/><path d="M21.9 22.7c-5.5 5.4-5.5 13.2 0 18.6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/><path d="M42.1 22.7c5.5 5.4 5.5 13.2 0 18.6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/></svg></div><div><h1>당직 데스크</h1><p>EDAILY NEWSROOM</p></div></div>
      <div className="topMeta"><span>{new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})}</span><strong>{new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}</strong><small>KST</small><em>개인용</em></div>
    </header>

    <main>
      <section className="hero"><div><p>LIVE NEWS MONITOR</p><h2>지금 확인할 뉴스</h2></div><div className="heroRight"><span>자동 갱신 30초</span><button onClick={load}>↻ 새로고침</button></div></section>

      <section className="sourceStrip">
        {Object.entries(data.sourceStatus||{}).map(([k,v])=><span key={k}><i className={v.ok?'on':'off'}></i>{k==='newsis'?'뉴시스':k==='news1'?'뉴스1':k==='yonhap'?'연합뉴스':k==='exclusive'?'네이버 단독':'이데일리'} <b>{v.count}</b>건</span>)}
        <small>최근 확인 {new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}</small>
      </section>

      <div className="workspace">
        <section className="newsPanel">
          <nav className="tabs">
            {(['전체최신','통신3사','타사단독','이데일리대조'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='전체최신'?'전체':t==='통신3사'?'통신 3사':t==='타사단독'?'타사 단독':'이데일리 대조'}</button>)}
          </nav>
          <div className="filters"><div>{cats.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="제목·매체 검색"/></div>
          <div className="listHead"><strong>{shown.length}</strong>건 <span>최신순</span></div>
          {err&&<div className="notice error">{err}</div>}{loading&&<div className="notice">최신 기사를 가져오고 있습니다.</div>}
          <div className="newsList">
            {shown.map(x=><button key={x.id} className={'newsRow '+(selected?.id===x.id?'selected':'')} onClick={()=>setSelected(x)}>
              <div className="timeCol"><strong>{clock(x.publishedAt)}</strong><span>{x.category}</span></div>
              <div className="story"><div className="sourceName">{x.source}{x.exclusive&&<em>단독</em>}</div><h3>{x.title}</h3><p>{x.via||'최신 기사'}</p></div>
              <div className="matchState">{x.edailyMatch?'이데일리 관련 기사 있음':'대조 결과 없음'}</div><div className="chev">›</div>
            </button>)}
          </div>
        </section>

        <aside className="detailPanel">
          {!selected?<div className="detailEmpty">기사를 선택하세요</div>:<>
            <div className="detailTop"><div><b>{selected.source} · {selected.category}</b><p>◷ {clock(selected.publishedAt)} · {ago(selected.publishedAt)}</p></div></div>
            <h3 className="detailTitle">{selected.title}</h3>

            <div className="previewBox">
              <h4>기사 앞부분</h4>
              {previewLoading?<p className="muted">본문을 불러오는 중입니다.</p>:<>
                {preview.description&&<p>{preview.description}</p>}
                {preview.paragraphs.length>0?preview.paragraphs.slice(0,4).map((p,i)=><p key={i}>{p}</p>):!preview.description&&<p className="muted">본문 미리보기를 가져오지 못했습니다. 원문에서 확인하세요.</p>}
              </>}
            </div>

            <a className="primaryLink" href={selected.link} target="_blank" rel="noreferrer">기사 원문 열기 ↗</a>

            <div className="edailyBox">
              <h4>✓ 이데일리에 나왔나?</h4>
              {selected.edailyMatch?<><strong>관련 기사를 찾았습니다</strong><a href={selected.edailyMatch.link} target="_blank" rel="noreferrer">{selected.edailyMatch.title}</a><small>제목 유사도 {Math.round(selected.edailyMatch.similarity*100)}%</small></>:<><strong className="none">관련 기사 미확인</strong><p>같은 사건인지, 새로 추가된 사실이 있는지 원문을 비교해보세요.</p></>}
            </div>
          </>}
        </aside>
      </div>
    </main>
  </div>
}
