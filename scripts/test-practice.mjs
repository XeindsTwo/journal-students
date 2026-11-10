import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {dbConfig} from '../lib/db-config.mjs';
import {authenticatedFetch,closeTestSession} from './test-session.mjs';
const db=new pg.Client(dbConfig());await db.connect();
const url='http://127.0.0.1:3000/api/journal', receipts=[];
let group;
async function post(body,status=200){
 const r=await authenticatedFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;
}
const state=async()=>await (await authenticatedFetch(url)).json();
try{
 group=(await post({action:'group',name:'QA-practice-'+randomUUID(),names:['Тестовый студент'],joined_on:'2026-09-01'})).id;
 const journal=(await post({action:'journal',group_id:group,name:'Тестовый предмет',short_name:'QA',period:'2026'})).id;
 const payload={action:'lesson',journal_id:journal,date:'2026-11-09',kind:'practice',practice_no:5,title:'ООП',slot:null};
 const {id}=await post(payload);
 const pair=slot=>post({action:'lesson',journal_id:journal,date:payload.date,kind:'lesson',slot,title:'Пара'});
 const [{id:one},{id:two},{id:three}]=await Promise.all([pair(1),pair(2),pair(3)]);
 await post({action:'lesson',journal_id:journal,date:payload.date,kind:'lesson',slot:2,title:'Дубликат'},400);
 await post({...payload,date:'2026-11-10'},400);
 let data=await state();
 const student=data.students.find(s=>s.group_id===group).id;
 assert.equal(data.lessons.find(l=>l.id===id).practice_no,5);
 const op=(operation,extra)=>({lesson_id:id,student_id:student,operation,...extra});
 const batch=(operations,status=200)=>{const request_id=randomUUID();receipts.push(request_id);return post({action:'mark-operations',request_id,operations},status);};
 await batch([op('toggle-attendance',{attendance:'absent'}),op('overdue',{overdue:true}),op('add-grade',{grade:2})]);
 const result=await batch([op('add-grade',{grade:5})]);assert.deepEqual(result.marks[0].grades,[5]);assert.equal(result.marks[0].attendance,'absent');assert.equal(result.marks[0].overdue,true);
 await batch([op('attendance',{attendance:'late'})],400);
 await assert.rejects(db.query('UPDATE marks SET grades=ARRAY[2,5] WHERE lesson_id=$1',[id]),{code:'23514'});
 await post({action:'mark-batch',lesson_id:id,rows:[{student_id:student,grade:4}]});
 await post({action:'lesson-update',id,date:payload.date,slot:2,practice_no:6,title:'Классы',description:'',tags:[]});
 data=await state();assert.deepEqual(data.lessons.filter(l=>l.journal_id===journal).map(l=>l.id),[one,two,id,three]);assert.equal(data.lessons.find(l=>l.id===id).slot,2);assert.equal(data.lessons.find(l=>l.id===id).practice_no,6);assert.deepEqual(data.marks.find(m=>m.lesson_id===id).grades,[4]);assert.equal(data.marks.find(m=>m.lesson_id===id).overdue,true);
 await batch([op('overdue',{overdue:false})]);
 const cleared=await batch([op('clear',{})]);assert.equal(cleared.marks[0].overdue,false);assert.equal(cleared.marks[0].attendance,'unknown');assert.deepEqual(cleared.marks[0].grades,[]);
 console.log('Practice: numbering, duplicate prevention, final grade replacement, independent absence and overdue flags, editing and clearing passed.');
}finally{
 try{if(group){await db.query('BEGIN');await db.query('DELETE FROM lessons WHERE journal_id IN(SELECT id FROM journals WHERE group_id=$1)',[group]);await db.query('DELETE FROM journals WHERE group_id=$1',[group]);await db.query('DELETE FROM students WHERE group_id=$1',[group]);await db.query('DELETE FROM groups WHERE id=$1',[group]);await db.query('DELETE FROM mutation_receipts WHERE request_id=ANY($1::uuid[])',[receipts]);await db.query('COMMIT');}}
 finally{await db.end();await closeTestSession();}
}
