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
 group=(await post({action:'group',name:'QA-independent-'+randomUUID(),names:['Тестовый студент'],joined_on:'2026-09-01'})).id;
 const subject=()=>post({action:'journal',group_id:group,name:'Тестовый предмет',short_name:'QA',period:'2026'});
 const [{id:journal},{id:other}]=await Promise.all([subject(),subject()]);
 const create=(journal_id=journal,date='2026-11-08')=>post({action:'lesson',journal_id,date,kind:'independent',slot:null,title:''});
 const first=await create(), second=await create(journal,"2026-11-03");
 const fresh=await create(other);
 let data=await state();
 const entry=id=>data.lessons.find(l=>l.id===id);
 assert.equal(entry(second.id).title,'Самостоятельная работа №1');assert.equal(entry(first.id).title,'Самостоятельная работа №2');
 assert.equal(entry(fresh.id).title,'Самостоятельная работа №1');
 await post({action:'delete-lesson',id:second.id});
 const third=await create();data=await state();
 assert.equal(entry(first.id).title,'Самостоятельная работа №1');assert.equal(entry(third.id).title,'Самостоятельная работа №2');
 const student=data.students.find(s=>s.group_id===group).id;
 const operation=(operation,more)=>({lesson_id:first.id,student_id:student,operation,...more});
 const batch=(operations,status=200)=>{const request_id=randomUUID();receipts.push(request_id);return post({action:'mark-operations',request_id,operations},status);};
 await batch([operation('attendance',{attendance:'present'})],400);
 await batch([operation('add-grade',{grade:2})]);
 const updated=await batch([operation('attendance',{attendance:'absent'}),operation('add-grade',{grade:5})]);
 assert.deepEqual(updated.marks[0].grades,[2,5]);assert.equal(updated.marks[0].attendance,'absent');
 await batch([operation('add-grade',{grade:4})],400);
 await batch([operation('attendance',{attendance:'late'})],400);
 assert.deepEqual((await db.query('SELECT grades,attendance FROM marks WHERE lesson_id=$1',[first.id])).rows,[{grades:[2,5],attendance:'absent'}]);
 await assert.rejects(db.query('UPDATE marks SET grades=ARRAY[2,3,4] WHERE lesson_id=$1',[first.id]),{code:'23514'});
 await post({action:'lesson-update',id:first.id,date:'2026-11-09',slot:null,title:'Другое название',description:'Задание',tags:['Лекция']});
 data=await state();assert.equal(entry(first.id).title,'Самостоятельная работа №2');assert.equal(entry(third.id).title,'Самостоятельная работа №1');assert.deepEqual(entry(first.id).tags,['Лекция']);assert.deepEqual(data.marks.find(m=>m.lesson_id===first.id).grades,[2,5]);
 console.log('Independent assignments: chronological numbering including backdated entries, per-subject numbering, deletion and date changes, absence and two grades preserved.');
}finally{
 try{if(group){await db.query('BEGIN');await db.query('DELETE FROM lessons WHERE journal_id IN(SELECT id FROM journals WHERE group_id=$1)',[group]);await db.query('DELETE FROM journals WHERE group_id=$1',[group]);await db.query('DELETE FROM students WHERE group_id=$1',[group]);await db.query('DELETE FROM groups WHERE id=$1',[group]);await db.query('DELETE FROM mutation_receipts WHERE request_id=ANY($1::uuid[])',[receipts]);await db.query('COMMIT');}}
 finally{await db.end();await closeTestSession();}
}
