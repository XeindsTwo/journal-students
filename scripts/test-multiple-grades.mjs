import assert from "node:assert/strict";
import pg from "pg";
import {dbConfig} from "../lib/db-config.mjs";
const client=new pg.Client(dbConfig());await client.connect();let groupId;
const endpoint="http://127.0.0.1:3000/api/journal";
async function post(body,status=200){const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function state(){const r=await fetch(endpoint);assert.equal(r.status,200);return r.json();}
try{
 groupId=(await post({action:"group",name:"QA-multiple-"+Date.now(),names:["Тест нескольких оценок"],joined_on:"2026-09-01"})).id;
 const journalId=(await post({action:"journal",group_id:groupId,name:"Проверка списков оценок",short_name:"Тест",period:"2026"})).id;
 const lessonId=(await post({action:"lesson",journal_id:journalId,date:"2026-10-18",slot:1,title:"Проверка"})).id;
 const studentId=(await state()).students.find(s=>s.group_id===groupId).id;
 const edit=(operation,fields={},status=200)=>post({action:"mark-edit",lesson_id:lessonId,student_id:studentId,operation,...fields},status);
 const mark=async()=>(await state()).marks.find(m=>m.lesson_id===lessonId&&m.student_id===studentId);
 await post({action:"mark",lesson_id:lessonId,student_id:studentId,attendance:"absent",grade:3});
 assert.deepEqual((await mark()).grades,[3]);
 await edit("add-grade",{grade:5});await edit("add-grade",{grade:5});await edit("add-grade",{grade:4});
 assert.deepEqual((await mark()).grades,[3,5,5,4]);assert.equal((await mark()).attendance,"absent");
 await edit("attendance",{attendance:"late"});
 await edit("remove-grade",{index:1,grade:5});
 assert.deepEqual((await mark()).grades,[3,5,4]);assert.equal((await mark()).attendance,"late");
 await edit("remove-grade",{index:0,grade:5},400);
 assert.deepEqual((await mark()).grades,[3,5,4]);
 await edit("clear-grades");assert.deepEqual((await mark()).grades,[]);assert.equal((await mark()).attendance,"late");
 await Promise.all([edit("add-grade",{grade:4}),edit("add-grade",{grade:5}),edit("attendance",{attendance:"absent"})]);
 const concurrent=await mark();assert.deepEqual([...concurrent.grades].sort(),[4,5]);assert.equal(concurrent.attendance,"absent");
 await edit("attendance",{attendance:"unknown"});assert.equal((await mark()).grades.length,2);

 await edit("toggle-attendance",{attendance:"absent"});assert.equal((await mark()).attendance,"absent");
 await edit("toggle-attendance",{attendance:"absent"});assert.equal((await mark()).attendance,"unknown");
 await edit("toggle-attendance",{attendance:"late"});assert.equal((await mark()).attendance,"late");
 await edit("toggle-attendance",{attendance:"late"});assert.equal((await mark()).attendance,"unknown");
 await Promise.all([edit("toggle-attendance",{attendance:"absent"}),edit("toggle-attendance",{attendance:"absent"})]);
 assert.equal((await mark()).attendance,"unknown");assert.equal((await mark()).grades.length,2);
 await edit("clear");assert.deepEqual((await mark()).grades,[]);assert.equal((await mark()).attendance,"unknown");
 await edit("add-grade",{},400);await edit("add-grade",{grade:6},400);await edit("attendance",{attendance:"present"},400);
 const before=await client.query("SELECT count(*) FROM marks WHERE grade IS NOT NULL AND grades='{}'");
 assert.equal(before.rows[0].count,"0");
 console.log("OK: перенос старой оценки, несколько и повторные оценки, Н/О независимо, удаление одной, проверка устаревшего индекса, одновременные записи, очистка и валидация.");
}finally{
 if(groupId){await client.query("BEGIN");await client.query("DELETE FROM lessons WHERE journal_id IN (SELECT id FROM journals WHERE group_id=$1)",[groupId]);await client.query("DELETE FROM journals WHERE group_id=$1",[groupId]);await client.query("DELETE FROM students WHERE group_id=$1",[groupId]);await client.query("DELETE FROM groups WHERE id=$1",[groupId]);await client.query("COMMIT");}
 await client.end();
}
