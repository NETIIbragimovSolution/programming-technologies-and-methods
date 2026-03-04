package store

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"lab/internal/prd"
	"lab/internal/prs"
)

var (
	ErrNoFileOpen = errors.New("no file open")
	ErrNotFound   = errors.New("component not found")
	ErrPartNoSpec = errors.New("part cannot have specification")
	ErrRefsExist  = errors.New("component is referenced in specifications")
	ErrInvalidSig = errors.New("invalid file signature")
)

const (
	TypeProduct = "Product"
	TypeUnit    = "Unit"
	TypePart    = "Part"
)

type Store struct {
	prd *prd.File
	prs *prs.File
}

func (s *Store) IsOpen() bool { return s.prd != nil }

func (s *Store) Close() error {
	var err error
	if s.prs != nil {
		err = s.prs.Close()
		s.prs = nil
	}
	if s.prd != nil {
		if e := s.prd.Close(); e != nil {
			err = e
		}
		s.prd = nil
	}
	return err
}

func ensureExt(name string, ext string) string {
	if filepath.Ext(name) != ext {
		return name + ext
	}
	return name
}

func (s *Store) Create(prdPath string, maxNameLen uint16, specPath string) error {
	if s.prd != nil {
		_ = s.Close()
	}
	prdPath = ensureExt(prdPath, ".prd")
	if specPath == "" {
		base := strings.TrimSuffix(prdPath, ".prd")
		specPath = base + ".prs"
	} else {
		specPath = ensureExt(specPath, ".prs")
	}
	if maxNameLen == 0 {
		maxNameLen = 32
	}
	if _, err := os.Stat(prdPath); err == nil {
		f, err := os.Open(prdPath)
		if err != nil {
			return err
		}
		sig := make([]byte, 2)
		_, _ = f.Read(sig)
		f.Close()
		if string(sig) != prd.Signature {
			return ErrInvalidSig
		}
		return fmt.Errorf("file exists: %s (overwrite not confirmed)", prdPath)
	}
	pf, err := prd.Create(prdPath, maxNameLen, specPath)
	if err != nil {
		return err
	}
	sf, err := prs.Create(specPath)
	if err != nil {
		pf.Close()
		return err
	}
	s.prd = pf
	s.prs = sf
	return nil
}

func (s *Store) CreateOverwrite(prdPath string, maxNameLen uint16, specPath string) error {
	if s.prd != nil {
		_ = s.Close()
	}
	prdPath = ensureExt(prdPath, ".prd")
	if specPath == "" {
		base := strings.TrimSuffix(prdPath, ".prd")
		specPath = base + ".prs"
	} else {
		specPath = ensureExt(specPath, ".prs")
	}
	if maxNameLen == 0 {
		maxNameLen = 32
	}
	_ = os.Remove(prdPath)
	_ = os.Remove(specPath)
	pf, err := prd.Create(prdPath, maxNameLen, specPath)
	if err != nil {
		return err
	}
	sf, err := prs.Create(specPath)
	if err != nil {
		pf.Close()
		return err
	}
	s.prd = pf
	s.prs = sf
	return nil
}

func (s *Store) Open(prdPath string) error {
	if s.prd != nil {
		_ = s.Close()
	}
	prdPath = ensureExt(prdPath, ".prd")
	pf, err := prd.Open(prdPath)
	if err != nil {
		if errors.Is(err, os.ErrInvalid) {
			return ErrInvalidSig
		}
		return err
	}
	specPath := pf.SpecFilePath()
	sf, err := prs.Open(specPath)
	if err != nil {
		pf.Close()
		return err
	}
	s.prd = pf
	s.prs = sf
	return nil
}

func (s *Store) InputComponent(name string, compType string) error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	name = strings.TrimSpace(name)
	compType = strings.TrimSpace(compType)
	var cType byte = prd.TypePart
	switch compType {
	case TypeProduct:
		cType = prd.TypeProduct
	case TypeUnit:
		cType = prd.TypeUnit
	case TypePart:
		cType = prd.TypePart
	default:
		return fmt.Errorf("invalid type: use Product, Unit, or Part")
	}
	off, _, _ := s.prd.FindByName(name)
	if off != 0 {
		return fmt.Errorf("component already exists: %s", name)
	}
	_, err := s.prd.InsertRecord(name, cType)
	return err
}

func (s *Store) InputAssembly(componentName string, assemblyName string) error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	componentName = strings.TrimSpace(componentName)
	assemblyName = strings.TrimSpace(assemblyName)
	compOff, compRec, err := s.prd.FindByName(componentName)
	if err != nil {
		return err
	}
	if compOff == 0 {
		return fmt.Errorf("%w: %s", ErrNotFound, componentName)
	}
	if s.prd.IsPart(compRec) {
		return ErrPartNoSpec
	}
	assemblyOff, _, err := s.prd.FindByName(assemblyName)
	if err != nil {
		return err
	}
	if assemblyOff == 0 {
		return fmt.Errorf("%w: %s", ErrNotFound, assemblyName)
	}
	newHead, err := s.prs.AppendToChain(compRec.SpecFirst, assemblyOff, 1)
	if err != nil {
		return err
	}
	if compRec.SpecFirst == prd.NullPtr {
		return s.prd.UpdateSpecFirst(compOff, newHead)
	}
	return nil
}

func (s *Store) hasRefsToProduct(prdOffset int32) (bool, error) {
	var found bool
	err := s.prd.TraverseActive(func(off int32, rec *prd.Record) bool {
		if rec.SpecFirst == prd.NullPtr {
			return true
		}
		_ = s.prs.TraverseChain(rec.SpecFirst, func(sOff int32, sRec *prs.Record) bool {
			if sRec.ProductPtr == prdOffset {
				found = true
				return false
			}
			return true
		})
		return !found
	})
	return found, err
}

func (s *Store) DeleteComponent(name string) error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	name = strings.TrimSpace(name)
	off, _, err := s.prd.FindByName(name)
	if err != nil {
		return err
	}
	if off == 0 {
		return fmt.Errorf("%w: %s", ErrNotFound, name)
	}
	refs, err := s.hasRefsToProduct(off)
	if err != nil {
		return err
	}
	if refs {
		return ErrRefsExist
	}
	return s.prd.SetDeleted(off, prd.DeletedMark)
}

func (s *Store) DeleteAssembly(componentName string, assemblyName string) error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	componentName = strings.TrimSpace(componentName)
	assemblyName = strings.TrimSpace(assemblyName)
	compOff, compRec, err := s.prd.FindByName(componentName)
	if err != nil {
		return err
	}
	if compOff == 0 {
		return fmt.Errorf("%w: %s", ErrNotFound, componentName)
	}
	if compRec.SpecFirst == prd.NullPtr {
		return ErrPartNoSpec
	}
	assemblyOff, _, err := s.prd.FindByName(assemblyName)
	if err != nil {
		return err
	}
	if assemblyOff == 0 {
		return fmt.Errorf("%w: %s", ErrNotFound, assemblyName)
	}
	specOff, err := s.prs.FindInChain(compRec.SpecFirst, assemblyOff)
	if err != nil {
		return err
	}
	if specOff == 0 {
		return fmt.Errorf("%w: %s in specification of %s", ErrNotFound, assemblyName, componentName)
	}
	return s.prs.SetDeleted(specOff, prs.DeletedMark)
}

func (s *Store) RestoreComponent(name string) error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	name = strings.TrimSpace(name)
	off, rec, err := s.prd.FindByNameIncludingDeleted(name)
	if err != nil {
		return err
	}
	if off == 0 {
		return fmt.Errorf("%w: %s", ErrNotFound, name)
	}
	if rec.Deleted == prd.DeletedMark {
		if err := s.prd.SetDeleted(off, prd.ActiveMark); err != nil {
			return err
		}
	}
	curr := rec.SpecFirst
	for curr != prd.NullPtr {
		sRec, err := s.prs.ReadRecord(curr)
		if err != nil {
			return err
		}
		if sRec.Deleted == prs.DeletedMark {
			_ = s.prs.SetDeleted(curr, prs.ActiveMark)
		}
		curr = sRec.Next
	}
	return s.prd.RebuildChain()
}

func (s *Store) RestoreAll() error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	err := s.prd.TraverseAll(func(off int32, rec *prd.Record) bool {
		if rec.Deleted == prd.DeletedMark {
			_ = s.prd.SetDeleted(off, prd.ActiveMark)
		}
		curr := rec.SpecFirst
		for curr != prd.NullPtr {
			sRec, err := s.prs.ReadRecord(curr)
			if err != nil {
				return true
			}
			if sRec.Deleted == prs.DeletedMark {
				_ = s.prs.SetDeleted(curr, prs.ActiveMark)
			}
			curr = sRec.Next
		}
		return true
	})
	if err != nil {
		return err
	}
	return s.prd.RebuildChain()
}

func (s *Store) Truncate() error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	prdPath := s.prd.Path()
	prsPath := s.prs.Path()
	header := s.prd.Header
	if err := s.Close(); err != nil {
		return err
	}
	oldPrd, err := prd.Open(prdPath)
	if err != nil {
		return err
	}
	oldPrs, err := prs.Open(prsPath)
	if err != nil {
		oldPrd.Close()
		return err
	}
	offsets, err := oldPrd.AllActiveOffsets()
	if err != nil {
		oldPrd.Close()
		oldPrs.Close()
		return err
	}
	type named struct {
		off  int32
		name string
	}
	var list []named
	for _, off := range offsets {
		rec, err := oldPrd.ReadRecord(off)
		if err != nil {
			continue
		}
		list = append(list, named{off, oldPrd.NameFromRecord(rec)})
	}
	slices.SortFunc(list, func(a, b named) int {
		if a.name < b.name {
			return -1
		}
		if a.name > b.name {
			return 1
		}
		return 0
	})
	oldToNewPrd := make(map[int32]int32)
	recSize := int32(prd.RecordSize(header.DataLen))
	newPrdPath := prdPath + ".tmp"
	newPrsPath := prsPath + ".tmp"
	pf, err := prd.Create(newPrdPath, header.DataLen, string(header.SpecFileName[:]))
	if err != nil {
		oldPrd.Close()
		oldPrs.Close()
		return err
	}
	newFirst := int32(prd.NullPtr)
	var newFreePrd int32 = prd.HeaderSize
	for i, item := range list {
		rec, _ := oldPrd.ReadRecord(item.off)
		rec.Next = prd.NullPtr
		if i+1 < len(list) {
			rec.Next = newFreePrd + recSize
		}
		if i == 0 {
			newFirst = newFreePrd
		}
		rec.SpecFirst = prd.NullPtr
		if err := pf.WriteRecord(newFreePrd, rec); err != nil {
			pf.Close()
			os.Remove(newPrdPath)
			oldPrd.Close()
			oldPrs.Close()
			return err
		}
		oldToNewPrd[item.off] = newFreePrd
		newFreePrd += recSize
	}
	pf.Header.FirstRecord = newFirst
	pf.Header.FreeArea = newFreePrd
	if err := pf.WriteHeader(); err != nil {
		pf.Close()
		os.Remove(newPrdPath)
		oldPrd.Close()
		oldPrs.Close()
		return err
	}
	sf, err := prs.Create(newPrsPath)
	if err != nil {
		pf.Close()
		os.Remove(newPrdPath)
		oldPrd.Close()
		oldPrs.Close()
		return err
	}
	h, _ := sf.ReadHeader()
	newSpecOff := h.FreeArea
	var specHeads []int32
	for _, item := range list {
		rec, _ := oldPrd.ReadRecord(item.off)
		if rec.SpecFirst == prd.NullPtr {
			specHeads = append(specHeads, prs.NullPtr)
			continue
		}
		var chain []*prs.Record
		curr := rec.SpecFirst
		for curr != prd.NullPtr {
			sRec, err := oldPrs.ReadRecord(curr)
			if err != nil {
				break
			}
			if sRec.Deleted == prs.ActiveMark {
				chain = append(chain, sRec)
			}
			curr = sRec.Next
		}
		head := prs.NullPtr
		for i := len(chain) - 1; i >= 0; i-- {
			sRec := chain[i]
			newPtr := oldToNewPrd[sRec.ProductPtr]
			next := head
			head = newSpecOff
			nr := &prs.Record{Deleted: prs.ActiveMark, ProductPtr: newPtr, Multiplicity: sRec.Multiplicity, Next: next}
			if err := sf.WriteRecord(newSpecOff, nr); err != nil {
				pf.Close()
				sf.Close()
				os.Remove(newPrdPath)
				os.Remove(newPrsPath)
				oldPrd.Close()
				oldPrs.Close()
				return err
			}
			newSpecOff += int32(prs.RecordSize)
		}
		specHeads = append(specHeads, head)
	}
	h.FreeArea = newSpecOff
	if newSpecOff > int32(prs.HeaderSize) {
		h.FirstRecord = int32(prs.HeaderSize)
	} else {
		h.FirstRecord = prs.NullPtr
	}
	sf.WriteHeader(h)
	sf.Close()
	for i, item := range list {
		if specHeads[i] == prs.NullPtr {
			continue
		}
		newPrdOff := oldToNewPrd[item.off]
		rec, _ := pf.ReadRecord(newPrdOff)
		rec.SpecFirst = specHeads[i]
		_ = pf.WriteRecord(newPrdOff, rec)
	}
	pf.Close()
	oldPrd.Close()
	oldPrs.Close()
	if err := os.Remove(prdPath); err != nil {
		return err
	}
	if err := os.Remove(prsPath); err != nil {
		return err
	}
	if err := os.Rename(newPrdPath, prdPath); err != nil {
		return err
	}
	if err := os.Rename(newPrsPath, prsPath); err != nil {
		return err
	}
	return s.Open(prdPath)
}

func (s *Store) PrintComponent(name string, w io.Writer) error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	name = strings.TrimSpace(name)
	off, rec, err := s.prd.FindByName(name)
	if err != nil {
		return err
	}
	if off == 0 {
		return fmt.Errorf("%w: %s", ErrNotFound, name)
	}
	if rec.SpecFirst == prd.NullPtr {
		return ErrPartNoSpec
	}
	if _, err := fmt.Fprintln(w, s.prd.NameFromRecord(rec)); err != nil {
		return err
	}
	return s.printTree(w, rec, "")
}

func (s *Store) printTree(w io.Writer, rec *prd.Record, prefix string) error {
	if rec.SpecFirst == prd.NullPtr {
		return nil
	}
	return s.prs.TraverseChain(rec.SpecFirst, func(sOff int32, sRec *prs.Record) bool {
		subRec, err := s.prd.ReadRecord(sRec.ProductPtr)
		if err != nil {
			return true
		}
		subPrefix := prefix + "| "
		if _, err := fmt.Fprintf(w, "%s|\n%s%s\n", prefix, subPrefix, s.prd.NameFromRecord(subRec)); err != nil {
			return false
		}
		if subRec.SpecFirst != prd.NullPtr {
			_ = s.printTree(w, subRec, subPrefix)
		}
		return true
	})
}

func (s *Store) PrintAll(w io.Writer) error {
	if !s.IsOpen() {
		return ErrNoFileOpen
	}
	return s.prd.TraverseActive(func(off int32, rec *prd.Record) bool {
		name := s.prd.NameFromRecord(rec)
		typ := TypePart
		switch s.prd.TypeFromRecord(rec) {
		case prd.TypeProduct:
			typ = TypeProduct
		case prd.TypeUnit:
			typ = TypeUnit
		default:
			typ = TypePart
		}
		_, _ = fmt.Fprintf(w, "%s\n%s\n", name, typ)
		return true
	})
}

func (s *Store) Help(w io.Writer) error {
	help := `Create name(max_name_len[, spec_name]) - create product list and spec files
Open name - open existing files
Input (name, type) - add component (type: Product, Unit, Part)
Input (component/assembly) - add assembly to component
Delete (name) - logically delete component
Delete (component/assembly) - logically delete assembly from component
Restore (name) - restore component and its spec records
Restore (*) - restore all deleted records
Truncate - physically remove deleted records
Print (name) - print component tree
Print (*) - print all components
Help [file] - show this help
Exit - close and quit
`
	_, err := w.Write([]byte(help))
	return err
}
