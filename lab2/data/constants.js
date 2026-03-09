/** Размер страницы данных в байтах (по заданию). */
const PAGE_SIZE = 512;

/** Размер элемента целого типа в байтах. */
const INT_SIZE = Int32Array.BYTES_PER_ELEMENT;

/** Количество элементов на странице для char/varchar (по заданию). */
const ITEMS_PER_PAGE = 128;

/** Размер битовой карты на страницу: 128 бит = 16 байт. */
const BITMAP_SIZE = ITEMS_PER_PAGE / 8;

/** Заголовок файла для типа int: VM (2) + размерность long (8) + символ I (1). */
const HEADER_SIZE_INT = 2 + 8 + 1;

/** Заголовок файла для типа char: VM (2) + размерность long (8) + C (1) + длина строки int (4). */
const HEADER_SIZE_CHAR = 2 + 8 + 1 + 4;

/** Заголовок файла для типа varchar: VM (2) + размерность long (8) + V (1) + макс. длина строки int (4). */
const HEADER_SIZE_VARCHAR = 2 + 8 + 1 + 4;

// Обратная совместимость
const HEADER_SIZE = HEADER_SIZE_INT;

export {
  PAGE_SIZE,
  INT_SIZE,
  ITEMS_PER_PAGE,
  BITMAP_SIZE,
  HEADER_SIZE,
  HEADER_SIZE_INT,
  HEADER_SIZE_CHAR,
  HEADER_SIZE_VARCHAR,
};
