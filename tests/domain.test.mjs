import test from "node:test";
import assert from "node:assert/strict";
import {activeOn,studentNames,csvCell} from "../lib/domain.mjs";
test("состав группы определяется датой пары, выбытие не удаляет историю",()=>{
 const student={joined_on:"2026-09-01",left_on:"2026-10-18"};
 assert.equal(activeOn(student,"2026-08-31"),false);
 assert.equal(activeOn(student,"2026-09-01"),true);
 assert.equal(activeOn(student,"2026-10-17"),true);
 assert.equal(activeOn(student,"2026-10-18"),false);
});
test("вставка ФИО обрабатывает переносы Windows и пустые строки",()=>{
 assert.deepEqual(studentNames(" Иванов Иван\r\n\r\n Петрова Анна \n"),["Иванов Иван","Петрова Анна"]);
});
test("CSV сохраняет кавычки, разделители и переносы",()=>{
 assert.equal(csvCell('Тема; "пример"\nдальше'),'"Тема; ""пример""\nдальше"');
});
