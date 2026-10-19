import test from 'node:test';
import assert from 'node:assert/strict';
import {MarkQueue} from '../lib/mark-queue.mjs';
import {applyMark} from '../lib/mark-operations.mjs';
const blank={lesson_id:1,student_id:2,grades:[],grade:null,attendance:'unknown'};
const grade=n=>({lesson_id:1,student_id:2,operation:'add-grade',grade:n});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(r=>setImmediate(r));
test('ячейка обновляется до ответа сервера, одинаковые оценки сохраняются в порядке ввода',async()=>{
 const response=deferred();let sent;const q=new MarkQueue(payload=>{sent=payload;return response.promise;},0);q.hydrate([blank]);q.enqueue(grade(5));q.enqueue(grade(5));q.enqueue(grade(3));
 assert.deepEqual(q.snapshot.marks[0].grades,[5,5,3]);assert.equal(q.snapshot.saving,true);
 const done=q.flush();assert.equal(sent.operations.length,3);response.resolve({marks:[sent.operations.reduce(applyMark,blank)]});await done;
 assert.deepEqual(q.snapshot.marks[0].grades,[5,5,3]);assert.equal(q.busy,false);
});
test('правки во время сохранения не теряются после подтверждения предыдущего пакета',async()=>{
 const a=deferred(),b=deferred();const sent=[];const q=new MarkQueue(p=>{sent.push(p);return sent.length===1?a.promise:b.promise;},0);q.hydrate([blank]);q.enqueue(grade(5));const done=q.flush();q.enqueue(grade(4));
 a.resolve({marks:[applyMark(blank,grade(5))]});await done;await settle();
 assert.deepEqual(q.snapshot.marks[0].grades,[5,4]);assert.equal(sent.length,2);
 b.resolve({marks:[{...blank,grades:[5,4],grade:4}]});await settle();assert.equal(q.busy,false);
});
test('сбой откатывает видимую ячейку, повтор отправляет тот же идентификатор без потери очереди',async()=>{
 const sent=[];let fail=true;const q=new MarkQueue(async p=>{sent.push(p);if(fail)throw Error('Нет сети');return {marks:p.operations.reduce((rows,o)=>[applyMark(rows[0],o)],[blank])};},0);q.hydrate([blank]);q.enqueue(grade(4));await q.flush();
 assert.deepEqual(q.snapshot.marks[0].grades,[]);assert.equal(q.snapshot.error,'Нет сети');assert.equal(q.busy,true);
 fail=false;q.retry();await settle();assert.equal(sent[0].request_id,sent[1].request_id);assert.deepEqual(q.snapshot.marks[0].grades,[4]);assert.equal(q.busy,false);
});
test('обновление данных не затирает ожидающие отметки и сохраняет ссылки соседних ячеек',async()=>{
 const response=deferred();const neighbor={...blank,student_id:3};const q=new MarkQueue(()=>response.promise,0);q.hydrate([blank,neighbor]);q.enqueue(grade(2));q.hydrate([]);
 assert.equal(q.snapshot.marks[1],neighbor);assert.deepEqual(q.snapshot.marks[0].grades,[2]);const done=q.flush();response.resolve({marks:[applyMark(blank,grade(2))]});await done;assert.equal(q.snapshot.marks[1],neighbor);
});
test('Н и О переключаются независимо от оценок и сохраняют порядок операций',()=>{
 const n={operation:'toggle-attendance',attendance:'absent'};let m=applyMark(blank,n);m=applyMark(m,grade(5));m=applyMark(m,n);assert.equal(m.attendance,'unknown');assert.deepEqual(m.grades,[5]);
});
