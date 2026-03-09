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

// --- int
const intFile = path.join(TMP, 'vma-int.bin');
unlinkSafe(intFile);
const arrInt = new VirtualMemoryArray(intFile, 15000, 'int');
arrInt.set(0, 42);
arrInt.set(100, 100);
arrInt.set(14999, -1);
ok('int get(0) === 42', arrInt.get(0) === 42);
ok('int get(100) === 100', arrInt.get(100) === 100);
ok('int get(14999) === -1', arrInt.get(14999) === -1);
ok('int get(1) === null (пусто)', arrInt.get(1) === null);
arrInt.close();

// --- char (фиксированная строка)
const charFile = path.join(TMP, 'vma-char.bin');
unlinkSafe(charFile);
const arrChar = new VirtualMemoryArray(charFile, 15000, 'char', 10);
arrChar.set(0, 'hello');
arrChar.set(1, 'world!!!!!');
ok('char get(0) === "hello"', arrChar.get(0) === 'hello');
ok('char get(1) обрезано до 10', arrChar.get(1) === 'world!!!!!');
ok('char get(2) === null', arrChar.get(2) === null);
arrChar.close();

// --- varchar (два файла)
const varFile = path.join(TMP, 'vma-var.bin');
unlinkSafeData(varFile);
const arrVar = new VirtualMemoryArray(varFile, 15000, 'varchar', 256);
arrVar.set(0, 'короткая');
arrVar.set(1, 'Длинная строка с разным размером');
ok('varchar get(0)', arrVar.get(0) === 'короткая');
ok('varchar get(1)', arrVar.get(1) === 'Длинная строка с разным размером');
ok('varchar get(2) === null', arrVar.get(2) === null);
arrVar.close();

// --- открытие существующего файла (int)
const arrInt2 = new VirtualMemoryArray(intFile, 15000, 'int');
ok('reopen int get(0) === 42', arrInt2.get(0) === 42);
ok('reopen int get(14999) === -1', arrInt2.get(14999) === -1);
arrInt2.close();

// --- getPageBufferIndex возвращает число
const arrInt3 = new VirtualMemoryArray(path.join(TMP, 'vma-buf.bin'), 20000, 'int');
unlinkSafe(path.join(TMP, 'vma-buf.bin'));
const idx = arrInt3.getPageBufferIndex(0);
ok('getPageBufferIndex(0) !== null', idx !== null && typeof idx === 'number');
arrInt3.close();

console.log('\nИтого:', passed, 'пройдено,', failed, 'провалено');
process.exit(failed > 0 ? 1 : 0);
