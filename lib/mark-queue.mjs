import {applyMark} from './mark-operations.mjs';
export class MarkQueue {
 constructor(send,delay=90){this.send=send;this.delay=delay;this.revision=0;this.confirmed=[];this.pending=[];this.batch=null;this.timer=null;this.listeners=new Set();this.snapshot={marks:[],saving:false,error:''};}
 subscribe=(listener)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 getSnapshot=()=>this.snapshot;
 get busy(){return this.pending.length>0||!!this.batch;}
 publish(error=''){
 const map=new Map(this.confirmed.map(m=>[m.lesson_id+':'+m.student_id,m]));
 if(!error)for(const edit of this.pending){const key=edit.lesson_id+':'+edit.student_id;const mark=map.get(key)??{lesson_id:edit.lesson_id,student_id:edit.student_id,attendance:'unknown',grades:[],grade:null};map.set(key,applyMark(mark,edit));}
 // Keep unchanged object identities so unrelated cells can skip rendering.
 const previous=new Map(this.snapshot.marks.map(m=>[m.lesson_id+':'+m.student_id,m]));
 const marks=[...map].map(([key,mark])=>{const old=previous.get(key);return old&&old.attendance===mark.attendance&&old.grades.length===mark.grades.length&&old.grades.every((g,i)=>g===mark.grades[i])?old:mark;});
 this.snapshot={marks,saving:this.busy&&!error,error};for(const listener of this.listeners)listener();
 }
 hydrate(marks){if(this.busy||this.snapshot.error)return;this.confirmed=marks;this.publish();}
 merge(marks){this.revision++;const map=new Map(this.confirmed.map(m=>[m.lesson_id+':'+m.student_id,m]));for(const m of marks)map.set(m.lesson_id+':'+m.student_id,m);this.confirmed=[...map.values()];this.publish(this.snapshot.error);}
 enqueue(edit){if(this.snapshot.error)return;const current=this.snapshot.marks.find(m=>m.lesson_id===edit.lesson_id&&m.student_id===edit.student_id)??{lesson_id:edit.lesson_id,student_id:edit.student_id,attendance:'unknown',grade:null,grades:[]};try{applyMark(current,edit);}catch(e){return e.message;}this.revision++;this.pending.push(edit);this.publish();if(!this.batch&&!this.timer)this.timer=setTimeout(()=>{this.timer=null;void this.flush();},this.delay);}
 async flush(){
 if(this.snapshot.error)return;
 if(!this.batch&&this.pending.length)this.batch={action:'mark-operations',request_id:crypto.randomUUID(),operations:this.pending.slice(0,1000)};
 if(!this.batch||this.running)return;this.running=true;const batch=this.batch;
 try{const result=await this.send(batch);this.pending.splice(0,batch.operations.length);this.batch=null;this.merge(result.marks);}
 catch(e){this.publish(e instanceof Error?e.message:'Не удалось сохранить отметки');}
 finally{this.running=false;}
 if(this.pending.length&&!this.snapshot.error)void this.flush();
 }
 async drain(){
 if(this.timer){clearTimeout(this.timer);this.timer=null;}
 void this.flush();
 if(this.snapshot.error)throw Error(this.snapshot.error);
 if(!this.busy)return;
 await new Promise((resolve,reject)=>{const stop=this.subscribe(()=>{if(this.snapshot.error){stop();reject(Error(this.snapshot.error));}else if(!this.busy){stop();resolve();}});});
 }
 retry=()=>{if(!this.snapshot.error)return;this.publish();void this.flush();};
}
