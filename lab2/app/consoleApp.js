'use strict';

import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { VirtualMemoryArray } from '../modules/VirtualMemoryArray.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT = 'VM> ';

let currentVma = null;

function parseType(s) {
  const t = s.trim().toLowerCase();
  if (t === 'int') return { type: 'int' };

  const charMatch = t.match(/^char\s*\(\s*(\d+)\s*\)$/);
  if (charMatch) return { type: 'char', strLength: parseInt(charMatch[1], 10) };
  const charShort = t.match(/^char\s+(\d+)$/);
  if (charShort) return { type: 'char', strLength: parseInt(charShort[1], 10) };

  const varcharMatch = t.match(/^varchar\s*\(\s*(\d+)\s*\)$/);
  if (varcharMatch) return { type: 'varchar', strLength: parseInt(varcharMatch[1], 10) };
  const varcharShort = t.match(/^varchar\s+(\d+)$/);
  if (varcharShort) return { type: 'varchar', strLength: parseInt(varcharShort[1], 10) };

  return null;
}

function parseInputValue(s) {
  const t = s.trim();
  if (t.length >= 2 && (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  const n = Number(t);
  if (Number.isInteger(n)) return n;
  return t;
}

function getHelpText() {
  return [
    'Create имя_файла размер тип — создать виртуальный массив и файлы на диске.',
    '  тип: int | char(длина) | varchar(макс_длина)',
    '  размер: целое число (>10000 по методичке), например 12000',
    '  Пример: Create tmp/arr.bin 12000 int',
    'Open имя_файла тип — открыть существующий файл (rw), загрузить страницы.',
    '  Пример: Open tmp/arr.bin int',
    'Input индекс значение — записать значение в элемент. Строка в кавычках.',
    '  Пример: Input 0 42   или   Input 1 "строка"',
    'Print индекс — вывести значение элемента.',
    'Help [имя_файла] — вывести этот список команд (или в файл).',
    'Exit — закрыть файлы и завершить программу.',
  ].join('\n');
}

function printError(msg) {
  console.error(msg);
}

function runCreate(args) {
  if (args.length < 3) {
    printError('Ошибка: Create имя_файла размер тип');
    return;
  }
  const filename = args[0].trim();
  const size = parseInt(args[1], 10);
  if (!Number.isInteger(size) || size <= 0) {
    printError('Ошибка: размер должен быть положительным целым числом.');
    return;
  }
  const typeStr = args.slice(2).join(' ');
  const typeSpec = parseType(typeStr);
  if (!typeSpec) {
    printError('Ошибка: тип должен быть int, char(N) или varchar(N).');
    return;
  }

  if (currentVma) {
    currentVma.close();
    currentVma = null;
  }

  try {
    const dir = path.dirname(filename);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const opts = typeSpec.strLength != null
      ? [filename, size, typeSpec.type, typeSpec.strLength]
      : [filename, size, typeSpec.type];
    currentVma = new VirtualMemoryArray(...opts);
    console.log('Создан виртуальный массив:', filename, 'размер', currentVma.size, 'тип', typeSpec.type);
  } catch (e) {
    if (e.code === 'ENOSPC') {
      printError('Ошибка: недостаточно места на диске.');
    } else if (e.message && e.message.includes('память')) {
      printError('Ошибка: недостаточно оперативной памяти для размещения объекта.');
    } else {
      printError('Ошибка файловой операции:', e.message);
    }
  }
}

function runOpen(args) {
  if (args.length < 2) {
    printError('Ошибка: Open имя_файла тип');
    return;
  }
  const filename = args[0].trim();
  const typeStr = args.slice(1).join(' ');
  const typeSpec = parseType(typeStr);
  if (!typeSpec) {
    printError('Ошибка: тип должен быть int, char(N) или varchar(N).');
    return;
  }

  if (!fs.existsSync(filename)) {
    printError('Ошибка: файл не найден: ' + filename);
    return;
  }

  if (currentVma) {
    currentVma.close();
    currentVma = null;
  }

  try {
    const size = 0;
    const opts = typeSpec.strLength != null
      ? [filename, size, typeSpec.type, typeSpec.strLength]
      : [filename, size, typeSpec.type];
    currentVma = new VirtualMemoryArray(...opts);
    console.log('Открыт виртуальный массив:', filename, 'размер', currentVma.size, 'тип', typeSpec.type);
  } catch (e) {
    if (e.code === 'ENOSPC') {
      printError('Ошибка: недостаточно места на диске.');
    } else if (e.message && e.message.includes('память')) {
      printError('Ошибка: недостаточно оперативной памяти.');
    } else {
      printError('Ошибка файловой операции:', e.message);
    }
  }
}

function runInput(args) {
  if (!currentVma) {
    printError('Ошибка: сначала откройте или создайте массив (Create или Open).');
    return;
  }
  if (args.length < 2) {
    printError('Ошибка: Input индекс значение');
    return;
  }
  const index = parseInt(args[0], 10);
  if (!Number.isInteger(index) || index < 0) {
    printError('Ошибка: индекс должен быть неотрицательным целым числом.');
    return;
  }
  const value = parseInputValue(args.slice(1).join(' '));

  try {
    currentVma.set(index, value);
    console.log('Записано: индекс', index);
  } catch (e) {
    if (e.message === 'Out of range') {
      printError('Ошибка: индекс элемента выходит за границы массива (0..' + (currentVma.size - 1) + ').');
    } else {
      printError('Ошибка:', e.message);
    }
  }
}

function runPrint(args) {
  if (!currentVma) {
    printError('Ошибка: сначала откройте или создайте массив (Create или Open).');
    return;
  }
  if (args.length < 1) {
    printError('Ошибка: Print индекс');
    return;
  }
  const index = parseInt(args[0], 10);
  if (!Number.isInteger(index) || index < 0) {
    printError('Ошибка: индекс должен быть неотрицательным целым числом.');
    return;
  }

  try {
    const value = currentVma.get(index);
    if (value === null) {
      console.log('(пусто)');
    } else {
      console.log(value);
    }
  } catch (e) {
    if (e.message === 'Out of range') {
      printError('Ошибка: индекс элемента выходит за границы массива (0..' + (currentVma.size - 1) + ').');
    } else {
      printError('Ошибка:', e.message);
    }
  }
}

function runHelp(args) {
  const text = getHelpText();
  if (args.length >= 1) {
    const outFile = args[0].trim();
    try {
      fs.writeFileSync(outFile, text, 'utf8');
      console.log('Список команд записан в', outFile);
    } catch (e) {
      printError('Ошибка записи в файл:', e.message);
    }
  } else {
    console.log(text);
  }
}

function runExit() {
  if (currentVma) {
    currentVma.close();
    currentVma = null;
  }
  console.log('Выход. Файлы виртуального массива не удаляются.');
  process.exit(0);
}

function processLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  const firstSpace = trimmed.indexOf(' ');
  const cmd = firstSpace === -1 ? trimmed.toUpperCase() : trimmed.slice(0, firstSpace).toUpperCase();
  const rest = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1);

  switch (cmd) {
    case 'CREATE':
      runCreate(rest.split(/\s+/).filter(Boolean));
      break;
    case 'OPEN':
      runOpen(rest.split(/\s+/).filter(Boolean));
      break;
    case 'INPUT':
      runInput(parseInputArgs(rest));
      break;
    case 'PRINT':
      runPrint(rest.split(/\s+/).filter(Boolean));
      break;
    case 'HELP':
      runHelp(rest.split(/\s+/).filter(Boolean));
      break;
    case 'EXIT':
      runExit();
      return;
    default:
      printError('Неизвестная команда. Введите Help для списка команд.');
  }
}

function parseInputArgs(rest) {
  const parts = [];
  let i = 0;
  const s = rest.trim();
  while (i < s.length) {
    if (s[i] === ' ' || s[i] === '\t') {
      i++;
      continue;
    }
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i];
      i++;
      let end = i;
      while (end < s.length && s[end] !== q) {
        if (s[end] === '\\') end++;
        end++;
      }
      parts.push(s.slice(i, end));
      i = end < s.length ? end + 1 : end;
    } else {
      let end = i;
      while (end < s.length && s[end] !== ' ' && s[end] !== '\t') end++;
      if (end > i) parts.push(s.slice(i, end));
      i = end + 1;
    }
  }
  return parts.filter(Boolean);
}

function main() {
  console.log('Виртуальная память — консольное приложение.');
  console.log('Команды: Create, Open, Input, Print, Help, Exit. Введите Help для подсказки.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  function prompt() {
    rl.question(PROMPT, (line) => {
      processLine(line);
      prompt();
    });
  }

  prompt();
}

main();
