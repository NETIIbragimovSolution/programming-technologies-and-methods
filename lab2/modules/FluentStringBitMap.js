'use strict';

import { PAGE_SIZE } from "../data/constants";

const fs = require("fs");

export class VirtualStringArrayVar {

    constructor(filename, size) {

        this.filename = filename;
        this.size = size;

        this.pageSize = PAGE_SIZE;

        this.itemsPerPage = 32;

        this.bitmapSize = Math.ceil(this.itemsPerPage / 8);
        this.offsetSize = this.itemsPerPage * 4;

        this.dataStart = this.bitmapSize + this.offsetSize;

        this.pageFullSize = this.pageSize;

        this.pages = Math.ceil(size / this.itemsPerPage);

        this.fd = fs.openSync(filename, "w+");

        this.initFile();
    }

    initFile() {

        const header = Buffer.alloc(11);

        header.write("VM", 0);
        header.writeBigInt64LE(BigInt(this.size), 2);
        header.write("S", 10);

        fs.writeSync(this.fd, header);

        const emptyPage = Buffer.alloc(this.pageFullSize);

        for (let i = 0; i < this.pages; i++) {
            fs.writeSync(this.fd, emptyPage);
        }
    }

    getPageOffset(pageIndex) {

        const headerSize = 11;

        return headerSize + pageIndex * this.pageFullSize;
    }

    set(index, value) {

        if (index >= this.size) throw Error("Out of bounds");

        const page = Math.floor(index / this.itemsPerPage);
        const offset = index % this.itemsPerPage;

        const pageOffset = this.getPageOffset(page);

        const buffer = Buffer.alloc(this.pageFullSize);

        fs.readSync(this.fd, buffer, 0, this.pageFullSize, pageOffset);

        const byteIndex = Math.floor(offset / 8);
        const bitIndex = offset % 8;

        buffer[byteIndex] |= (1 << bitIndex);

        const strBuf = Buffer.from(value + "\0");

        let writePos = this.dataStart;

        for (let i = 0; i < this.itemsPerPage; i++) {

            const off = buffer.readInt32LE(this.bitmapSize + i * 4);

            if (off > writePos) writePos = off;
        }

        strBuf.copy(buffer, writePos);

        buffer.writeInt32LE(writePos, this.bitmapSize + offset * 4);

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

        const strOffset = buffer.readInt32LE(this.bitmapSize + offset * 4);

        let end = strOffset;

        while (buffer[end] !== 0) end++;

        return buffer.slice(strOffset, end).toString();
    }

    close() {
        fs.closeSync(this.fd);
    }
}
