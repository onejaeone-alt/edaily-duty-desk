import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';

export type Category = '생활'|'경제'|'문화'|'사회'|'정치'|'국제'|'스포츠'|'기타';
export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  category: Category;
  score: number;
  exclusive: boolean;
  edailyMatch?: { title: string; link: string; similarity: number } | null;
  via?: string;
};

const UA = 'Mozilla/5.0 (compatible; EdailyDutyDesk/1.0; +internal-news-monitor)';
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

const NEWSIS_FEEDS: Array<[Category,string]> = [
  ['기타','https://nwww.newsis.com/RSS/sokbo.xml'],
  ['정치','https://nwww.newsis.com/RSS/politics.xml'],
  ['국제','https://nwww.newsis.com/RSS/international.xml'],
  ['경제','https://nwww.newsis.com/RSS/economy.xml'],
  ['경제','https://nwww.newsis.com/RSS/bank.xml'],
  ['경제','https://nwww.newsis.com/RSS/industry.xml'],
  ['생활','https://nwww.newsis.com/RSS/health.xml'],
  ['사회','https://nwww.newsis.com/RSS/society.xml'],
  ['스포츠','https://nwww.newsis.com/RSS/sports.xml'],
  ['문화','https://nwww.newsis.com/RSS/culture.xml'],
  ['문화','https://nwww.newsis.com/RSS/entertain.xml']
];

const categoryRules: Array<[Category, RegExp]> = [
  ['생활', /(날씨|기온|태풍|폭염|한파|미세먼지|건강|병원|질병|감염|식품|소비자|물가|교육|학교|교통|철도|지하철|항공|여행|관광|주거|아파트|전세|월세|육아|반려|생활)/i],
  ['경제', /(금리|환율|주가|코스피|코스닥|증시|은행|금융|보험|대출|부동산|기업|산업|수출|수입|무역|반도체|배터리|자동차|공시|실적|매출|영업이익|투자|M&A|인수|매각|IPO|증권|펀드|채권|가상자산|코인)/i],
  ['문화', /(영화|드라마|공연|전시|문화|연예|가수|배우|감독|방송|OTT|콘서트|음악|미술|책|출판|축제|패션|뷰티)/i],
  ['사회', /(경찰|검찰|법원|사고|화재|사망|부상|실종|범죄|구속|기소|재판|노동|노조|파업|재난|소방|교육청|대학|사회)/i],
  ['정치', /(대통령|청와대|국회|민주당|국민의힘|정당|의원|장관|정부|총리|선거|정치|특검|헌재|외교부|국방부)/i],
  ['국제', /(미국|중국|일본|러시아|우크라이나|이스라엘|이란|유럽|EU|트럼프|시진핑|푸틴|전쟁|해외|국제|백악관)/i],
  ['스포츠', /(야구|축구|농구|배구|골프|올림픽|아시안게임|월드컵|KBO|K리그|MLB|스포츠|선수|감독)/i]
];

function normalizeTitle(s:string){
  return s.replace(/\[[^\]]+\]|\([^)]*?(?:사진|종합|상보|속보)[^)]*\)/g,' ')
    .replace(/^(속보|단독|종합\d*보?|상보)\s*[:：-]?\s*/,'')
    .replace(/[“”‘’"'·….,!?()[\]{}<>]/g,' ')
    .replace(/\s+/g,' ').trim();
}
function tokens(s:string){
  return new Set(normalizeTitle(s).split(' ').filter(x=>x.length>=2));
}
function similarity(a:string,b:string){
  const A=tokens(a), B=tokens(b); if(!A.size||!B.size) return 0;
  let inter=0; A.forEach(x=>{if(B.has(x)) inter++});
  return inter / Math.max(A.size,B.size);
}
function classify(title:string, fallback:Category='기타'):Category{
  for(const [cat,re] of categoryRules) if(re.test(title)) return cat;
  return fallback;
}
function importance(title:string, publishedAt:string){
  let s=45;
  if(/^(속보|\[속보\])|비상|사망|구속|체포|기소|영장|전격|사퇴|해임|파면|탄핵|붕괴|폭발|화재|추락|충돌|전쟁|공격|피격|금리|기준금리|환율|급등|급락|서킷브레이커|거래정지/i.test(title)) s+=28;
  if(/단독|최초|확정|결정|발표|합의|무산|중단|재개|인수|매각|공개매수|회생|파산|법정관리/i.test(title)) s+=14;
  if(/포토|화보|영상|SNS|근황|패션|공항패션/i.test(title)) s-=18;
  const age=(Date.now()-new Date(publishedAt).getTime())/60000;
  if(Number.isFinite(age)) s += age<10?16:age<30?10:age<60?5:age>360?-10:0;
  return Math.max(0,Math.min(100,Math.round(s)));
}
function idOf(source:string,title:string,link:string){
  let h=2166136261; const str=source+'|'+title+'|'+link;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i); h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}

async function fetchText(url:string, timeout=8000){
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),timeout);
  try{
    const r=await fetch(url,{headers:{'user-agent':UA,'accept':'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8'},cache:'no-store',signal:ctl.signal});
    if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

function rssItems(raw:string, source:string, fallback:Category, via?:string):NewsItem[]{
  const data=xml.parse(raw); const rawItems=data?.rss?.channel?.item ?? data?.feed?.entry ?? [];
  const arr=Array.isArray(rawItems)?rawItems:[rawItems];
  return arr.slice(0,60).map((it:any)=>{
    const title=String(it.title?.['#text'] ?? it.title ?? '').trim();
    const link=String(it.link?.href ?? it.link ?? it.guid ?? '').trim();
    const publishedAt=new Date(it.pubDate ?? it.published ?? it.updated ?? Date.now()).toISOString();
    const category=classify(title,fallback);
    const score=importance(title,publishedAt);
    return {id:idOf(source,title,link),title,link,source,publishedAt,category,score,exclusive:/단독/.test(title),via};
  }).filter(x=>x.title&&x.link);
}

export async function fetchNewsis(){
  const out:NewsItem[]=[];
  await Promise.all(NEWSIS_FEEDS.map(async([cat,url])=>{
    try{ out.push(...rssItems(await fetchText(url),'뉴시스',cat)); }catch{}
  }));
  return dedupe(out).slice(0,120);
}

export async function fetchNews1(){
  try{
    const raw=await fetchText('https://www.news1.kr/breakingnews');
    const $=cheerio.load(raw); const out:NewsItem[]=[];
    $('a[href]').each((_,el)=>{
      const href=$(el).attr('href')||''; const title=$(el).text().replace(/\s+/g,' ').trim();
      if(title.length<10 || !/^\/(politics|economy|society|industry|world|sports|entertain|local|life-culture|photos|articles)/.test(href)) return;
      const link=new URL(href,'https://www.news1.kr').toString();
      const publishedAt=new Date().toISOString(); const category=classify(title,'기타'); const score=importance(title,publishedAt);
      out.push({id:idOf('뉴스1',title,link),title,link,source:'뉴스1',publishedAt,category,score,exclusive:/단독/.test(title)});
    });
    return dedupe(out).slice(0,80);
  }catch{return []}
}

function googleRssUrl(q:string){
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
}
export async function fetchGoogleNews(query:string, sourceLabel:string, fallback:Category='기타'){
  try{return rssItems(await fetchText(googleRssUrl(query)),sourceLabel,fallback,'Google 뉴스').slice(0,80)}catch{return []}
}

export async function fetchYonhap(){
  const g=await fetchGoogleNews('site:yna.co.kr when:1h','연합뉴스');
  return g.map(x=>({...x,source:'연합뉴스',via:'Google 뉴스 보완'}));
}
export async function fetchExclusives(){
  const g=await fetchGoogleNews('"단독" when:2h','타사 단독');
  return g.filter(x=>!/연합뉴스|뉴시스|뉴스1|이데일리/.test(x.title)).map(x=>({...x,exclusive:true,via:'Google 뉴스'}));
}
export async function fetchEdailyLatest(){
  return await fetchGoogleNews('site:edaily.co.kr when:1d','이데일리');
}

function dedupe(items:NewsItem[]){
  const seen=new Set<string>();
  return items.filter(x=>{const k=normalizeTitle(x.title); if(seen.has(k))return false; seen.add(k); return true;});
}

export async function getAllNews(){
  const [newsis,news1,yonhap,exclusive,edaily]=await Promise.all([fetchNewsis(),fetchNews1(),fetchYonhap(),fetchExclusives(),fetchEdailyLatest()]);
  const merged=dedupe([...newsis,...news1,...yonhap,...exclusive]);
  for(const item of merged){
    let best:{title:string;link:string;similarity:number}|null=null;
    for(const e of edaily){ const sim=similarity(item.title,e.title); if(sim>=(best?.similarity??0)) best={title:e.title,link:e.link,similarity:sim}; }
    item.edailyMatch = best && best.similarity>=0.48 ? best : null;
  }
  merged.sort((a,b)=> new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime());
  return {
    generatedAt:new Date().toISOString(),
    items:merged.slice(0,220),
    sourceStatus:{
      newsis:{ok:newsis.length>0,count:newsis.length,mode:'공식 RSS'},
      news1:{ok:news1.length>0,count:news1.length,mode:'공개 실시간 속보'},
      yonhap:{ok:yonhap.length>0,count:yonhap.length,mode:'Google 뉴스 보완'},
      exclusive:{ok:exclusive.length>0,count:exclusive.length,mode:'Google 뉴스 단독 검색'},
      edaily:{ok:edaily.length>0,count:edaily.length,mode:'Google 뉴스 기출고 대조'}
    }
  };
}
