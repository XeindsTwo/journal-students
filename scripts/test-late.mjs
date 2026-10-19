import assert from "node:assert/strict";
import pg from "pg";
import {dbConfig} from "../lib/db-config.mjs";
const client=new pg.Client(dbConfig());await client.connect();
let gid;
async function post(data){const r=await fetch("http://127.0.0.1:3000/api/journal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result;}
try {
 gid=(await post({action:"group",name:"QA-late-"+Date.now(),names:["Тест меню"],joined_on:"2026-09-01"})).id;
 const jid=(await post({action:"journal",group_id:gid,name:"Тест оценок",short_name:"Тест",period:"2026"})).id;
 const lid=(await post({action:"lesson",journal_id:jid,date:"2026-10-18",slot:1,title:"Тест"})).id;
 const {rows:[student]}=await client.query("SELECT id FROM students WHERE group_id=$1",[gid]);
 for(const grade of [5,4,3,2]){
 await post({action:"mark",lesson_id:lid,student_id:student.id,attendance:"late",grade});
 const {rows:[mark]}=await client.query("SELECT * FROM marks WHERE lesson_id=$1",[lid]);
 assert.equal(mark.attendance,"late");assert.equal(mark.grade,grade);
 }
 await post({action:"complete",lesson_id:lid});
 const {rows:[mark]}=await client.query("SELECT * FROM marks WHERE lesson_id=$1",[lid]);assert.equal(mark.attendance,"late");
 await post({action:"mark",lesson_id:lid,student_id:student.id,attendance:"unknown",grade:null});
 const state=await (await fetch("http://127.0.0.1:3000/api/journal")).json();
 assert.equal(state.marks.find(m=>m.lesson_id===lid).grade,null);
 assert.equal((await fetch("http://127.0.0.1:3000/journals/"+jid)).status,200);
 console.log("OK: оценки 2–5 + О, сохранение опоздания, очистка и отдельный URL журнала.");
}finally{
 if(gid){await client.query("BEGIN");await client.query("DELETE FROM lessons WHERE journal_id IN (SELECT id FROM journals WHERE group_id=$1)",[gid]);await client.query("DELETE FROM journals WHERE group_id=$1",[gid]);await client.query("DELETE FROM students WHERE group_id=$1",[gid]);await client.query("DELETE FROM groups WHERE id=$1",[gid]);await client.query("COMMIT");}
 await client.end();
}
