import { NextResponse } from 'next/server';
import { getAllNews } from '../../../lib/news';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(){
  try{
    const data=await getAllNews();
    return NextResponse.json(data,{headers:{'Cache-Control':'no-store, max-age=0'}});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'news fetch failed',items:[],sourceStatus:{}},{status:500});
  }
}
