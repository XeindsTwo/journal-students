import test from "node:test";
import assert from "node:assert/strict";
import {journalKeyAction} from "../lib/journal-keyboard.mjs";
test("оценки вводятся обычными цифрами без перехвата сочетаний браузера",()=>{
 assert.deepEqual(journalKeyAction({key:"5"}),{kind:"grade",grade:5});
 for(const event of [{key:"5",ctrlKey:true},{key:"4",altKey:true},{key:"3",metaKey:true},{key:"2",shiftKey:true},{key:"5",repeat:true},{key:"5",isComposing:true}])assert.equal(journalKeyAction(event),null);
 assert.equal(journalKeyAction({key:"1"}),null);
});
test("Н и О доступны в русской и английской раскладках",()=>{
 for(const key of ["н","Н","n","N"])assert.deepEqual(journalKeyAction({key}),{kind:"attendance",attendance:"absent"});
 for(const key of ["о","О","o","O"])assert.deepEqual(journalKeyAction({key}),{kind:"attendance",attendance:"late"});
});
test("Enter и стрелки перемещают выбор, Shift+Enter идёт назад",()=>{
 assert.deepEqual(journalKeyAction({key:"Enter"}),{kind:"move",row:1,column:0});
 assert.deepEqual(journalKeyAction({key:"Enter",shiftKey:true}),{kind:"move",row:-1,column:0});
 assert.deepEqual(journalKeyAction({key:"ArrowLeft"}),{kind:"move",row:0,column:-1});
 assert.deepEqual(journalKeyAction({key:"ArrowDown",repeat:true}),{kind:"move",row:1,column:0});
 assert.equal(journalKeyAction({key:"Tab"}),null);
 assert.equal(journalKeyAction({key:"F10",shiftKey:true}),null);
});
