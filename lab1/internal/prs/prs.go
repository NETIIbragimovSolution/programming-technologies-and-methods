package prs

import (
	"encoding/binary"
	"io"
	"os"
)

const (
	HeaderSize  = 4 + 4
	RecordSize  = 1 + 4 + 2 + 4 // 11
	NullPtr     = int32(-1)
	DeletedMark = 0xFF
	ActiveMark  = 0
)

type Header struct {
	FirstRecord int32
	FreeArea    int32
}

type Record struct {
	Deleted      byte
	ProductPtr   int32
	Multiplicity uint16
	Next         int32
}


type File struct {
	f    *os.File
	path string
}

func Create(path string) (*File, error) {
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	h := Header{FirstRecord: NullPtr, FreeArea: HeaderSize}
	if err := binary.Write(f, binary.LittleEndian, h.FirstRecord); err != nil {
		f.Close()
		return nil, err
	}
	if err := binary.Write(f, binary.LittleEndian, h.FreeArea); err != nil {
		f.Close()
		return nil, err
	}
	return &File{f: f, path: path}, nil
}

func (sf *File) WriteHeader(h Header) error {
	return sf.writeHeader(h)
}

func Open(path string) (*File, error) {
	f, err := os.OpenFile(path, os.O_RDWR, 0644)
	if err != nil {
		return nil, err
	}
	return &File{f: f, path: path}, nil
}

func (sf *File) Close() error {
	if sf.f == nil {
		return nil
	}
	return sf.f.Close()
}

func (sf *File) Path() string { return sf.path }

func (sf *File) ReadHeader() (Header, error) {
	_, err := sf.f.Seek(0, io.SeekStart)
	if err != nil {
		return Header{}, err
	}
	var h Header
	if err := binary.Read(sf.f, binary.LittleEndian, &h.FirstRecord); err != nil {
		return Header{}, err
	}
	if err := binary.Read(sf.f, binary.LittleEndian, &h.FreeArea); err != nil {
		return Header{}, err
	}
	return h, nil
}

func (sf *File) writeHeader(h Header) error {
	_, err := sf.f.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}
	if err := binary.Write(sf.f, binary.LittleEndian, h.FirstRecord); err != nil {
		return err
	}
	return binary.Write(sf.f, binary.LittleEndian, h.FreeArea)
}

func (sf *File) ReadRecord(offset int32) (*Record, error) {
	if offset < HeaderSize {
		return nil, os.ErrInvalid
	}
	_, err := sf.f.Seek(int64(offset), io.SeekStart)
	if err != nil {
		return nil, err
	}
	var rec Record
	if err := binary.Read(sf.f, binary.LittleEndian, &rec.Deleted); err != nil {
		return nil, err
	}
	if err := binary.Read(sf.f, binary.LittleEndian, &rec.ProductPtr); err != nil {
		return nil, err
	}
	if err := binary.Read(sf.f, binary.LittleEndian, &rec.Multiplicity); err != nil {
		return nil, err
	}
	if err := binary.Read(sf.f, binary.LittleEndian, &rec.Next); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (sf *File) WriteRecord(offset int32, rec *Record) error {
	_, err := sf.f.Seek(int64(offset), io.SeekStart)
	if err != nil {
		return err
	}
	if err := binary.Write(sf.f, binary.LittleEndian, rec.Deleted); err != nil {
		return err
	}
	if err := binary.Write(sf.f, binary.LittleEndian, rec.ProductPtr); err != nil {
		return err
	}
	if err := binary.Write(sf.f, binary.LittleEndian, rec.Multiplicity); err != nil {
		return err
	}
	return binary.Write(sf.f, binary.LittleEndian, rec.Next)
}

func (sf *File) AddRecord(productPtr int32, multiplicity uint16) (int32, error) {
	h, err := sf.ReadHeader()
	if err != nil {
		return 0, err
	}
	offset := h.FreeArea
	nextFree := offset + int32(RecordSize)

	rec := &Record{
		Deleted:      ActiveMark,
		ProductPtr:   productPtr,
		Multiplicity: multiplicity,
		Next:         NullPtr,
	}
	if err := sf.WriteRecord(offset, rec); err != nil {
		return 0, err
	}
	h.FreeArea = nextFree
	if h.FirstRecord == NullPtr {
		h.FirstRecord = offset
	}
	return offset, sf.writeHeader(h)
}

func (sf *File) AppendToChain(chainHead int32, productPtr int32, multiplicity uint16) (int32, error) {
	newOff, err := sf.AddRecord(productPtr, multiplicity)
	if err != nil {
		return 0, err
	}
	if chainHead == NullPtr {
		return newOff, nil
	}
	curr := chainHead
	for {
		rec, err := sf.ReadRecord(curr)
		if err != nil {
			return 0, err
		}
		if rec.Next == NullPtr {
			rec.Next = newOff
			_ = sf.WriteRecord(curr, rec)
			return chainHead, nil
		}
		curr = rec.Next
	}
}

func (sf *File) TraverseChain(chainHead int32, f func(offset int32, rec *Record) bool) error {
	curr := chainHead
	for curr != NullPtr {
		rec, err := sf.ReadRecord(curr)
		if err != nil {
			return err
		}
		if rec.Deleted == ActiveMark {
			if !f(curr, rec) {
				return nil
			}
		}
		curr = rec.Next
	}
	return nil
}

func (sf *File) SetDeleted(offset int32, deleted byte) error {
	rec, err := sf.ReadRecord(offset)
	if err != nil {
		return err
	}
	rec.Deleted = deleted
	return sf.WriteRecord(offset, rec)
}

func (sf *File) FindInChain(chainHead int32, productPtr int32) (int32, error) {
	curr := chainHead
	for curr != NullPtr {
		rec, err := sf.ReadRecord(curr)
		if err != nil {
			return 0, err
		}
		if rec.Deleted == ActiveMark && rec.ProductPtr == productPtr {
			return curr, nil
		}
		curr = rec.Next
	}
	return 0, nil
}
