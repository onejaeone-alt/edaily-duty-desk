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
function dateStamp(iso:string){const d=new Date(iso);return `${d.getMonth()+1}. ${d.getDate()}. ${clock(iso)}`;}
function previewText(description:string, paragraphs:string[]){const raw=(description||paragraphs.join(' ')).replace(/\s+/g,' ').trim();return raw.length>200?raw.slice(0,200).trimEnd()+'…':raw;}
function recommendedItems(items:Item[]){const sorted=[...items].sort((a,b)=>b.score-a.score||new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime());const out:Item[]=[];let breaking=0;for(const item of sorted){const isBreaking=/^(속보|\[속보\])/i.test(item.title);if(isBreaking&&breaking>=5)continue;out.push(item);if(isBreaking)breaking++;if(out.length>=40)break;}return out;}

export default function Page(){
  const [data,setData]=useState<Api>({items:[],sourceStatus:{}});
  const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [tab,setTab]=useState<'전체최신'|'추천기사'|'타사단독'>('전체최신');
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
    let a=tab==='전체최신'?data.items:tab==='추천기사'?recommendedItems(data.items):data.items.filter(x=>x.exclusive||x.source==='타사 단독');
    if(tab!=='추천기사')a=[...a].sort((x,y)=>new Date(y.publishedAt).getTime()-new Date(x.publishedAt).getTime());
    if(cat!=='전체')a=a.filter(x=>x.category===cat);
    if(q.trim()){const qq=q.trim().toLowerCase();a=a.filter(x=>(x.title+' '+x.source).toLowerCase().includes(qq))}
    return a;
  },[tab,data.items,cat,q]);

  return <div className="appShell">
    <header className="topbar">
      <div className="brand"><div className="brandIcon"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="12" fill="#2456F3"/><text x="31" y="42" textAnchor="middle" fontSize="36" fontWeight="800" fontFamily="Arial, sans-serif" fill="#fff">E</text><circle cx="49" cy="15" r="5.5" fill="#FF4D5E"/></svg></div><div><h1>당직 데스크</h1><p>EDAILY NEWSROOM</p></div></div>
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
            {(['전체최신','추천기사','타사단독'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='전체최신'?'전체':t==='추천기사'?'추천기사':'타사 단독'}</button>)}
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
            <div className="detailTop">
              <div><b>{selected.source} · {selected.category}</b></div>
              <button className="closeBtn" onClick={()=>setSelected(null)}>닫기</button>
            </div>
            <div className="detailMeta">
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10 5.5v5l3 1.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{dateStamp(selected.publishedAt)}</span>
            </div>
            <h3 className="detailTitle">{selected.title}</h3>

            <div className="previewLead">
              {previewLoading?<p className="muted">본문을 불러오는 중입니다.</p>:previewText(preview.description,preview.paragraphs)?<p>{previewText(preview.description,preview.paragraphs)}</p>:<p className="muted">본문 미리보기를 가져오지 못했습니다. 원문에서 확인하세요.</p>}
            </div>

            <a className="primaryLink" href={selected.link} target="_blank" rel="noreferrer">
              <span>기사 원문 열기</span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 4h5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 11l7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 11v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>

            <div className="edailyBox">
              <h4>✓ 이데일리에 나왔나?</h4>
              {selected.edailyMatch?<>
                <strong>관련 기사를 찾았습니다</strong>
                <p className="helper">같은 사건인지, 새로 추가된 사실이 있는지 원문을 비교해보세요.</p>
                <a className="relatedLink" href={selected.edailyMatch.link} target="_blank" rel="noreferrer">{selected.edailyMatch.title}</a>
                <small>이데일리 · 제목 유사도 {Math.round(selected.edailyMatch.similarity*100)}%</small>
              </>:<>
                <strong className="none">확인한 범위에서는 찾지 못했습니다</strong>
                <p className="helper">검색에서 찾지 못해도 이미 출고됐거나 다른 기자가 쓰고 있을 수 있습니다.</p>
              </>}

              <button className="searchGhost" type="button" disabled>
                <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M12.8 12.8L17 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                <span>추가 검색 중</span>
              </button>
              <a className="naverLink" href={`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(selected.title+' 이데일리')}`} target="_blank" rel="noreferrer">
                네이버에서 직접 확인
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 4h5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 11l7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 11v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            </div>
          </>}
        </aside>
      </div>
    </main>
  </div>
}
