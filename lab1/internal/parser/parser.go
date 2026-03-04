package parser

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"lab/internal/store"
)

func Run(s *store.Store, in io.Reader, out, errOut io.Writer) {
	scanner := bufio.NewScanner(in)
	for {
		fmt.Fprint(out, "PS> ")
		if !scanner.Scan() {
			break
		}

		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		cmd, rest := splitCmd(line)
		cmd = strings.ToLower(cmd)
		switch cmd {
		case "exit":
			_ = s.Close()
			return
		case "create":
			if err := handleCreate(s, rest, out); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		case "open":
			if err := handleOpen(s, rest); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		case "input":
			if err := handleInput(s, rest); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		case "delete":
			if err := handleDelete(s, rest); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		case "restore":
			if err := handleRestore(s, rest); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		case "truncate":
			if err := handleTruncate(s); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		case "print":
			if err := handlePrint(s, rest, out); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		case "help":
			if err := handleHelp(s, rest, out); err != nil {
				fmt.Fprintln(errOut, "Error:", err.Error())
			}
		default:
			fmt.Fprintln(errOut, "Error: unknown command")
		}
	}
}

func splitCmd(line string) (string, string) {
	i := 0
	for i < len(line) && line[i] != ' ' && line[i] != '\t' {
		i++
	}
	return strings.TrimSpace(line[:i]), strings.TrimSpace(line[i:])
}

func handleCreate(s *store.Store, rest string, out io.Writer) error {
	name, args, err := parseCreateArgs(rest)
	if err != nil {
		return err
	}

	parts := splitArgs(args)

	var maxLen uint16 = 32
	specName := ""
	if len(parts) >= 1 {
		n, err := strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil || n <= 0 {
			return fmt.Errorf("create: invalid max name length")
		}
		maxLen = uint16(n)
	}
	if len(parts) >= 2 {
		specName = strings.TrimSpace(parts[1])
	}

	err = s.Create(name, maxLen, specName)
	if err != nil && strings.Contains(err.Error(), "overwrite not confirmed") {
		fmt.Fprint(out, "Overwrite file? (y/n): ")
		var ans string
		fmt.Scanln(&ans)
		ans = strings.TrimSpace(strings.ToLower(ans))
		if ans == "y" || ans == "yes" {
			err = s.CreateOverwrite(name, maxLen, specName)
		}
	}

	return err
}

func handleOpen(s *store.Store, rest string) error {
	rest = strings.TrimSpace(rest)
	if rest == "" {
		return fmt.Errorf("open: missing file name")
	}
	return s.Open(rest)
}

func handleInput(s *store.Store, rest string) error {
	a, b, err := parseDoubleArgs(rest)
	if err != nil {
		return err
	}
	a = strings.TrimSpace(a)
	b = strings.TrimSpace(b)
	if strings.Contains(rest, "/") {
		return s.InputAssembly(a, b)
	}
	return s.InputComponent(a, b)
}

func handleDelete(s *store.Store, rest string) error {
	a, b, err := parseDoubleArgs(rest)
	if err != nil {
		return err
	}
	a = strings.TrimSpace(a)
	b = strings.TrimSpace(b)
	if b == "" {
		return s.DeleteComponent(a)
	}
	return s.DeleteAssembly(a, b)
}

func handleRestore(s *store.Store, rest string) error {
	arg, err := parseOneArg(rest)
	if err != nil {
		return err
	}
	arg = strings.TrimSpace(arg)
	if arg == "*" {
		return s.RestoreAll()
	}
	return s.RestoreComponent(arg)
}

func handleTruncate(s *store.Store) error {
	return s.Truncate()
}

func handlePrint(s *store.Store, rest string, w io.Writer) error {
	arg, err := parseOneArg(rest)
	if err != nil {
		return err
	}
	arg = strings.TrimSpace(arg)
	if arg == "*" {
		return s.PrintAll(w)
	}
	return s.PrintComponent(arg, w)
}

func handleHelp(s *store.Store, rest string, out io.Writer) error {
	rest = strings.TrimSpace(rest)
	if rest == "" {
		return s.Help(out)
	}
	f, err := os.Create(rest)
	if err != nil {
		return err
	}
	defer f.Close()
	return s.Help(f)
}

func parseCreateArgs(s string) (string, string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", "", nil
	}

	open := strings.IndexByte(s, '(')
	if open < 0 {
		return s, "", nil
	}

	close := strings.LastIndexByte(s, ')')
	if close < 0 || close < open {
		return "", "", fmt.Errorf("missing ')'")
	}

	// Строго: после ')' должны быть только пробелы/табы/переводы строк
	if strings.TrimSpace(s[close+1:]) != "" {
		return "", "", fmt.Errorf("trailing characters after ')'")
	}

	name := strings.TrimSpace(s[:open])
	args := strings.TrimSpace(s[open+1 : close])

	return name, args, nil
}

func parseOneArg(s string) (string, error) {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "(") || !strings.HasSuffix(s, ")") {
		return "", fmt.Errorf("expected (argument)")
	}
	s = s[1 : len(s)-1]
	return strings.TrimSpace(s), nil
}

func parseDoubleArgs(s string) (a, b string, err error) {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "(") || !strings.HasSuffix(s, ")") {
		return "", "", fmt.Errorf("expected (arg1, arg2) or (arg1/arg2)")
	}
	s = s[1 : len(s)-1]
	if i := strings.Index(s, "/"); i >= 0 {
		return strings.TrimSpace(s[:i]), strings.TrimSpace(s[i+1:]), nil
	}
	if i := strings.Index(s, ","); i >= 0 {
		return strings.TrimSpace(s[:i]), strings.TrimSpace(s[i+1:]), nil
	}
	return strings.TrimSpace(s), "", nil
}

func splitArgs(s string) []string {
	if s = strings.TrimSpace(s); s == "" {
		return nil
	}

	parts := strings.Split(s, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}
