'use strict';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VirtualMemoryArray } from './modules/VirtualMemoryArray.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

function unlinkSafe(f) {
  try { fs.unlinkSync(f); } catch (_) {}
}
function unlinkSafeData(f) {
  unlinkSafe(f);
  unlinkSafe(f + '.data');
}

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { console.log('  OK:', name); passed++; return; }
  console.log('  FAIL:', name);
  failed++;
}

function throwsOk(name, fn, messageContains) {
  try {
    fn();
    console.log('  FAIL:', name, '(ожидалось исключение)');
    failed++;
  } catch (e) {
    const match = !messageContains || (e.message && e.message.includes(messageContains));
    if (match) { console.log('  OK:', name); passed++; }
    else { console.log('  FAIL:', name, e.message); failed++; }
  }
}

console.log('\n--- Конструктор');
const intFile = path.join(TMP, 'vma-int.bin');
unlinkSafe(intFile);
const arrInt = new VirtualMemoryArray(intFile, 15000, 'int');
ok('constructor int: создаётся без strLength', arrInt.size === 15000 && arrInt.type === 'int');
arrInt.close();

throwsOk('constructor char без strLength бросает', () => {
  new VirtualMemoryArray(path.join(TMP, 'x.bin'), 10, 'char', 0);
}, 'strLength');
unlinkSafe(path.join(TMP, 'x.bin'));

throwsOk('constructor varchar strLength <= 0 бросает', () => {
  new VirtualMemoryArray(path.join(TMP, 'y.bin'), 10, 'varchar', 0);
}, 'strLength');
unlinkSafe(path.join(TMP, 'y.bin'));

console.log('\n--- int: set, get, _readElementFromPage, _writeElementToPage');
const arrInt2 = new VirtualMemoryArray(intFile, 15000, 'int');
arrInt2.set(0, 42);
arrInt2.set(100, 100);
arrInt2.set(14999, -1);
ok('int set/get(0) === 42', arrInt2.get(0) === 42);
ok('int set/get(100) === 100', arrInt2.get(100) === 100);
ok('int set/get(14999) === -1', arrInt2.get(14999) === -1);
ok('int get(1) === null (пусто)', arrInt2.get(1) === null);
arrInt2.close();

console.log('\n--- getAt, setAt');
unlinkSafe(path.join(TMP, 'vma-at.bin'));
const arrAt = new VirtualMemoryArray(path.join(TMP, 'vma-at.bin'), 100, 'int');
arrAt.setAt(5, 555);
ok('setAt(5, 555); getAt(5) === 555', arrAt.getAt(5) === 555);
ok('getAt(5) === get(5)', arrAt.get(5) === 555);
arrAt.close();

console.log('\n--- get/set Out of range');
unlinkSafe(path.join(TMP, 'vma-bounds.bin'));
const arrBounds = new VirtualMemoryArray(path.join(TMP, 'vma-bounds.bin'), 10, 'int');
throwsOk('get(-1) бросает Out of range', () => arrBounds.get(-1), 'Out of range');
throwsOk('get(10) бросает Out of range', () => arrBounds.get(10), 'Out of range');
throwsOk('set(-1, 1) бросает', () => arrBounds.set(-1, 1), 'Out of range');
throwsOk('set(10, 1) бросает', () => arrBounds.set(10, 1), 'Out of range');
arrBounds.close();

// ========== getPageBufferIndex ==========
console.log('\n--- getPageBufferIndex');
unlinkSafe(path.join(TMP, 'vma-buf.bin'));
const arrBuf = new VirtualMemoryArray(path.join(TMP, 'vma-buf.bin'), 20000, 'int');
const idx0 = arrBuf.getPageBufferIndex(0);
ok('getPageBufferIndex(0) число', idx0 !== null && typeof idx0 === 'number');
ok('getPageBufferIndex(-1) === null', arrBuf.getPageBufferIndex(-1) === null);
ok('getPageBufferIndex(20000) === null', arrBuf.getPageBufferIndex(20000) === null);
ok('getPageBufferIndex(19999) число', arrBuf.getPageBufferIndex(19999) !== null);
// Вызов get/set использует getPageBufferIndex и _offsetInPage
arrBuf.set(0, 1);
arrBuf.set(128, 2);
arrBuf.set(256, 3);
ok('несколько страниц get', arrBuf.get(0) === 1 && arrBuf.get(128) === 2 && arrBuf.get(256) === 3);
arrBuf.close();

console.log('\n--- _flushPage, _loadPage, _readHeader (reopen)');
const arrInt3 = new VirtualMemoryArray(intFile, 15000, 'int');
ok('reopen int get(0) === 42', arrInt3.get(0) === 42);
ok('reopen int get(14999) === -1', arrInt3.get(14999) === -1);
arrInt3.close();

console.log('\n--- _readHeader неверная сигнатура');
const badFile = path.join(TMP, 'vma-bad.bin');
unlinkSafe(badFile);
fs.writeFileSync(badFile, Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
throwsOk('открытие файла с неверной сигнатурой бросает', () => {
  new VirtualMemoryArray(badFile, 10, 'int');
}, 'Неверная сигнатура');
unlinkSafe(badFile);

// ========== char ==========
console.log('\n--- char: _computeLayout, _readElementFromPage, _writeElementToPage');
const charFile = path.join(TMP, 'vma-char.bin');
unlinkSafe(charFile);
const arrChar = new VirtualMemoryArray(charFile, 15000, 'char', 10);
arrChar.set(0, 'hello');
arrChar.set(1, 'world!!!!!');
ok('char get(0) === "hello"', arrChar.get(0) === 'hello');
ok('char get(1) обрезано до 10', arrChar.get(1) === 'world!!!!!');
ok('char get(2) === null', arrChar.get(2) === null);
arrChar.close();

console.log('\n--- varchar, _openOrCreateFiles .data');
const varFile = path.join(TMP, 'vma-var.bin');
unlinkSafeData(varFile);
const arrVar = new VirtualMemoryArray(varFile, 15000, 'varchar', 256);
arrVar.set(0, 'короткая');
arrVar.set(1, 'Длинная строка с разным размером');
ok('varchar get(0)', arrVar.get(0) === 'короткая');
ok('varchar get(1)', arrVar.get(1) === 'Длинная строка с разным размером');
ok('varchar get(2) === null', arrVar.get(2) === null);
arrVar.close();

console.log('\n--- close');
unlinkSafe(path.join(TMP, 'vma-close.bin'));
const arrClose = new VirtualMemoryArray(path.join(TMP, 'vma-close.bin'), 5, 'int');
arrClose.set(0, 99);
arrClose.close();
ok('close() закрывает', arrClose.fd === null);
arrClose.close();
ok('close() повторный не падает', true);

console.log('\n--- _loadInitialPages (косвенно)');
unlinkSafe(path.join(TMP, 'vma-init.bin'));
const arrInit = new VirtualMemoryArray(path.join(TMP, 'vma-init.bin'), 500, 'int');
arrInit.set(0, 11);
arrInit.set(1, 22);
ok('после конструктора get(0), get(1)', arrInit.get(0) === 11 && arrInit.get(1) === 22);
arrInit.close();

console.log('\n--- LRU вытеснение и сброс изменённой страницы');
unlinkSafe(path.join(TMP, 'vma-lru.bin'));
const arrLru = new VirtualMemoryArray(path.join(TMP, 'vma-lru.bin'), 500, 'int');
arrLru.set(0, 100);
arrLru.set(128, 200);
arrLru.set(256, 300);
arrLru.set(384, 400);
arrLru.close();
const arrLru2 = new VirtualMemoryArray(path.join(TMP, 'vma-lru.bin'), 500, 'int');
ok('LRU: после вытеснения данные на диске get(0)', arrLru2.get(0) === 100);
ok('LRU: get(128)', arrLru2.get(128) === 200);
ok('LRU: get(256)', arrLru2.get(256) === 300);
ok('LRU: get(384)', arrLru2.get(384) === 400);
arrLru2.close();

console.log('\n--- reopen char и varchar');
const arrChar2 = new VirtualMemoryArray(charFile, 15000, 'char', 10);
ok('reopen char get(0)', arrChar2.get(0) === 'hello');
arrChar2.close();
const arrVar2 = new VirtualMemoryArray(varFile, 15000, 'varchar', 256);
ok('reopen varchar get(0)', arrVar2.get(0) === 'короткая');
arrVar2.close();

console.log('\nИтого:', passed, 'пройдено,', failed, 'провалено');
process.exit(failed > 0 ? 1 : 0);
