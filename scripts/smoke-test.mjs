import assert from "node:assert/strict";
import pg from "pg";
import {dbConfig} from "../lib/db-config.mjs";
const base=process.env.TEST_URL??"http://127.0.0.1:3000";
const client=new pg.Client(dbConfig());await client.connect();
let groupId;
async function post(body,expected=200){
 const res=await fetch(base+"/api/journal",{method:"POST",headers:{"Content-Type":"application/json","Origin":base},body:JSON.stringify(body)});
 const data=await res.json();assert.equal(res.status,expected,JSON.stringify(data));return data;
}
async function get(){const r=await fetch(base+"/api/journal");assert.equal(r.status,200);return r.json();}
try{
 groupId=(await post({action:"group",name:"QA-"+Date.now(),names:["Тест Один","Тест Два"],joined_on:"2026-09-01"})).id;
 const j=(await post({action:"journal",group_id:groupId,name:"Проверка API",short_name:"QA",period:"2026–2027"})).id;
 const j2=(await post({action:"journal",group_id:groupId,name:"Второй предмет",short_name:"QA2",period:"2026–2027"})).id;
 const l=(await post({action:"lesson",journal_id:j,date:"2026-10-18",slot:1,title:"Проверка"})).id;
 await post({action:"lesson",journal_id:j,date:"2026-10-18",slot:1,title:"Дубликат"},400);
 let d=await get();const students=d.students.filter(s=>s.group_id===groupId);assert.equal(students.length,2);
 assert.equal(d.journals.find(x=>x.id===j2).group_id,groupId);
 await post({action:"mark",lesson_id:l,student_id:students[0].id,attendance:"absent",grade:4});
 await post({action:"complete",lesson_id:l});
 d=await get();assert.equal(d.marks.find(m=>m.lesson_id===l&&m.student_id===students[0].id).attendance,"absent");
 assert.equal(d.marks.find(m=>m.lesson_id===l&&m.student_id===students[0].id).grade,4);
 assert.equal(d.marks.find(m=>m.lesson_id===l&&m.student_id===students[1].id).attendance,"present");
 await post({action:"lesson-update",id:l,date:"2026-10-18",slot:1,title:"Практика",description:"Сохранённое описание",tags:["Дистант","Практика за ПК"]});
 d=await get();assert.deepEqual(d.lessons.find(x=>x.id===l).tags,["Дистант","Практика за ПК"]);
 await post({action:"student",id:students[0].id,name:"Тест Переименован",joined_on:"2026-09-01",left_on:"2026-10-19"});
 const future=(await post({action:"lesson",journal_id:j,date:"2026-10-20",slot:1,title:"После выбытия"})).id;
 await post({action:"mark",lesson_id:future,student_id:students[0].id,attendance:"absent",grade:null},400);
 d=await get();assert.equal(d.marks.find(m=>m.lesson_id===l&&m.student_id===students[0].id).grade,4);
 await post({action:"students",group_id:groupId,names:["Новый студент"],joined_on:"2026-10-19"});
 d=await get();assert.equal(d.students.filter(s=>s.group_id===groupId).length,3);
 await post({action:"mark",lesson_id:l,student_id:students[1].id,attendance:"present",grade:6},400);
 const cross=await fetch(base+"/api/journal",{method:"POST",headers:{"Content-Type":"application/json","Origin":"https://example.invalid"},body:JSON.stringify({action:"complete",lesson_id:l})});assert.equal(cross.status,403);
 await post({action:"delete-lesson",id:future});
 console.log("API OK: группы, общие списки, пары, дубликаты, Н + оценка, присутствие, теги, история, валидация, origin.");
} finally {
 if(groupId){
 await client.query("BEGIN");
 await client.query("DELETE FROM lessons WHERE journal_id IN (SELECT id FROM journals WHERE group_id=$1)",[groupId]);
 await client.query("DELETE FROM journals WHERE group_id=$1",[groupId]);
 await client.query("DELETE FROM students WHERE group_id=$1",[groupId]);
 await client.query("DELETE FROM groups WHERE id=$1",[groupId]);
 await client.query("COMMIT");
 }
 await client.end();
}
