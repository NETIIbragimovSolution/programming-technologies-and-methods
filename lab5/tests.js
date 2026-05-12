const { toPOLIZ, evaluatePOLIZ, validateInfix, validatePOLIZ } = require('./polishNotation');

let passed = 0;
let failed = 0;

const color = process.stdout.isTTY
    ? {
          reset: '\x1b[0m',
          green: (s) => `\x1b[32m${s}\x1b[0m`,
          red: (s) => `\x1b[31m${s}\x1b[0m`,
      }
    : {
          reset: '',
          green: (s) => s,
          red: (s) => s,
      };

/** @param {boolean} [opts.negative] — негативный сценарий (ожидаем ошибку/аномалию): PASS красным */
function test(name, actual, expected, opts) {
    const negative = opts === true || (opts && opts.negative === true);
    const ok = actual === expected ||
        (actual !== actual && expected !== expected) ||
        (actual === Infinity && expected === Infinity);
    if (ok) {
        const pass = negative ? color.red('PASS') : color.green('PASS');
        console.log(`  ${pass}  ${name}`);
        passed++;
    } else {
        console.log(`  ${color.red('FAIL')}  ${name}`);
        console.log(`         expected: ${JSON.stringify(expected)}`);
        console.log(`         actual:   ${JSON.stringify(actual)}`);
        failed++;
    }
}

/** Проверка validateInfix / validatePOLIZ: при expectOk=false — негативный класс (PASS красным). */
function testValidation(name, result, expectOk) {
    const ok = result.ok === expectOk;
    if (ok) {
        const pass = expectOk === false ? color.red('PASS') : color.green('PASS');
        console.log(`  ${pass}  ${name}`);
        passed++;
    } else {
        console.log(`  ${color.red('FAIL')}  ${name}`);
        console.log(`         expected ok=${expectOk}, got ok=${result.ok}, message: ${JSON.stringify(result.message)}`);
        failed++;
    }
}

// ТЕСТИРОВАНИЕ МЕТОДОМ «ЧЁРНОГО ЯЩИКА»

// Классы эквивалентности
// Входное условие: строка-выражение
//   Допустимые КЭ:
//     КЭ1 — операторы + и −              (правильный)
//     КЭ2 — операторы * и /              (правильный)
//     КЭ3 — выражение со скобками        (правильный)
//     КЭ4 — оператор ^                   (правильный)
//     КЭ5 — одно число                   (правильный)
//   Недопустимые КЭ:
//     КЭ6 — пустая строка                (неправильный)
console.log('\n=== ЧЁРНЫЙ ЯЩИК: Классы эквивалентности — toPOLIZ ===');
test('КЭ1 — операторы + и −',          toPOLIZ('1 + 2 - 3'),           '1 2 + 3 -');
test('КЭ2 — операторы * и /',          toPOLIZ('6 * 2 / 3'),           '6 2 * 3 /');
test('КЭ3 — выражение со скобками',    toPOLIZ('(2 + 3) * 4'),         '2 3 + 4 *');
test('КЭ4 — оператор ^',              toPOLIZ('2 ^ 3'),                '2 3 ^');
test('КЭ5 — одно число',              toPOLIZ('5'),                    '5');
test('КЭ6 — пустая строка (null)',     toPOLIZ(''),                     null);

// Анализ граничных значений
// Граница минимума: 1 токен
// Граница максимума: глубоко вложенные скобки, длинное выражение
console.log('\n=== ЧЁРНЫЙ ЯЩИК: Граничные значения — toPOLIZ ===');
test('ГЗ1 — минимум: 1 токен',                 toPOLIZ('7'),               '7');
test('ГЗ2 — 2 токена + оператор',              toPOLIZ('1 + 2'),           '1 2 +');
test('ГЗ3 — двойные скобки',                   toPOLIZ('((2 + 3))'),       '2 3 +');
test('ГЗ4 — цепочка ^ (левоассоц.)',           toPOLIZ('2 ^ 3 ^ 2'),       '2 3 ^ 2 ^');
test('ГЗ5 — макс. сложность, 2 пары скобок',  toPOLIZ('(2 + 3) * (4 - 1)'), '2 3 + 4 1 - *');

// Анализ причинно-следственных связей
// Причины:  C1=число, C2=оператор, C3=«(», C4=«)», C5=приоритет вершины ≥ текущего
// Следствия: E1=число → выход, E2=снять+поместить оп., E3=поместить оп., E4=снимать до «(»
console.log('\n=== ЧЁРНЫЙ ЯЩИК: Причинно-следственные связи — toPOLIZ ===');
test('ПС1 — C1: число → выход (E1)',            toPOLIZ('3'),               '3');
test('ПС2 — C2+¬C5: оператор, стек пуст (E3)', toPOLIZ('1 + 2'),           '1 2 +');
test('ПС3 — C2+C5: снять оп. перед добавл. (E2)',toPOLIZ('1 + 2 - 3'),     '1 2 + 3 -');
test('ПС4 — C3: «(» → стек (E3)',              toPOLIZ('(2 + 3)'),         '2 3 +');
test('ПС5 — C4: «)» → снимать до «(» (E4)',    toPOLIZ('(2 + 3) * 4'),     '2 3 + 4 *');

// Классы эквивалентности
// Входное условие: строка ПОЛИЗ
//   Допустимые КЭ:
//     КЭ7  — сложение        (правильный)
//     КЭ8  — вычитание       (правильный)
//     КЭ9  — умножение       (правильный)
//     КЭ10 — деление         (правильный)
//     КЭ11 — возведение в степень (правильный)
//     КЭ12 — составное выражение  (правильный)
//   Недопустимые КЭ:
//     КЭ13 — деление на ноль      (неправильный → Infinity)
console.log('\n=== ЧЁРНЫЙ ЯЩИК: Классы эквивалентности — evaluatePOLIZ ===');
test('КЭ7  — сложение',          evaluatePOLIZ('1 2 +'),           3);
test('КЭ8  — вычитание',         evaluatePOLIZ('5 3 -'),           2);
test('КЭ9  — умножение',         evaluatePOLIZ('4 3 *'),           12);
test('КЭ10 — деление',           evaluatePOLIZ('8 4 /'),           2);
test('КЭ11 — степень',           evaluatePOLIZ('2 3 ^'),           8);
test('КЭ12 — составное (2+3)*4-5',evaluatePOLIZ('2 3 + 4 * 5 -'), 15);
test('КЭ13 — деление на 0',      evaluatePOLIZ('5 0 /'),           Infinity);

// Граничные значения
console.log('\n=== ЧЁРНЫЙ ЯЩИК: Граничные значения — evaluatePOLIZ ===');
test('ГЗ6  — минимум: одно число 0', evaluatePOLIZ('0'),    0);
test('ГЗ7  — результат = 0',         evaluatePOLIZ('3 3 -'), 0);
test('ГЗ8  — отрицательный результат', evaluatePOLIZ('3 5 -'), -2);
test('ГЗ9  — многозначные числа', toPOLIZ('12 + 34'), '12 34 +');
test('ГЗ10 — только пробелы → null (toPOLIZ)', toPOLIZ('   \t  '), null);

// Предположение об ошибке (чёрный ящик) — типичные ошибки пользователя
console.log('\n=== ЧЁРНЫЙ ЯЩИК: Предположение об ошибке — ввод (валидация ловит) ===');
testValidation('ПОО1 — недопустимые символы (буквы)', validateInfix('2 + a'), false);
testValidation('ПОО2 — лишний символ в конце', validateInfix('1 + 2!'), false);
testValidation('ПОО3 — не хватает закрывающей скобки', validateInfix('(1 + 2'), false);
testValidation('ПОО4 — лишняя закрывающая скобка', validateInfix('1 + 2)'), false);
test('ПОО4b — toPOLIZ без валидации может «съесть» хвост (1+2))', toPOLIZ('(1 + 2))'), '1 2 +');

console.log('\n=== ЧЁРНЫЙ ЯЩИК: Предположение об ошибке — evaluatePOLIZ ===');
test('ПОО5 — пустая строка ПОЛИЗ', evaluatePOLIZ(''), undefined, { negative: true });
test('ПОО6 — неизвестный оператор', evaluatePOLIZ('1 2 %'), NaN, { negative: true });
test('ПОО7 — не хватает операнда', evaluatePOLIZ('1 +'), NaN, { negative: true });
testValidation('ПОО8 — лишние числа (некорректная ПОЛИЗ)', validatePOLIZ('1 2 3 +'), false);

// Валидация ввода (для пользователя / отчёта)
console.log('\n=== Валидация: validateInfix — допустимые случаи ===');
testValidation('В1 — корректное выражение', validateInfix('(2 + 3) * 4'), true);
testValidation('В2 — пробелы по краям', validateInfix('  1 + 2  '), true);
testValidation('В3 — только число', validateInfix('42'), true);

console.log('\n=== Валидация: validateInfix — отклонение ===');
testValidation('В4 — пустая строка', validateInfix(''), false);
testValidation('В5 — только пробелы', validateInfix(' \t '), false);
testValidation('В6 — буквы', validateInfix('x + 1'), false);
testValidation('В7 — точка в числе', validateInfix('1.5 + 2'), false);
testValidation('В8 — не хватает «)»', validateInfix('((1+2)'), false);
testValidation('В9 — лишняя «)»', validateInfix('(1+2))'), false);
testValidation('В10 — неполное покрытие токенами', validateInfix('2 + a'), false);

console.log('\n=== Валидация: validatePOLIZ — допустимые случаи ===');
testValidation('ВП1 — одно число', validatePOLIZ('0'), true);
testValidation('ВП2 — одна операция', validatePOLIZ('1 2 +'), true);
testValidation('ВП3 — цепочка', validatePOLIZ('2 3 + 4 * 5 -'), true);

console.log('\n=== Валидация: validatePOLIZ — отклонение ===');
testValidation('ВП4 — пусто', validatePOLIZ(''), false);
testValidation('ВП5 — неизвестный символ', validatePOLIZ('1 2 %'), false);
testValidation('ВП6 — мало операндов', validatePOLIZ('1 +'), false);
testValidation('ВП7 — дробь', validatePOLIZ('1.5 2 +'), false);
testValidation('ВП8 — два значения на стеке', validatePOLIZ('1 2'), false);

// Белый ящик: ветви validatePOLIZ (операторы и глубина стека)
console.log('\n=== БЕЛЫЙ ЯЩИК: validatePOLIZ — покрытие ветвей ===');
testValidation('БВ1 — не число и не известный оператор', validatePOLIZ('1 x +'), false);
testValidation('БВ2 — оператор при depth < 2', validatePOLIZ('+'), false);
testValidation('БВ3 — корректное завершение depth === 1', validatePOLIZ('9'), true);

// ТЕСТИРОВАНИЕ МЕТОДОМ «БЕЛОГО ЯЩИКА»
//
// Узлы решений в toPOLIZ:
//   D1: if (!isNaN(token))
//   D2: else if (operators.includes(token))
//   D3: while (stack.length && operators.includes(top) && priority[top] >= priority[token])
//   D4: else if (token === "(")
//   D5: else if (token === ")")
//   D6: while (stack.length && top !== "(")
//   D7: while (stack.length)   — слив остатка стека

//Покрытие операторов
// Один тест обходит все ветви: число, оператор, «(», «)», слив стека
console.log('\n=== БЕЛЫЙ ЯЩИК: Покрытие операторов ===');
test('ПО1 — все операторы за один проход', toPOLIZ('(2 + 3) * 4 - 5'), '2 3 + 4 * 5 -');

// Покрытие решений
// Каждое направление каждого if/while — хотя бы один раз true и false
console.log('\n=== БЕЛЫЙ ЯЩИК: Покрытие решений ===');
// D1=T, D2=T, D3=F (стек пуст), D7=T
test('ПР1 — D3=false (стек пуст при добавлении +)', toPOLIZ('1 + 2'),       '1 2 +');
// D4=T, D5=T, D6=T (цикл снятия), D6=F (остановка на «(»)
test('ПР2 — D4/D5=true, D6 работает и завершается', toPOLIZ('(2 + 3) * 4'), '2 3 + 4 *');
// D3=T: снимается * перед добавлением +
test('ПР3 — D3=true (снятие * перед +)',             toPOLIZ('1 * 2 + 3'),   '1 2 * 3 +');

// Покрытие условий
// D3 содержит три подусловия:
//   S1 = stack.length > 0
//   S2 = operators.includes(top)
//   S3 = priority[top] >= priority[token]
// Нужно: каждое подусловие принимает true и false хотя бы по разу

console.log('\n=== БЕЛЫЙ ЯЩИК: Покрытие условий ===');
// S1=F (стек пуст в начале), S2=T, S3=T при следующих вхождениях оператора
test('ПУ1 — S1=false (пустой стек при первом +)', toPOLIZ('1 + 2'),         '1 2 +');
// S1=T, S2=T, S3=T: + снимается когда приходит −
test('ПУ2 — S1=T, S2=T, S3=T (+→− снятие)',       toPOLIZ('1 + 2 - 3'),    '1 2 + 3 -');
// S1=T, S2=F: вершина стека = «(», не оператор
test('ПУ3 — S2=false (вершина стека = «(»)',       toPOLIZ('(1 + 2 - 3) * 4'), '1 2 + 3 - 4 *');
// S1=T, S2=T, S3=F: приоритет + < * → снятия нет
test('ПУ4 — S3=false (+ не снимается перед *)',    toPOLIZ('1 + 2 * 3'),    '1 2 3 * +');

// Покрытие решений/условий
// Требует: все возможные результаты каждого условия и каждого решения
// Те же 4 теста покрывают требования
console.log('\n=== БЕЛЫЙ ЯЩИК: Покрытие решений/условий ===');
test('РУ1 — S1=F (стек пуст)',              toPOLIZ('1 + 2'),           '1 2 +');
test('РУ2 — S1=T, S2=T, S3=T (снятие)',    toPOLIZ('1 + 2 - 3'),       '1 2 + 3 -');
test('РУ3 — S1=T, S2=F (вершина «(»)',     toPOLIZ('(1 + 2 - 3) * 4'), '1 2 + 3 - 4 *');
test('РУ4 — S1=T, S2=T, S3=F (нет снятия)',toPOLIZ('1 + 2 * 3'),       '1 2 3 * +');

// Комбинаторное покрытие условий
// Все достижимые комбинации (S1, S2, S3):
//   (F, x, x) — стек пуст
//   (T, F, x) — вершина стека «(»
//   (T, T, T) — снятие оператора с равным/бо́льшим приоритетом
//   (T, T, F) — оператор на стеке имеет меньший приоритет
console.log('\n=== БЕЛЫЙ ЯЩИК: Комбинаторное покрытие условий ===');
test('КК1 — (F,x,x) стек пуст',       toPOLIZ('1 + 2'),           '1 2 +');
test('КК2 — (T,T,T) снятие + перед −', toPOLIZ('1 + 2 - 3'),       '1 2 + 3 -');
test('КК3 — (T,F,x) вершина «(»',     toPOLIZ('(1 + 2) * 3'),     '1 2 + 3 *');
test('КК4 — (T,T,F) + не снимает *',  toPOLIZ('1 + 2 * 3'),       '1 2 3 * +');

// Итог
console.log(`\n${'─'.repeat(55)}`);
console.log(`Итог: ${passed} пройдено, ${failed} провалено из ${passed + failed}`);
