import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic='force-dynamic';

const xml=new XMLParser({ignoreAttributes:false,attributeNamePrefix:''});
const STOP=new Set([
  '속보','단독','종합','상보','관련','대해','대한','오늘','내일','이번','지난','최근','정부','당국','밝혀','발표','예정',
  '기자','뉴스','이데일리','연합뉴스','뉴시스','뉴스1','대한민국','한국','서울','오전','오후','현재','통해','위해','경우'
]);

function cleanTitle(s:string){
  return s.replace(/\[[^\]]+\]/g,' ')
    .replace(/\([^)]*\)/g,' ')
    .replace(/^(속보|단독|종합\d*보?|상보)\s*[:：-]?\s*/,'')
    .replace(/\s+-\s+이데일리\s*$/,'')
    .replace(/[“”‘’"'·….,!?()[\]{}<>:：]/g,' ')
    .replace(/\s+/g,' ').trim();
}

function keywordCandidates(title:string){
  const clean=cleanTitle(title);
  const raw=clean.split(/\s+/).filter(Boolean);
  const scored=raw.map((w,i)=>{
    const norm=w.replace(/은|는|이|가|을|를|의|에|서|로|으로|와|과|도|만|까지|부터$/,'');
    if(norm.length<2||STOP.has(norm)) return null;
    let score=0;
    if(/\d/.test(norm)) score+=6;
    if(/[A-Z]{2,}|[a-z]{3,}/.test(norm)) score+=5;
    if(/^[가-힣]{2,6}$/.test(norm)) score+=3;
    if(i<4) score+=2;
    if(/억|조|만|%|원|달러|명|건|년|월|일/.test(norm)) score+=2;
    return {word:norm,score};
  }).filter(Boolean) as {word:string;score:number}[];

  const unique=new Map<string,number>();
  for(const x of scored) unique.set(x.word,Math.max(unique.get(x.word)||0,x.score));
  return [...unique.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,6);
}

function googleUrl(q:string){
  return 'https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=ko&gl=KR&ceid=KR:ko';
}

async function fetchRss(query:string){
  const r=await fetch(googleUrl(query),{
    cache:'no-store',
    headers:{'user-agent':'Mozilla/5.0 (compatible; EdailyDutyDesk/1.0)'}
  });
  if(!r.ok) throw new Error(String(r.status));
  const data=xml.parse(await r.text());
  const items=data?.rss?.channel?.item ?? [];
  return (Array.isArray(items)?items:[items]).map((it:any)=>({
    title:String(it.title?.['#text']??it.title??'').trim(),
    link:String(it.link?.href??it.link??it.guid??'').trim(),
    publishedAt:new Date(it.pubDate??Date.now()).toISOString()
  })).filter((x:any)=>x.title&&x.link);
}

function tokenSet(s:string){
  return new Set(cleanTitle(s).split(/\s+/).map(x=>x.replace(/은|는|이|가|을|를|의|에|서|로|으로|와|과|도|만|까지|부터$/,'')).filter(x=>x.length>=2&&!STOP.has(x)));
}

function scoreMatch(sourceTitle:string,candidateTitle:string,keywords:string[]){
  const A=tokenSet(sourceTitle), B=tokenSet(candidateTitle);
  let overlap=0;
  A.forEach(x=>{if(B.has(x)) overlap++});
  const denom=Math.max(1,Math.min(A.size,B.size));
  let score=(overlap/denom)*0.55;

  const kwHits=keywords.filter(k=>B.has(k)||cleanTitle(candidateTitle).includes(k)).length;
  score += Math.min(0.3, kwHits*0.075);

  const numsA:string[]=sourceTitle.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const numsB:string[]=candidateTitle.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if(numsA.some(n=>numsB.includes(n))) score+=0.12;

  const core=keywords.slice(0,3);
  if(core.length>=2 && core.every(k=>cleanTitle(candidateTitle).includes(k))) score+=0.12;

  return Math.min(1,score);
}

export async function GET(req:NextRequest){
  const title=(req.nextUrl.searchParams.get('title')||'').trim();
  if(title.length<4) return NextResponse.json({found:false,keywords:[],candidates:[]});

  const keywords=keywordCandidates(title);
  const queries:string[]=[];
  if(keywords.length>=3) queries.push('site:edaily.co.kr '+keywords.slice(0,3).join(' ')+' when:14d');
  if(keywords.length>=2) queries.push('site:edaily.co.kr '+keywords.slice(0,2).join(' ')+' when:30d');
  if(keywords.length>=4) queries.push('site:edaily.co.kr '+keywords.slice(0,4).join(' ')+' when:30d');

  const batches=await Promise.all(queries.map(q=>fetchRss(q).catch(()=>[])));
  const merged=[...batches.flat()];
  const seen=new Set<string>();
  const candidates=merged.filter(x=>{
    const k=cleanTitle(x.title);
    if(seen.has(k)) return false;
    seen.add(k); return true;
  }).map(x=>({...x,score:scoreMatch(title,x.title,keywords)}))
    .sort((a,b)=>b.score-a.score)
    .slice(0,8);

  const best=candidates[0]||null;
  const found=!!best && best.score>=0.46;

  return NextResponse.json({
    found,
    keywords,
    best:found?best:null,
    candidates:candidates.slice(0,5),
    threshold:0.46
  },{headers:{'Cache-Control':'no-store'}});
}
