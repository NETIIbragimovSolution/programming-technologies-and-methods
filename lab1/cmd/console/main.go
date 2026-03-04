package main

import (
	"os"

	"lab/internal/parser"
	"lab/internal/store"
)

func main() {
	s := &store.Store{}
	parser.Run(s, os.Stdin, os.Stdout, os.Stderr)
}
