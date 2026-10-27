import {authGuard} from "@/lib/auth";
import {createHash} from "node:crypto";
import {applyMark} from "@/lib/mark-operations.mjs";
import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {db} from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.number().int().positive();
const name = z.string().trim().min(1).max(200);
const date = z.iso.date();
const editSchema=z.object({lesson_id:id,student_id:id,operation:z.enum(["add-grade","remove-grade","attendance","toggle-attendance","clear-grades","clear"]),grade:z.number().int().min(2).max(5).optional(),index:z.number().int().min(0).max(99).optional(),attendance:z.enum(["unknown","absent","late"]).optional()});
const schema = z.discriminatedUnion("action", [
 z.object({action:z.literal("mark-operations"),request_id:z.uuid(),operations:z.array(editSchema).min(1).max(1000)}),
 z.object({action:z.literal("group"),name,names:z.array(name).max(100),joined_on:date}),
 z.object({action:z.literal("students"),group_id:id,names:z.array(name).min(1).max(100),joined_on:date}),
 z.object({action:z.literal("student"),id,name,joined_on:date,left_on:date.nullable()}),
 z.object({action:z.literal("journal"),group_id:id,name,short_name:name,period:name}),
 z.object({action:z.literal("lesson"),journal_id:id,date,slot:z.number().int().min(1).max(12).nullable().optional(),kind:z.enum(["lesson","test"]).default("lesson"),title:z.string().max(300)}),
 z.object({action:z.literal("lesson-update"),id,date,slot:z.number().int().min(1).max(12).nullable(),title:z.string().max(300),description:z.string().max(20000),tags:z.array(z.string().trim().min(1).max(50)).max(20)}),
 z.object({action:z.literal("mark"),lesson_id:id,student_id:id,attendance:z.enum(["unknown","present","absent","late"]),grade:z.number().int().min(2).max(5).nullable()}),
 z.object({action:z.literal("mark-edit"),lesson_id:id,student_id:id,operation:z.enum(["add-grade","remove-grade","attendance","toggle-attendance","clear-grades","clear"]),grade:z.number().int().min(2).max(5).optional(),index:z.number().int().min(0).max(99).optional(),attendance:z.enum(["unknown","absent","late"]).optional()}),
 z.object({action:z.literal("mark-batch"),lesson_id:id,rows:z.array(z.object({student_id:id,attendance:z.enum(["unknown","absent","late"]).optional(),grade:z.number().int().min(2).max(5).optional()})).min(1).max(500)}),
 z.object({action:z.literal("complete"),lesson_id:id}),
 z.object({action:z.literal("delete-lesson"),id})
]);
export async function GET() {
 const denied=await authGuard();if(denied)return denied;
 try {
 const [groups,students,journals,lessons,marks] = await Promise.all([
 db.query("SELECT * FROM groups ORDER BY name"),
 db.query("SELECT *, to_char(joined_on,'YYYY-MM-DD') AS joined_on, to_char(left_on,'YYYY-MM-DD') AS left_on FROM students ORDER BY name"),
 db.query("SELECT * FROM journals ORDER BY id"),
 db.query("SELECT *, to_char(date,'YYYY-MM-DD') AS date FROM lessons ORDER BY lessons.date,slot NULLS LAST,id"),
 db.query("SELECT m.*,l.kind FROM marks m JOIN lessons l ON l.id=m.lesson_id")
 ]);
 return NextResponse.json({groups:groups.rows,students:students.rows,journals:journals.rows,lessons:lessons.rows,marks:marks.rows},{headers:{"Cache-Control":"private, no-store"}});
 } catch(e) {console.error("Journal database error", (e as Error).message); return NextResponse.json({error:"База недоступна. Запустите PostgreSQL через start.ps1."},{status:503});}
}
export async function POST(req:NextRequest) {
 const denied=await authGuard();if(denied)return denied;
 // Every journal request requires the owner session; reject cross-origin writes too.
 const origin=req.headers.get("origin");
 if(origin && origin!==req.nextUrl.origin && origin!==`http://${req.headers.get("host")}`) return NextResponse.json({error:"Запрос с другого сайта запрещён"},{status:403});
 let raw;
 try {raw=await req.json();} catch {return NextResponse.json({error:"Некорректный JSON"},{status:400});}
 const parsed=schema.safeParse(raw);
 if(!parsed.success) return NextResponse.json({error:"Проверьте заполненные поля и даты"},{status:400});
 const p=parsed.data;
 let client; try {client=await db.connect();} catch {return NextResponse.json({error:"База недоступна. Запустите PostgreSQL через start.ps1."},{status:503});}
 try {
 await client.query("BEGIN");
 let result;
 switch(p.action) {
 case "mark-operations": {
 const digest=createHash("sha256").update(JSON.stringify(p.operations)).digest("hex");
 await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[p.request_id]);
 const receipt=(await client.query("SELECT digest,response FROM mutation_receipts WHERE request_id=$1",[p.request_id])).rows[0];
 if(receipt){if(receipt.digest!==digest)throw Error("Идентификатор запроса уже использован для других изменений");result=receipt.response;break;}
 const keys=[...new Map(p.operations.map(o=>[o.lesson_id+":"+o.student_id,o])).values()].sort((a,b)=>a.lesson_id-b.lesson_id||a.student_id-b.student_id);
 const changed=new Map<string,any>();
 for(const key of keys){
 const valid=await client.query("SELECT 1 FROM students s JOIN journals j ON s.group_id=j.group_id JOIN lessons l ON l.journal_id=j.id WHERE s.id=$1 AND l.id=$2 AND s.joined_on<=l.date AND (s.left_on IS NULL OR s.left_on>l.date)",[key.student_id,key.lesson_id]);
 if(!valid.rowCount)throw Error("Студент не входит в состав группы на дату пары");
 await client.query("INSERT INTO marks(lesson_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[key.lesson_id,key.student_id]);
 const row=(await client.query("SELECT m.*,l.kind FROM marks m JOIN lessons l ON l.id=m.lesson_id WHERE m.lesson_id=$1 AND m.student_id=$2 FOR UPDATE OF m",[key.lesson_id,key.student_id])).rows[0];
 changed.set(key.lesson_id+":"+key.student_id,row);
 }
 for(const operation of p.operations){const key=operation.lesson_id+":"+operation.student_id;changed.set(key,applyMark(changed.get(key),operation));}
 for(const mark of changed.values())await client.query("UPDATE marks SET grades=$3,grade=$4,attendance=$5 WHERE lesson_id=$1 AND student_id=$2",[mark.lesson_id,mark.student_id,mark.grades,mark.grade,mark.attendance]);
 result={marks:[...changed.values()]};
 await client.query("INSERT INTO mutation_receipts(request_id,digest,response) VALUES($1,$2,$3)",[p.request_id,digest,JSON.stringify(result)]);
 break;
 }
 case "group": {
 const g=await client.query("INSERT INTO groups(name) VALUES($1) RETURNING id",[p.name]); result=g.rows[0];
 for(const n of p.names) await client.query("INSERT INTO students(group_id,name,joined_on) VALUES($1,$2,$3)",[result.id,n,p.joined_on]);
 break;
 }
 case "students":
 for(const n of p.names) await client.query("INSERT INTO students(group_id,name,joined_on) VALUES($1,$2,$3)",[p.group_id,n,p.joined_on]);
 break;
 case "student":
 if(p.left_on && p.left_on<p.joined_on) throw new Error("Дата выбытия раньше даты зачисления");
 await client.query("UPDATE students SET name=$2,joined_on=$3,left_on=$4 WHERE id=$1",[p.id,p.name,p.joined_on,p.left_on]);break;
 case "journal":
 result=(await client.query("INSERT INTO journals(group_id,name,short_name,period) VALUES($1,$2,$3,$4) RETURNING id",[p.group_id,p.name,p.short_name,p.period])).rows[0];break;
 case "lesson": {
 if(p.kind==="test"&&(!p.title.trim()||p.slot!=null))throw Error("У теста должны быть название и дата, без номера пары");
 if(p.kind==="lesson"&&p.slot==null)throw Error("Выберите номер пары");
 result=(await client.query("INSERT INTO lessons(journal_id,date,slot,title,kind) VALUES($1,$2,$3,$4,$5) RETURNING id",[p.journal_id,p.date,p.slot??null,p.title.trim(),p.kind])).rows[0];break;
 }
 case "lesson-update": {
 const record=(await client.query("SELECT kind FROM lessons WHERE id=$1 FOR UPDATE",[p.id])).rows[0];if(!record)throw Error("Запись не найдена");
 if(record.kind==="test"&&(!p.title.trim()||p.slot!==null))throw Error("У теста должны быть название и дата, без номера пары");if(record.kind==="lesson"&&p.slot===null)throw Error("Выберите номер пары");
 await client.query("UPDATE lessons SET date=$2,slot=$3,title=$4,description=$5,tags=$6 WHERE id=$1",[p.id,p.date,p.slot,p.title.trim(),p.description,[...new Set(p.tags)]]);break;
 }
 case "mark": {
 const valid=await client.query("SELECT 1 FROM students s JOIN journals j ON s.group_id=j.group_id JOIN lessons l ON l.journal_id=j.id WHERE s.id=$1 AND l.id=$2 AND s.joined_on<=l.date AND (s.left_on IS NULL OR s.left_on>l.date)",[p.student_id,p.lesson_id]);
 if(!valid.rowCount) throw new Error("Студент не входит в состав группы на дату пары");
 await client.query("INSERT INTO marks(lesson_id,student_id,attendance,grade,grades) VALUES($1,$2,$3,$4,CASE WHEN $4::int IS NULL THEN '{}'::int[] ELSE ARRAY[$4::int] END) ON CONFLICT(lesson_id,student_id) DO UPDATE SET attendance=$3,grade=$4,grades=EXCLUDED.grades",[p.lesson_id,p.student_id,p.attendance,p.grade]);break;
 }

 case "mark-edit": {
 const valid=await client.query("SELECT 1 FROM students s JOIN journals j ON s.group_id=j.group_id JOIN lessons l ON l.journal_id=j.id WHERE s.id=$1 AND l.id=$2 AND s.joined_on<=l.date AND (s.left_on IS NULL OR s.left_on>l.date)",[p.student_id,p.lesson_id]);
 if(!valid.rowCount)throw new Error("Студент не входит в состав группы на дату пары");
 await client.query("INSERT INTO marks(lesson_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[p.lesson_id,p.student_id]);
 const row=(await client.query("SELECT m.*,l.kind FROM marks m JOIN lessons l ON l.id=m.lesson_id WHERE m.lesson_id=$1 AND m.student_id=$2 FOR UPDATE OF m",[p.lesson_id,p.student_id])).rows[0];
 const updated=applyMark(row,p);
 await client.query("UPDATE marks SET grades=$3,grade=$4,attendance=$5 WHERE lesson_id=$1 AND student_id=$2",[p.lesson_id,p.student_id,updated.grades,updated.grade,updated.attendance]);
 break;
 }

 case "mark-batch": {
 const kind=(await client.query("SELECT kind FROM lessons WHERE id=$1",[p.lesson_id])).rows[0]?.kind;
 const ids=p.rows.map(row=>row.student_id);
 if(new Set(ids).size!==ids.length)throw new Error("Студент повторяется в списке");
 if(p.rows.some(row=>row.attendance===undefined&&row.grade===undefined))throw new Error("Есть пустая строка изменений");
 const valid=await client.query("SELECT s.id FROM students s JOIN journals j ON s.group_id=j.group_id JOIN lessons l ON l.journal_id=j.id WHERE s.id=ANY($1::int[]) AND l.id=$2 AND s.joined_on<=l.date AND (s.left_on IS NULL OR s.left_on>l.date)",[ids,p.lesson_id]);
 if(valid.rowCount!==ids.length)throw new Error("Состав группы изменился. Обновите список студентов");
 for(const row of [...p.rows].sort((a,b)=>a.student_id-b.student_id)){
 await client.query("INSERT INTO marks(lesson_id,student_id,attendance,grade,grades) VALUES($1,$2,COALESCE($3::text,'unknown'),$4::int,CASE WHEN $4::int IS NULL THEN '{}'::int[] ELSE ARRAY[$4::int] END) ON CONFLICT(lesson_id,student_id) DO UPDATE SET attendance=COALESCE($3::text,marks.attendance),grade=COALESCE($4::int,marks.grade),grades=CASE WHEN $4::int IS NULL THEN marks.grades ELSE CASE WHEN $5::boolean THEN ARRAY[$4::int] ELSE array_append(marks.grades,$4::int) END END",[p.lesson_id,row.student_id,row.attendance??null,row.grade??null,kind==="test"]);
 }
 result={updated:p.rows.length};
 break;
 }
 case "complete":
 if((await client.query("SELECT kind FROM lessons WHERE id=$1",[p.lesson_id])).rows[0]?.kind==="test")throw Error("Для теста нет отметки присутствия");
 await client.query("INSERT INTO marks(lesson_id,student_id,attendance) SELECT l.id,s.id,'present' FROM lessons l JOIN journals j ON j.id=l.journal_id JOIN students s ON s.group_id=j.group_id WHERE l.id=$1 AND s.joined_on<=l.date AND (s.left_on IS NULL OR s.left_on>l.date) ON CONFLICT(lesson_id,student_id) DO UPDATE SET attendance=CASE WHEN marks.attendance='unknown' THEN 'present' ELSE marks.attendance END",[p.lesson_id]);
 await client.query("UPDATE lessons SET attendance_checked=true WHERE id=$1",[p.lesson_id]);break;
 case "delete-lesson": await client.query("DELETE FROM lessons WHERE id=$1",[p.id]);break;
 }
 await client.query("COMMIT"); return NextResponse.json({ok:true,...result});
 } catch(e) {
 await client.query("ROLLBACK");
 const error=e as Error & {code?:string};
 const message=error.code==="23505"?"Пара с этой датой и номером уже существует":error.code==="23514"?"Проверьте даты и значения полей":error.code?"Не удалось сохранить запись":error.message;
 return NextResponse.json({error:message},{status:400});
 } finally {client.release();}
}




