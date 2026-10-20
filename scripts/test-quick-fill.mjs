import {authenticatedFetch,closeTestSession} from "./test-session.mjs";
import assert from "node:assert/strict";
import pg from "pg";
import {dbConfig} from "../lib/db-config.mjs";
const client=new pg.Client(dbConfig());await client.connect();let groupId,otherGroupId;
const endpoint="http://127.0.0.1:3000/api/journal";
async function post(body,status=200){const r=await authenticatedFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function get(){return(await authenticatedFetch(endpoint)).json();}
try{
 groupId=(await post({action:"group",name:"QA-batch-"+Date.now(),names:["Первый студент","Второй студент","Третий студент"],joined_on:"2026-09-01"})).id;
 const j=(await post({action:"journal",group_id:groupId,name:"Проверка быстрого заполнения",short_name:"Тест",period:"2026"})).id;
 const l=(await post({action:"lesson",journal_id:j,date:"2026-10-18",slot:1,title:"Самостоятельная"})).id;
 const ids=(await get()).students.filter(s=>s.group_id===groupId).map(s=>s.id);
 const mark=async(id)=>(await get()).marks.find(m=>m.lesson_id===l&&m.student_id===id);
 await post({action:"mark",lesson_id:l,student_id:ids[0],attendance:"late",grade:3});
 await post({action:"mark-batch",lesson_id:l,rows:[{student_id:ids[0],grade:5},{student_id:ids[1],attendance:"absent",grade:4},{student_id:ids[2],attendance:"late"}]});
 assert.deepEqual((await mark(ids[0])).grades,[3,5]);assert.equal((await mark(ids[0])).attendance,"late");
 assert.deepEqual((await mark(ids[1])).grades,[4]);assert.equal((await mark(ids[1])).attendance,"absent");
 assert.deepEqual((await mark(ids[2])).grades,[]);assert.equal((await mark(ids[2])).attendance,"late");
 await post({action:"mark-batch",lesson_id:l,rows:[{student_id:ids[1],attendance:"unknown"}]});
 assert.deepEqual((await mark(ids[1])).grades,[4]);assert.equal((await mark(ids[1])).attendance,"unknown");
 await post({action:"mark-batch",lesson_id:l,rows:[{student_id:ids[0],grade:4},{student_id:ids[0],grade:5}]},400);
 await post({action:"mark-batch",lesson_id:l,rows:[{student_id:ids[0],grade:6}]},400);
 await post({action:"mark-batch",lesson_id:l,rows:[{student_id:ids[0]}]},400);
 otherGroupId=(await post({action:"group",name:"QA-other-"+Date.now(),names:["Чужой студент"],joined_on:"2026-09-01"})).id;
 const other=(await get()).students.find(s=>s.group_id===otherGroupId).id;
 await post({action:"mark-batch",lesson_id:l,rows:[{student_id:ids[0],grade:2},{student_id:other,grade:5}]},400);
 assert.deepEqual((await mark(ids[0])).grades,[3,5]);
 await client.query("UPDATE marks SET grades=array_fill(4,ARRAY[100]),grade=4 WHERE lesson_id=$1 AND student_id=$2",[l,ids[1]]);
 await post({action:"mark-batch",lesson_id:l,rows:[{student_id:ids[0],grade:2},{student_id:ids[1],grade:5}]},400);
 assert.deepEqual((await mark(ids[0])).grades,[3,5]);
 console.log("OK: быстрое заполнение, добавление к старым оценкам, Н/О, независимость полей, валидация, чужая группа и откат всего списка при ошибке.");
}finally{
 for(const id of [groupId,otherGroupId].filter(Boolean)){await client.query("BEGIN");await client.query("DELETE FROM lessons WHERE journal_id IN (SELECT id FROM journals WHERE group_id=$1)",[id]);await client.query("DELETE FROM journals WHERE group_id=$1",[id]);await client.query("DELETE FROM students WHERE group_id=$1",[id]);await client.query("DELETE FROM groups WHERE id=$1",[id]);await client.query("COMMIT");}
 await client.end();await closeTestSession();
}
