package prd

import (
	"encoding/binary"
	"io"
	"os"
	"slices"
	"strings"
)

const (
	Signature      = "PS"
	HeaderSize     = 2 + 2 + 4 + 4 + 16 // 28
	SpecNameSize   = 16
	RecordOverhead = 1 + 4 + 4 // deleted + specFirst + next
	NullPtr        = int32(-1)
	DeletedMark    = 0xFF
	ActiveMark     = 0
)

type Header struct {
	DataLen      uint16
	FirstRecord  int32
	FreeArea     int32
	SpecFileName [SpecNameSize]byte
}

type Record struct {
	Deleted   byte
	SpecFirst int32
	Next      int32
	Name      []byte // length DataLen; Name[0]=type, Name[1:]=name
}

const (
	TypeProduct byte = 0
	TypeUnit    byte = 1
	TypePart    byte = 2
)

func RecordSize(dataLen uint16) int {
	return RecordOverhead + int(dataLen)
}

type File struct {
	f      *os.File
	Header Header
	path   string
}

func Create(path string, dataLen uint16, specFileName string) (*File, error) {
	if dataLen == 0 {
		dataLen = 32
	}
	specFileName = padString(specFileName, SpecNameSize)
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	firstRec := int32(HeaderSize)

	h := Header{
		DataLen:     dataLen,
		FirstRecord: NullPtr,
		FreeArea:    firstRec,
	}
	copy(h.SpecFileName[:], specFileName)

	if _, err := f.Write([]byte(Signature)); err != nil {
		f.Close()
		return nil, err
	}
	if err := binary.Write(f, binary.LittleEndian, h.DataLen); err != nil {
		f.Close()
		return nil, err
	}
	if err := binary.Write(f, binary.LittleEndian, h.FirstRecord); err != nil {
		f.Close()
		return nil, err
	}
	if err := binary.Write(f, binary.LittleEndian, h.FreeArea); err != nil {
		f.Close()
		return nil, err
	}
	if _, err := f.Write(h.SpecFileName[:]); err != nil {
		f.Close()
		return nil, err
	}
	return &File{f: f, Header: h, path: path}, nil
}

func Open(path string) (*File, error) {
	f, err := os.OpenFile(path, os.O_RDWR, 0644)
	if err != nil {
		return nil, err
	}
	sig := make([]byte, 2)
	if _, err := io.ReadFull(f, sig); err != nil {
		f.Close()
		return nil, err
	}
	if string(sig) != Signature {
		f.Close()
		return nil, os.ErrInvalid
	}
	var h Header
	if err := binary.Read(f, binary.LittleEndian, &h.DataLen); err != nil {
		f.Close()
		return nil, err
	}
	if err := binary.Read(f, binary.LittleEndian, &h.FirstRecord); err != nil {
		f.Close()
		return nil, err
	}
	if err := binary.Read(f, binary.LittleEndian, &h.FreeArea); err != nil {
		f.Close()
		return nil, err
	}
	if _, err := io.ReadFull(f, h.SpecFileName[:]); err != nil {
		f.Close()
		return nil, err
	}
	return &File{f: f, Header: h, path: path}, nil
}

func (pf *File) Close() error {
	if pf.f == nil {
		return nil
	}
	return pf.f.Close()
}

func (pf *File) Path() string { return pf.path }

func (pf *File) SpecFilePath() string {
	name := strings.TrimSpace(string(pf.Header.SpecFileName[:]))
	if name == "" {
		base := pf.path
		if len(base) > 4 && base[len(base)-4:] == ".prd" {
			base = base[:len(base)-4]
		}
		return base + ".prs"
	}
	return name
}

func (pf *File) WriteHeader() error {
	_, err := pf.f.Seek(2, io.SeekStart)
	if err != nil {
		return err
	}
	if err := binary.Write(pf.f, binary.LittleEndian, pf.Header.DataLen); err != nil {
		return err
	}
	if err := binary.Write(pf.f, binary.LittleEndian, pf.Header.FirstRecord); err != nil {
		return err
	}
	if err := binary.Write(pf.f, binary.LittleEndian, pf.Header.FreeArea); err != nil {
		return err
	}
	_, err = pf.f.Write(pf.Header.SpecFileName[:])
	return err
}

func (pf *File) ReadRecord(offset int32) (*Record, error) {
	if offset < int32(HeaderSize) {
		return nil, os.ErrInvalid
	}

	_, err := pf.f.Seek(int64(offset), io.SeekStart)
	if err != nil {
		return nil, err
	}

	rec := &Record{Name: make([]byte, pf.Header.DataLen)}
	if err := binary.Read(pf.f, binary.LittleEndian, &rec.Deleted); err != nil {
		return nil, err
	}
	if err := binary.Read(pf.f, binary.LittleEndian, &rec.SpecFirst); err != nil {
		return nil, err
	}
	if err := binary.Read(pf.f, binary.LittleEndian, &rec.Next); err != nil {
		return nil, err
	}
	if _, err := io.ReadFull(pf.f, rec.Name); err != nil {
		return nil, err
	}
	return rec, nil
}

func (pf *File) WriteRecord(offset int32, rec *Record) error {
	_, err := pf.f.Seek(int64(offset), io.SeekStart)
	if err != nil {
		return err
	}
	if err := binary.Write(pf.f, binary.LittleEndian, rec.Deleted); err != nil {
		return err
	}
	if err := binary.Write(pf.f, binary.LittleEndian, rec.SpecFirst); err != nil {
		return err
	}
	if err := binary.Write(pf.f, binary.LittleEndian, rec.Next); err != nil {
		return err
	}
	if err := binary.Write(pf.f, binary.LittleEndian, rec.Name); err != nil {
		return err
	}

	return err
}

func (pf *File) NameFromRecord(rec *Record) string {
	if len(rec.Name) <= 1 {
		return ""
	}
	return strings.TrimSpace(string(rec.Name[1:]))
}

func (pf *File) TypeFromRecord(rec *Record) byte {
	if len(rec.Name) == 0 {
		return TypePart
	}
	return rec.Name[0]
}

func (pf *File) IsPart(rec *Record) bool {
	return pf.TypeFromRecord(rec) == TypePart
}

func padString(s string, n int) string {
	s = strings.TrimSpace(s)
	b := []byte(s)
	if len(b) > n {
		return string(b[:n])
	}
	for len(b) < n {
		b = append(b, ' ')
	}
	return string(b)
}

func (pf *File) InsertRecord(name string, compType byte) (int32, error) {
	offset := pf.Header.FreeArea
	recSize := int32(RecordSize(pf.Header.DataLen))
	nextFree := offset + recSize

	name = padString(name, int(pf.Header.DataLen)-1)

	nameBytes := []byte(name)
	if len(nameBytes) > int(pf.Header.DataLen)-1 {
		nameBytes = nameBytes[:int(pf.Header.DataLen)-1]
	}

	nameWithType := make([]byte, pf.Header.DataLen)
	nameWithType[0] = compType
	copy(nameWithType[1:], nameBytes)

	newRec := &Record{
		Deleted:   ActiveMark,
		SpecFirst: NullPtr,
		Next:      NullPtr,
		Name:      nameWithType,
	}

	// вставляем запись по алфавитному порядку
	prev := NullPtr
	curr := pf.Header.FirstRecord
	for curr != NullPtr {
		r, err := pf.ReadRecord(curr)
		if err != nil {
			return 0, err
		}

		if r.Deleted != ActiveMark {
			curr = r.Next
			continue
		}

		if strings.TrimSpace(name) < pf.NameFromRecord(r) {
			newRec.Next = curr
			if err := pf.WriteRecord(offset, newRec); err != nil {
				return 0, err
			}
			if prev == NullPtr {
				pf.Header.FirstRecord = offset
			} else {
				prevRec, _ := pf.ReadRecord(prev)
				prevRec.Next = offset
				_ = pf.WriteRecord(prev, prevRec)
			}
			pf.Header.FreeArea = nextFree
			return offset, pf.WriteHeader()
		}
		prev = curr
		curr = r.Next
	}

	newRec.Next = NullPtr
	if err := pf.WriteRecord(offset, newRec); err != nil {
		return 0, err
	}
	if prev == NullPtr {
		pf.Header.FirstRecord = offset
	} else {
		prevRec, _ := pf.ReadRecord(prev)
		prevRec.Next = offset
		_ = pf.WriteRecord(prev, prevRec)
	}
	pf.Header.FreeArea = nextFree

	return offset, pf.WriteHeader()
}

func (pf *File) FindByName(name string) (int32, *Record, error) {
	name = strings.TrimSpace(padString(name, int(pf.Header.DataLen)))

	curr := pf.Header.FirstRecord
	for curr != NullPtr {
		r, err := pf.ReadRecord(curr)
		if err != nil {
			return 0, nil, err
		}
		if r.Deleted == ActiveMark && pf.NameFromRecord(r) == name {
			return curr, r, nil
		}
		curr = r.Next
	}
	return 0, nil, nil
}

func (pf *File) FindByNameIncludingDeleted(name string) (int32, *Record, error) {
	name = strings.TrimSpace(padString(name, int(pf.Header.DataLen)))

	curr := pf.Header.FirstRecord
	for curr != NullPtr {
		r, err := pf.ReadRecord(curr)
		if err != nil {
			return 0, nil, err
		}
		if pf.NameFromRecord(r) == name {
			return curr, r, nil
		}
		curr = r.Next
	}
	return 0, nil, nil
}

func (pf *File) TraverseAll(f func(offset int32, rec *Record) bool) error {
	curr := pf.Header.FirstRecord
	for curr != NullPtr {
		r, err := pf.ReadRecord(curr)
		if err != nil {
			return err
		}
		if !f(curr, r) {
			return nil
		}
		curr = r.Next
	}
	return nil
}

func (pf *File) SetDeleted(offset int32, deleted byte) error {
	r, err := pf.ReadRecord(offset)
	if err != nil {
		return err
	}
	r.Deleted = deleted
	return pf.WriteRecord(offset, r)
}

func (pf *File) UpdateSpecFirst(offset int32, specFirst int32) error {
	r, err := pf.ReadRecord(offset)
	if err != nil {
		return err
	}
	r.SpecFirst = specFirst
	return pf.WriteRecord(offset, r)
}

func (pf *File) TraverseActive(f func(offset int32, rec *Record) bool) error {
	curr := pf.Header.FirstRecord
	for curr != NullPtr {
		r, err := pf.ReadRecord(curr)
		if err != nil {
			return err
		}
		if r.Deleted == ActiveMark {
			if !f(curr, r) {
				return nil
			}
		}
		curr = r.Next
	}
	return nil
}

func (pf *File) AllActiveOffsets() ([]int32, error) {
	var list []int32
	curr := pf.Header.FirstRecord
	for curr != NullPtr {
		r, err := pf.ReadRecord(curr)
		if err != nil {
			return nil, err
		}
		if r.Deleted == ActiveMark {
			list = append(list, curr)
		}
		curr = r.Next
	}
	return list, nil
}

func (pf *File) RebuildChain() error {
	offsets, err := pf.AllActiveOffsets()
	if err != nil {
		return err
	}
	if len(offsets) == 0 {
		pf.Header.FirstRecord = NullPtr
		return pf.WriteHeader()
	}
	type named struct {
		offset int32
		name   string
	}
	var namedList []named
	for _, off := range offsets {
		r, err := pf.ReadRecord(off)
		if err != nil {
			return err
		}
		namedList = append(namedList, named{off, pf.NameFromRecord(r)})
	}
	slices.SortFunc(namedList, func(a, b named) int {
		if a.name < b.name {
			return -1
		}
		if a.name > b.name {
			return 1
		}
		return 0
	})
	for i := range len(namedList) {
		next := NullPtr
		if i+1 < len(namedList) {
			next = namedList[i+1].offset
		}
		r, _ := pf.ReadRecord(namedList[i].offset)
		r.Next = next
		_ = pf.WriteRecord(namedList[i].offset, r)
	}
	pf.Header.FirstRecord = namedList[0].offset
	return pf.WriteHeader()
}
