"use client";
import {useSyncExternalStore,useEffect} from 'react';
import {MarkQueue} from '@/lib/mark-queue.mjs';
import type {Mark} from '@/lib/types';
const globalForMarks=globalThis as typeof globalThis & {journalMarkQueue?:MarkQueue};
const queue=globalForMarks.journalMarkQueue??new MarkQueue(async(payload:object)=>{const response=await fetch('/api/journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось сохранить отметки');return result;});
if(typeof window!=="undefined")globalForMarks.journalMarkQueue=queue;
const server={marks:[] as Mark[],saving:false,error:''};
export function useMarkSync(){
 const state=useSyncExternalStore(queue.subscribe,queue.getSnapshot,()=>server);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(queue.busy){e.preventDefault();}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
 return {...state,hydrate:queue.hydrate.bind(queue),merge:queue.merge.bind(queue),edit:(edit:object)=>queue.enqueue(edit),retry:queue.retry,busy:queue.busy};
}
export {queue as markQueue};
