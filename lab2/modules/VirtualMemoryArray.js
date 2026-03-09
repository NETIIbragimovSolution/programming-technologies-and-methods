'use strict';

import fs from 'fs';
import {
  PAGE_SIZE,
  INT_SIZE,
  ITEMS_PER_PAGE,
  BITMAP_SIZE,
  HEADER_SIZE_INT,
  HEADER_SIZE_CHAR,
  HEADER_SIZE_VARCHAR,
} from '../data/constants.js';

const MIN_PAGE_BUFFER_SIZE = 3;

function createPageStruct(pageFullSize) {
  return {
    absolutePageNumber: -1,
    modified: 0,
    lastAccessTime: 0,
    bitmap: Buffer.alloc(BITMAP_SIZE),
    data: Buffer.alloc(pageFullSize - BITMAP_SIZE),
  };
}

class VirtualMemoryArray {
  constructor(filename, size, type, strLength = 0) {
    this.filename = filename;
    this.size = Number(size);
    this.type = type;
    this.strLength = type === 'int' ? 0 : strLength;

    if (this.type === 'varchar' && this.strLength <= 0) {
      throw new Error('Для типа varchar требуется strLength > 0 (максимальная длина строки)');
    }
    if (this.type === 'char' && this.strLength <= 0) {
      throw new Error('Для типа char требуется strLength > 0 (фиксированная длина строки)');
    }

    this._computeLayout();
    this.fd = null;
    this.dataFd = null;
    this._nextDataFileOffset = 0;

    this._openOrCreateFiles();
    this._bufferSize = Math.max(MIN_PAGE_BUFFER_SIZE, 3);
    this._pageBuffer = [];
    for (let i = 0; i < this._bufferSize; i++) {
      this._pageBuffer.push(createPageStruct(this.pageFullSize));
    }
    this._loadInitialPages();
  }

  _computeLayout() {
    if (this.type === 'int') {
      this.headerSize = HEADER_SIZE_INT;
      this.itemsPerPage = Math.floor(PAGE_SIZE / INT_SIZE); // 128
      this.pageDataSize = PAGE_SIZE;
      this.pageFullSize = BITMAP_SIZE + this.pageDataSize;
    } else if (this.type === 'char') {
      this.headerSize = HEADER_SIZE_CHAR;
      this.itemsPerPage = ITEMS_PER_PAGE; // 128
      const rawDataSize = this.itemsPerPage * this.strLength;
      this.pageDataSize = Math.ceil(rawDataSize / PAGE_SIZE) * PAGE_SIZE;
      this.pageFullSize = BITMAP_SIZE + this.pageDataSize;
    } else {
      this.headerSize = HEADER_SIZE_VARCHAR;
      this.itemsPerPage = ITEMS_PER_PAGE;
      this.pageDataSize = this.itemsPerPage * INT_SIZE; // 512
      this.pageFullSize = BITMAP_SIZE + this.pageDataSize;
    }

    this.pagesCount = Math.ceil(this.size / this.itemsPerPage);
  }

  _openOrCreateFiles() {
    const exists = fs.existsSync(this.filename);
    const mode = exists ? 'r+' : 'w+';
    this.fd = fs.openSync(this.filename, mode);

    if (!exists) {
      this._initSwapFile();
    } else {
      this._readHeader();
    }

    if (this.type === 'varchar') {
      this.dataFilename = this.filename + '.data';
      const dataExists = fs.existsSync(this.dataFilename);
      this.dataFd = fs.openSync(this.dataFilename, dataExists ? 'r+' : 'w+');
      this._nextDataFileOffset = dataExists ? fs.statSync(this.dataFilename).size : 0;
    }
  }

  _initSwapFile() {
    const header = Buffer.alloc(this.headerSize);
    header.write('VM', 0);
    header.writeBigInt64LE(BigInt(this.size), 2);

    if (this.type === 'int') {
      header.write('I', 10);
    } else if (this.type === 'char') {
      header.write('C', 10);
      header.writeInt32LE(this.strLength, 11);
    } else {
      header.write('V', 10);
      header.writeInt32LE(this.strLength, 11);
    }

    fs.writeSync(this.fd, header);

    const emptyPage = Buffer.alloc(this.pageFullSize);
    for (let i = 0; i < this.pagesCount; i++) {
      fs.writeSync(this.fd, emptyPage);
    }
  }

  _readHeader() {
    const header = Buffer.alloc(this.headerSize);
    fs.readSync(this.fd, header, 0, this.headerSize, 0);
    const sig = header.toString('utf8', 0, 2);
    if (sig !== 'VM') throw new Error('Неверная сигнатура файла');
    this.size = Number(header.readBigInt64LE(2));
    const typeChar = header.toString('utf8', 10, 11);
    if (this.type === 'char' && typeChar === 'C' && this.headerSize >= 15) {
      this.strLength = header.readInt32LE(11);
    }
    if (this.type === 'varchar' && typeChar === 'V' && this.headerSize >= 15) {
      this.strLength = header.readInt32LE(11);
    }
    this._computeLayout();
  }

  _loadInitialPages() {
    const toLoad = Math.min(this._bufferSize, this.pagesCount);
    for (let i = 0; i < toLoad; i++) {
      this._loadPage(i, i);
    }
  }

  _getPageOffset(absolutePageNumber) {
    return this.headerSize + absolutePageNumber * this.pageFullSize;
  }

  getPageBufferIndex(arrayIndex) {
    if (arrayIndex < 0 || arrayIndex >= this.size) return null;

    const absolutePageNumber = Math.floor(arrayIndex / this.itemsPerPage);

    for (let i = 0; i < this._pageBuffer.length; i++) {
      if (this._pageBuffer[i].absolutePageNumber === absolutePageNumber) {
        this._pageBuffer[i].lastAccessTime = Date.now();
        return i;
      }
    }

    let oldestIdx = 0;
    let oldestTime = this._pageBuffer[0].lastAccessTime;
    for (let i = 1; i < this._pageBuffer.length; i++) {
      if (this._pageBuffer[i].lastAccessTime < oldestTime) {
        oldestTime = this._pageBuffer[i].lastAccessTime;
        oldestIdx = i;
      }
    }

    const slot = this._pageBuffer[oldestIdx];
    if (slot.modified === 1) {
      this._flushPage(oldestIdx);
    }

    this._loadPage(absolutePageNumber, oldestIdx);
    return oldestIdx;
  }

  _flushPage(bufferIndex) {
    const page = this._pageBuffer[bufferIndex];
    if (page.absolutePageNumber < 0 || page.modified !== 1) return;

    const buf = Buffer.alloc(this.pageFullSize);
    page.bitmap.copy(buf, 0);
    page.data.copy(buf, BITMAP_SIZE);
    const fileOffset = this._getPageOffset(page.absolutePageNumber);
    fs.writeSync(this.fd, buf, 0, this.pageFullSize, fileOffset);
    page.modified = 0;
  }

  _loadPage(absolutePageNumber, bufferIndex) {
    const page = this._pageBuffer[bufferIndex];
    const fileOffset = this._getPageOffset(absolutePageNumber);
    const buf = Buffer.alloc(this.pageFullSize);
    fs.readSync(this.fd, buf, 0, this.pageFullSize, fileOffset);

    buf.copy(page.bitmap, 0, 0, BITMAP_SIZE);
    buf.copy(page.data, 0, BITMAP_SIZE, this.pageFullSize);

    page.absolutePageNumber = absolutePageNumber;
    page.modified = 0;
    page.lastAccessTime = Date.now();
  }

  _offsetInPage(arrayIndex) {
    return arrayIndex % this.itemsPerPage;
  }

  _readElementFromPage(bufferIndex, offsetInPage) {
    const page = this._pageBuffer[bufferIndex];
    const byteIndex = Math.floor(offsetInPage / 8);
    const bitIndex = offsetInPage % 8;
    const exists = (page.bitmap[byteIndex] >> bitIndex) & 1;
    if (!exists) return null;

    if (this.type === 'int') {
      return page.data.readInt32LE(offsetInPage * INT_SIZE);
    }
    if (this.type === 'char') {
      const start = offsetInPage * this.strLength;
      return page.data
        .slice(start, start + this.strLength)
        .toString('utf8')
        .replace(/\0+$/, '');
    }
    const recordOffset = page.data.readInt32LE(offsetInPage * INT_SIZE);
    const lenBuf = Buffer.alloc(4);
    fs.readSync(this.dataFd, lenBuf, 0, 4, recordOffset);
    const len = lenBuf.readUInt32LE(0);
    const strBuf = Buffer.alloc(len);
    fs.readSync(this.dataFd, strBuf, 0, len, recordOffset + 4);
    return strBuf.toString('utf8');
  }

  _writeElementToPage(bufferIndex, offsetInPage, value) {
    const page = this._pageBuffer[bufferIndex];
    const byteIndex = Math.floor(offsetInPage / 8);
    const bitIndex = offsetInPage % 8;
    page.bitmap[byteIndex] |= 1 << bitIndex;

    if (this.type === 'int') {
      page.data.writeInt32LE(value, offsetInPage * INT_SIZE);
      return;
    }
    if (this.type === 'char') {
      const start = offsetInPage * this.strLength;
      const strBuf = Buffer.alloc(this.strLength);
      strBuf.write(value.toString().slice(0, this.strLength), 0);
      strBuf.copy(page.data, start);
      return;
    }
    const str = value.toString();
    const len = Buffer.byteLength(str, 'utf8');
    const recordBuf = Buffer.alloc(4 + len);
    recordBuf.writeUInt32LE(len, 0);
    recordBuf.write(str, 4, len, 'utf8');
    fs.writeSync(this.dataFd, recordBuf, 0, recordBuf.length, this._nextDataFileOffset);
    page.data.writeInt32LE(this._nextDataFileOffset, offsetInPage * INT_SIZE);
    this._nextDataFileOffset += recordBuf.length;
  }

  get(index) {
    if (index < 0 || index >= this.size) throw new Error('Out of range');
    const bufferIndex = this.getPageBufferIndex(index);
    if (bufferIndex === null) throw new Error('Ошибка доступа к странице');
    const offsetInPage = this._offsetInPage(index);
    return this._readElementFromPage(bufferIndex, offsetInPage);
  }

  set(index, value) {
    if (index < 0 || index >= this.size) throw new Error('Out of range');
    const bufferIndex = this.getPageBufferIndex(index);
    if (bufferIndex === null) throw new Error('Ошибка доступа к странице');
    const offsetInPage = this._offsetInPage(index);
    this._writeElementToPage(bufferIndex, offsetInPage, value);
    const page = this._pageBuffer[bufferIndex];
    page.modified = 1;
    page.lastAccessTime = Date.now();
  }

  getAt(index) {
    return this.get(index);
  }

  setAt(index, value) {
    this.set(index, value);
  }

  close() {
    for (let i = 0; i < this._pageBuffer.length; i++) {
      if (this._pageBuffer[i].modified === 1) {
        this._flushPage(i);
      }
    }
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
    if (this.dataFd !== null) {
      fs.closeSync(this.dataFd);
      this.dataFd = null;
    }
  }
}

export { VirtualMemoryArray };
