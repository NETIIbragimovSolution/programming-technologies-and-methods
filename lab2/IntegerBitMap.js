'use strict';

import { HEADER_SIZE, INT_SIZE } from './data/constants';

const fs = require('fs');


export class VirtualIntArray {
    constructor(filename, size) {
        // имя файла
        this.filename = filename;
        // размер масива который моделируем
        this.size = size;
        
        this.pageSize = 512;  // фиксируем по задаче
        this.intSize = INT_SIZE;

        this.itemsPerPage = this.pageSize / this.intSize;

        this.bitMapSize = this.itemsPerPage / 8 // вычисляем сколько бит нужно на страницу для элементов

        this.pageFullSize = this.bitMapSize + this.pageSize;

        this.pagesCount = Math.ceil(size / this.itemsPerPage);

        this.fd = fs.openSync(filename, 'w+');

        this.initFile();
    }

    initFile() {
        const header = Buffer.alloc(HEADER_SIZE);
        

        header.write("VM", 0);
        header.writeBigInt64BE(BigInt(this.size), 2);
        header.write("I", 10);

        fs.writeSync(this.fd, header);

        
        // аллоцируем под полную пустую страницу
        const emptyPage = Buffer.alloc(this.pageFullSize);

        // создаем нужное количество страниц
        for (let i = 0; i < this.pagesCount; i++) {
            fs.writeSync(this.fd, emptyPage);
        }
    }


    // методы для работы


    getPageOffset(pageIndex) {
        return HEADER_SIZE + pageIndex * this.pageFullSize;
    }


    set(index, value) {
        if (index >= this.size || index < 0) throw new Error("Out of range");

        // на какую страницу
        const page = Math.floor(index / this.itemsPerPage);

        // какой байт на странице (подобие двумерного массива)
        const offset = index % this.itemsPerPage;

        const pageOffset = this.getPageOffset(page);
        
        const buffer = Buffer.alloc(this.pageFullSize);
        fs.readSync(this.fd, buffer, 0, this.pageFullSize, pageOffset);

        const byteIndex = Math.floor(offset / 8);
        const bitIndex = offset % 8;

        buffer[byteIndex] |= (1 << bitIndex);

        const dataOffset = this.bitMapSize + offset * this.intSize;

        buffer.writeInt32LE(value, dataOffset);

        fs.writeSync(this.fd, buffer, 0, this.pageFullSize, pageOffset);
    }
    get(index) {
        if (index >= this.size) throw Error("Out of bounds");

        const page = Math.floor(index / this.itemsPerPage);
        const offset = index % this.itemsPerPage;

        const pageOffset = this.getPageOffset(page);

        const buffer = Buffer.alloc(this.pageFullSize);
        fs.readSync(this.fd, buffer, 0, this.pageFullSize, pageOffset);

        const byteIndex = Math.floor(offset / 8);
        const bitIndex = offset % 8;

        const exists = (buffer[byteIndex] >> bitIndex) & 1;

        if (!exists) return null;

        const dataOffset = this.bitmapSize + offset * this.intSize;
        return buffer.readInt32LE(dataOffset);
    }
    close() {
        fs.closeSync(this.fd);
    }
}