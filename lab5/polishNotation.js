const readline = require('readline');

const INFIX_TOKEN = /\d+|\+|\-|\*|\/|\^|\(|\)/g;
const ALLOWED_INFIX_NO_SPACE = /^[0-9+\-*/^()]+$/;

/**
 * Проверка инфиксного выражения: только целые числа, + − * / ^, скобки;
 * скобки сбалансированы; строка полностью разбирается на допустимые лексемы.
 * @param {string} expression
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateInfix(expression) {
    if (expression == null || typeof expression !== 'string') {
        return { ok: false, message: 'Ожидается строка с выражением.' };
    }
    const trimmed = expression.trim();
    if (!trimmed.length) {
        return { ok: false, message: 'Строка пустая или содержит только пробелы.' };
    }
    const noSpace = trimmed.replace(/\s/g, '');
    if (!ALLOWED_INFIX_NO_SPACE.test(noSpace)) {
        return {
            ok: false,
            message:
                'Допустимы только цифры, операторы + − * / ^ и круглые скобки (буквы, точка в числе и прочие символы недопустимы).',
        };
    }
    let depth = 0;
    for (const ch of noSpace) {
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth < 0) {
                return { ok: false, message: 'Закрывающая скобка «)» без соответствующей «(».' };
            }
        }
    }
    if (depth !== 0) {
        return { ok: false, message: 'Несбалансированные скобки: не хватает закрывающей «)».' };
    }
    const tokens = trimmed.match(INFIX_TOKEN);
    if (!tokens || tokens.join('') !== noSpace) {
        return {
            ok: false,
            message: 'Выражение содержит недопустимую последовательность символов (проверьте операторы и числа).',
        };
    }
    return { ok: true };
}

const POLIZ_OPS = new Set(['+', '-', '*', '/', '^']);

/**
 * Проверка строки ПОЛИЗ перед вычислением: целые числа, известные операторы,
 * достаточно операндов, в конце ровно одно значение на «стеке».
 * @param {string} poliz
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validatePOLIZ(poliz) {
    if (poliz == null || typeof poliz !== 'string') {
        return { ok: false, message: 'Ожидается строка в обратной польской записи.' };
    }
    const trimmed = poliz.trim();
    if (!trimmed.length) {
        return { ok: false, message: 'ПОЛИЗ пустой.' };
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    let depth = 0;
    for (const token of tokens) {
        if (/^-?\d+$/.test(token)) {
            depth++;
            continue;
        }
        if (!POLIZ_OPS.has(token)) {
            return { ok: false, message: `Неизвестный токен «${token}»: допустимы числа и операторы + − * / ^.` };
        }
        if (depth < 2) {
            return { ok: false, message: `Недостаточно операндов для оператора «${token}».` };
        }
        depth--;
    }
    if (depth !== 1) {
        return { ok: false, message: 'Некорректная ПОЛИЗ: после обработки должно остаться ровно одно значение.' };
    }
    return { ok: true };
}

function toPOLIZ(expression) {
    const output = [];
    const stack = [];

    const priority = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2,
        '^': 3,
    };

    const operators = Object.keys(priority);

    const tokens = expression.match(INFIX_TOKEN);

    if (!tokens) return null;

    for (const token of tokens) {
        if (!isNaN(token)) {
            output.push(token);
        } else if (operators.includes(token)) {
            while (
                stack.length &&
                operators.includes(stack[stack.length - 1]) &&
                priority[stack[stack.length - 1]] >= priority[token]
            ) {
                output.push(stack.pop());
            }

            stack.push(token);
        } else if (token === '(') {
            stack.push(token);
        } else if (token === ')') {
            while (stack.length && stack[stack.length - 1] !== '(') {
                output.push(stack.pop());
            }

            stack.pop();
        }
    }

    while (stack.length) {
        output.push(stack.pop());
    }

    return output.join(' ');
}

function evaluatePOLIZ(poliz) {
    const trimmed = poliz == null ? '' : String(poliz).trim();
    if (!trimmed.length) {
        return undefined;
    }
    const stack = [];
    const tokens = trimmed.split(/\s+/);

    for (const token of tokens) {
        if (!isNaN(token)) {
            stack.push(Number(token));
        } else {
            const b = stack.pop();
            const a = stack.pop();
            if (token === '+') stack.push(a + b);
            else if (token === '-') stack.push(a - b);
            else if (token === '*') stack.push(a * b);
            else if (token === '/') stack.push(a / b);
            else if (token === '^') stack.push(Math.pow(a, b));
            else stack.push(NaN);
        }
    }

    return stack[0];
}

module.exports = { toPOLIZ, evaluatePOLIZ, validateInfix, validatePOLIZ };

if (require.main === module) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Введите выражение: ', (expr) => {
        const check = validateInfix(expr);
        if (!check.ok) {
            console.error('Ошибка ввода:', check.message);
            rl.close();
            process.exitCode = 1;
            return;
        }

        const poliz = toPOLIZ(expr);
        if (poliz == null) {
            console.error('Ошибка: не удалось построить ПОЛИЗ.');
            rl.close();
            process.exitCode = 1;
            return;
        }

        const polizCheck = validatePOLIZ(poliz);
        if (!polizCheck.ok) {
            console.error('Внутренняя ошибка ПОЛИЗ:', polizCheck.message);
            rl.close();
            process.exitCode = 1;
            return;
        }

        const value = evaluatePOLIZ(poliz);
        console.log('Инфикс:', expr.trim());
        console.log('ПОЛИЗ: ', poliz);
        console.log('Результат:', value);
        rl.close();
    });
}
