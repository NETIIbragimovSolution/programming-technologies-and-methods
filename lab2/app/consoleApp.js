'use strict';

import path from 'path';
import { fileURLToPath } from 'url';
import { VirtualMemoryArray } from '../modules/VirtualMemoryArray.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TMP = path.join(__dirname, '..', 'tmp');
const intPath = path.join(TMP, 'demo-int.bin');
const charPath = path.join(TMP, 'demo-char.bin');
const varPath = path.join(TMP, 'demo-var.bin');

console.log('Лабораторная работа 2: виртуальная память (буфер страниц >= 3)\n');

// 1) Массив целых
console.log('1. Массив int (размер 12000):');
const arrInt = new VirtualMemoryArray(intPath, 12000, 'int');
arrInt.set(0, 100);
arrInt.set(1000, 200);
arrInt.set(11999, 300);
console.log('   set(0, 100), set(1000, 200), set(11999, 300)');
console.log('   get(0) =', arrInt.get(0), ', get(1000) =', arrInt.get(1000), ', get(11999) =', arrInt.get(11999));
arrInt.close();
console.log('   Файл создан:', intPath);

// 2) Массив строк фиксированной длины (char)
console.log('\n2. Массив char (размер 12000, длина строки 8):');
const arrChar = new VirtualMemoryArray(charPath, 12000, 'char', 8);
arrChar.set(0, 'hello');
arrChar.set(1, 'world');
console.log('   set(0, "hello"), set(1, "world")');
console.log('   get(0) =', JSON.stringify(arrChar.get(0)), ', get(1) =', JSON.stringify(arrChar.get(1)));
arrChar.close();
console.log('   Файл создан:', charPath);

// 3) Массив строк переменной длины (varchar)
console.log('\n3. Массив varchar (размер 12000, макс. длина 64):');
const arrVar = new VirtualMemoryArray(varPath, 12000, 'varchar', 64);
arrVar.set(0, 'строка');
arrVar.set(1, 'Другая строка произвольной длины');
console.log('   set(0, "строка"), set(1, "Другая строка...")');
console.log('   get(0) =', JSON.stringify(arrVar.get(0)), ', get(1) =', JSON.stringify(arrVar.get(1)));
arrVar.close();
console.log('   Файлы созданы:', varPath, 'и', varPath + '.data');

console.log('\nГотово. Запуск тестов: npm test');
