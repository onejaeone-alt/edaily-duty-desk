import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic='force-dynamic';

const ALLOWED = [
  'news1.kr','www.news1.kr',
  'newsis.com','www.newsis.com','nwww.newsis.com',
  'yna.co.kr','www.yna.co.kr',
  'edaily.co.kr','www.edaily.co.kr',
  'news.google.com'
];

function clean(s:string){return s.replace(/\s+/g,' ').trim();}

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get('url');
  if(!raw) return NextResponse.json({error:'url required'},{status:400});
  let u:URL;
  try{u=new URL(raw)}catch{return NextResponse.json({error:'bad url'},{status:400})}
  if(!ALLOWED.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))) return NextResponse.json({error:'host not allowed'},{status:400});

  try{
    const r=await fetch(u.toString(),{
      redirect:'follow',
      cache:'no-store',
      headers:{
        'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/153 Safari/537.36',
        'accept-language':'ko-KR,ko;q=0.9,en;q=0.7'
      }
    });
    if(!r.ok) throw new Error(String(r.status));
    const html=await r.text();
    const $=cheerio.load(html);

    const metaDesc = clean(
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') || ''
    );

    const selectors=[
      'article p',
      '.article_view p',
      '.article-body p',
      '.article_body p',
      '.articleBody p',
      '.newsct_article p',
      '#articleBody p',
      '#articlebody p',
      '.view_cont p',
      '.view-content p',
      '.article_content p',
      '.article-content p'
    ];

    const texts:string[]=[];
    for(const sel of selectors){
      $(sel).each((_,el)=>{
        const t=clean($(el).text());
        if(t.length>=35 && !/무단전재|재배포|저작권|기자\s*=|기사제보|광고문의/.test(t)) texts.push(t);
      });
      if(texts.length>=3) break;
    }

    if(texts.length<2){
      $('p').each((_,el)=>{
        const t=clean($(el).text());
        if(t.length>=50 && t.length<=500 && !/무단전재|재배포|저작권|기자\s*=|기사제보|광고문의|로그인|구독/.test(t)) texts.push(t);
      });
    }

    const unique=[...new Set(texts)].slice(0,5);
    return NextResponse.json({
      description:metaDesc,
      paragraphs:unique,
      resolvedUrl:r.url
    },{headers:{'Cache-Control':'no-store'}});
  }catch{
    return NextResponse.json({description:'',paragraphs:[],resolvedUrl:raw});
  }
}
