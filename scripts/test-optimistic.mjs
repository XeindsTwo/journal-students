import {authenticatedFetch,closeTestSession} from "./test-session.mjs";
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import {dbConfig} from '../lib/db-config.mjs';
const client=new pg.Client(dbConfig());await client.connect();let groupId;const receipts=[];const keep=process.argv.includes('--keep');
const post=async(body,status=200)=>{const r=await authenticatedFetch('http://127.0.0.1:3000/api/journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
try{
 groupId=(await post({action:'group',name:'QA-optimistic-'+Date.now(),names:['Первый тестовый студент','Второй тестовый студент'],joined_on:'2026-09-01'})).id;
 const journal=(await post({action:'journal',group_id:groupId,name:'Проверка мгновенного сохранения',short_name:'Тест',period:'2026'})).id;
 const lesson=(await post({action:'lesson',journal_id:journal,date:'2026-10-18',slot:1,title:'Проверка'})).id;
 const students=(await client.query('SELECT id FROM students WHERE group_id=$1 ORDER BY id',[groupId])).rows.map(s=>s.id);
 const edit=(operation,extra={})=>({lesson_id:lesson,student_id:students[0],operation,...extra});
 const request_id=randomUUID();receipts.push(request_id);
 const payload={action:'mark-operations',request_id,operations:[edit('add-grade',{grade:5}),edit('add-grade',{grade:5}),edit('toggle-attendance',{attendance:'absent'}),edit('toggle-attendance',{attendance:'absent'}),edit('add-grade',{grade:4})]};
 const [a,b]=await Promise.all([post(payload),post(payload)]);assert.deepEqual(a,b);assert.deepEqual(Object.keys(a).sort(),['marks','ok']);assert.equal(a.marks.length,1);assert.deepEqual(a.marks[0].grades,[5,5,4]);assert.equal(a.marks[0].attendance,'unknown');
 await post({...payload,operations:[edit('add-grade',{grade:2})]},400);
 const badId=randomUUID();receipts.push(badId);await post({action:'mark-operations',request_id:badId,operations:[edit('add-grade',{grade:2}),edit('remove-grade',{grade:2,index:0})]},400);
 const mark=(await client.query('SELECT * FROM marks WHERE lesson_id=$1 AND student_id=$2',[lesson,students[0]])).rows[0];assert.deepEqual(mark.grades,[5,5,4]);
 const otherId=randomUUID();receipts.push(otherId);const result=await post({action:'mark-operations',request_id:otherId,operations:[{lesson_id:lesson,student_id:students[1],operation:'attendance',attendance:'late'},{lesson_id:lesson,student_id:students[1],operation:'add-grade',grade:3}]});assert.equal(result.marks[0].attendance,'late');assert.deepEqual(result.marks[0].grades,[3]);
 console.log('Optimistic API: concurrent replay, duplicate grades, ordered toggles, rollback and point responses passed');
 if(keep){await fs.writeFile('.qa-optimistic.json',JSON.stringify({groupId,journal,lesson,students,receipts}));console.log('UI fixture journal: '+journal);}
}finally{if(groupId&&!keep){await client.query('BEGIN');await client.query('DELETE FROM lessons WHERE journal_id IN (SELECT id FROM journals WHERE group_id=$1)',[groupId]);await client.query('DELETE FROM journals WHERE group_id=$1',[groupId]);await client.query('DELETE FROM students WHERE group_id=$1',[groupId]);await client.query('DELETE FROM groups WHERE id=$1 AND name LIKE $2',[groupId,'QA-optimistic-%']);await client.query('COMMIT');await client.query('DELETE FROM mutation_receipts WHERE request_id=ANY($1::uuid[])',[receipts]);}await client.end();await closeTestSession();}
