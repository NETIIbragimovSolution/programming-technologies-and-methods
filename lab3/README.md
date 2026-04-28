# Лабораторная работа №3 (только DLL)

Выполнено с использованием **исключительно DLL**:

- `lab3/MenuLib` -> `MenuLib.dll` (класс `MenuManager`)
- `lab3/AuthLib` -> `AuthLib.dll` (класс `AuthorizationManager`)
- `lab3/TestAppStatic` -> тест с обычной ссылкой на DLL
- `lab3/TestAppDynamic` -> тест с динамической загрузкой DLL через reflection

## Структура файлов

- `menu.txt` — иерархия меню
- `users.txt` — пользователи и статусы пунктов
- `Lab3Dll.sln` — решение

## Формат menu.txt

`<уровень> <название_пункта> [0] <имя_метода|0>`

- `0` перед методом можно использовать как разделитель (как в вашем примере).
- если метод `0`, пункт считается контейнером подменю.

## Формат users.txt

```
#Имя Пароль
Название пункта Статус
```

Статус:

- `0` — виден и доступен
- `1` — виден, но недоступен
- `2` — не виден

Если пункт отсутствует у пользователя, используется статус `0`.

## Сборка

```bash
dotnet build Lab3Dll.sln
```

## Запуск

Статическая ссылка на DLL:

```bash
dotnet run --project lab3/TestAppStatic/TestAppStatic.csproj
```

Динамическая загрузка DLL:

```bash
dotnet run --project lab3/TestAppDynamic/TestAppDynamic.csproj
```
