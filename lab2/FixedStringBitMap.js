'use strict';

import { HEADER_SIZE, PAGE_SIZE } from './data/constants';

const fs = require('fs');


export class VirtualStringArray {
    constructor(filename, size, strLength) {
        this.filename = filename;
        this.size = size;
        this.strLength = strLength;

        this.pageSize = PAGE_SIZE;

        this.itemsPerPage = Math.floor(this.pageSize / this.strLength);
        this.bitmapSize = Math.ceil(this.itemsPerPage / 8);

        this.pageFullSize = this.bitmapSize + this.pageSize;

        this.pages = Math.ceil(size / this.itemsPerPage);

        this.fd = fs.openSync(filename, 'w+');

        this.initFile();
    }

    initFile() {
        const header = Buffer.alloc(11);

        header.write("VM", 0);
        header.writeBigInt64LE(BigInt(this.size), 2);
        header.write("S", 10); // тип массива строк

        fs.writeSync(this.fd, header);

        const emptyPage = Buffer.alloc(this.pageFullSize);

        for (let i = 0; i < this.pages; i++) {
            fs.writeSync(this.fd, emptyPage);
        }
    }

    getPageOffset(pageIndex) {
        const headerSize = HEADER_SIZE;
        return headerSize + pageIndex * this.pageFullSize;
    }

    set(index, value) {
        if (index >= this.size) throw Error("Out of bounds");

        const page = Math.floor(index / this.itemsPerPage);
        const offset = index % this.itemsPerPage;

        const pageOffset = this.getPageOffset(page);

        const buffer = Buffer.alloc(this.pageFullSize);
        fs.readSync(this.fd, buffer, 0, this.pageFullSize, pageOffset);

        // bitmap
        const byteIndex = Math.floor(offset / 8);
        const bitIndex = offset % 8;

        buffer[byteIndex] |= (1 << bitIndex);

        // data
        const dataOffset = this.bitmapSize + offset * this.strLength;

        const strBuffer = Buffer.alloc(this.strLength);
        strBuffer.write(value.slice(0, this.strLength));

        strBuffer.copy(buffer, dataOffset);

        fs.writeSync(this.fd, buffer, 0, this.pageFullSize, pageOffset);
    }

    get(index) {
        if (index >= this.size || index < 0) throw new Error("Out of range");

        const page = Math.floor(index / this.itemsPerPage);
        const offset = index % this.itemsPerPage;

        const pageOffset = this.getPageOffset(page);

        const buffer = Buffer.alloc(this.pageFullSize);
        fs.readSync(this.fd, buffer, 0, this.pageFullSize, pageOffset);

        const byteIndex = Math.floor(offset / 8);
        const bitIndex = offset % 8;

        const exists = (buffer[byteIndex] >> bitIndex) & 1;

        if (!exists) return null;

        const dataOffset = this.bitmapSize + offset * this.strLength;

        return buffer
            .slice(dataOffset, dataOffset + this.strLength)
            .toString()
            .replace(/\0+$/, "");
    }

    close() {
        fs.closeSync(this.fd);
    }
}
