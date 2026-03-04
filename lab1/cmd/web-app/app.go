package main

import (
	"bytes"
	"context"
	"fmt"

	"lab/internal/store"
)

// App struct — связывает Wails с хранилищем (Store) консольного приложения
type App struct {
	ctx   context.Context
	store *store.Store
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		store: &store.Store{},
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// IsOpen возвращает true, если открыт файл продукта
func (a *App) IsOpen() bool {
	return a.store.IsOpen()
}

// Help возвращает текст справки по командам
func (a *App) Help() (string, error) {
	var buf bytes.Buffer
	if err := a.store.Help(&buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// Open открывает существующий файл по имени (расширение .prd подставится при необходимости)
func (a *App) Open(prdPath string) error {
	return a.store.Open(prdPath)
}

// Close закрывает текущий файл
func (a *App) Close() error {
	return a.store.Close()
}

// Create создаёт новый файл продукта. name — имя .prd, maxNameLen — макс. длина имени (0 = 32), specName — имя .prs (пусто = по умолчанию)
func (a *App) Create(name string, maxNameLen uint16, specName string) error {
	return a.store.Create(name, maxNameLen, specName)
}

// CreateOverwrite создаёт файл с перезаписью существующего
func (a *App) CreateOverwrite(name string, maxNameLen uint16, specName string) error {
	return a.store.CreateOverwrite(name, maxNameLen, specName)
}

// InputComponent добавляет компонент: name — имя, compType — "Product", "Unit" или "Part"
func (a *App) InputComponent(name string, compType string) error {
	return a.store.InputComponent(name, compType)
}

// InputAssembly добавляет сборку: componentName/assemblyName
func (a *App) InputAssembly(componentName string, assemblyName string) error {
	return a.store.InputAssembly(componentName, assemblyName)
}

// DeleteComponent логически удаляет компонент по имени
func (a *App) DeleteComponent(name string) error {
	return a.store.DeleteComponent(name)
}

// DeleteAssembly удаляет сборку из компонента
func (a *App) DeleteAssembly(componentName string, assemblyName string) error {
	return a.store.DeleteAssembly(componentName, assemblyName)
}

// RestoreComponent восстанавливает компонент и его спецификации
func (a *App) RestoreComponent(name string) error {
	return a.store.RestoreComponent(name)
}

// RestoreAll восстанавливает все удалённые записи
func (a *App) RestoreAll() error {
	return a.store.RestoreAll()
}

// Truncate физически удаляет помеченные записи (дефрагментация)
func (a *App) Truncate() error {
	return a.store.Truncate()
}

// PrintComponent возвращает дерево компонента в виде строки
func (a *App) PrintComponent(name string) (string, error) {
	var buf bytes.Buffer
	if err := a.store.PrintComponent(name, &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// PrintAll возвращает список всех компонентов (имя и тип)
func (a *App) PrintAll() (string, error) {
	var buf bytes.Buffer
	if err := a.store.PrintAll(&buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// Greet — пример метода для проверки связки (можно оставить или удалить)
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
