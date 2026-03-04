import { useState, useEffect } from 'react';
import logo from './assets/images/logo-universal.png';
import './App.css';
import {
    Greet,
    Help,
    Open,
    Close,
    IsOpen,
    Create,
    CreateOverwrite,
    InputComponent,
    InputAssembly,
    DeleteComponent,
    DeleteAssembly,
    RestoreComponent,
    RestoreAll,
    Truncate,
    PrintComponent,
    PrintAll,
} from '../wailsjs/go/main/App';

const COMPONENT_TYPES = ['Product', 'Unit', 'Part'];

function App() {
    const [message, setMessageState] = useState({ text: '', isError: false });
    const [helpText, setHelpText] = useState('');
    const [fileOpen, setFileOpen] = useState(false);
    const [printOutput, setPrintOutput] = useState('');

    // Поля для операций с файлом
    const [createPath, setCreatePath] = useState('');
    const [createMaxLen, setCreateMaxLen] = useState('32');
    const [createSpec, setCreateSpec] = useState('');
    const [openPath, setOpenPath] = useState('');

    const [compName, setCompName] = useState('');
    const [compType, setCompType] = useState('Part');

    const [assemblyComponent, setAssemblyComponent] = useState('');
    const [assemblyName, setAssemblyName] = useState('');

    const [deleteCompName, setDeleteCompName] = useState('');

    const [deleteAssemblyComp, setDeleteAssemblyComp] = useState('');
    const [deleteAssemblyName, setDeleteAssemblyName] = useState('');

    const [restoreName, setRestoreName] = useState('');

    const [printName, setPrintName] = useState('');

    const refreshOpen = () => IsOpen().then(setFileOpen);

    useEffect(() => {
        refreshOpen();
    }, []);

    const msg = (text, isError = false) => setMessageState({ text, isError });

    function handleCreate() {
        const path = createPath.trim();
        if (!path) {
            msg('Введите имя файла (.prd)', true);
            return;
        }
        const maxLen = parseInt(createMaxLen, 10) || 32;
        Create(path, maxLen, createSpec.trim())
            .then(() => {
                msg('Файл создан: ' + (path.endsWith('.prd') ? path : path + '.prd'));
                refreshOpen();
            })
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleCreateOverwrite() {
        const path = createPath.trim();
        if (!path) {
            msg('Введите имя файла (.prd)', true);
            return;
        }
        const maxLen = parseInt(createMaxLen, 10) || 32;
        CreateOverwrite(path, maxLen, createSpec.trim())
            .then(() => {
                msg('Файл перезаписан: ' + (path.endsWith('.prd') ? path : path + '.prd'));
                refreshOpen();
            })
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleOpen() {
        const path = openPath.trim();
        if (!path) {
            msg('Введите путь к файлу.', true);
            return;
        }
        Open(path)
            .then(() => {
                msg('Файл открыт: ' + path);
                refreshOpen();
            })
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleClose() {
        Close()
            .then(() => {
                msg('Файл закрыт.');
                setFileOpen(false);
                setPrintOutput('');
            })
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleInputComponent() {
        const name = compName.trim();
        if (!name) {
            msg('Введите имя компонента.', true);
            return;
        }
        InputComponent(name, compType)
            .then(() => msg('Компонент добавлен: ' + name))
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleInputAssembly() {
        const comp = assemblyComponent.trim();
        const asm = assemblyName.trim();
        if (!comp || !asm) {
            msg('Введите имя компонента и имя сборки.', true);
            return;
        }
        InputAssembly(comp, asm)
            .then(() => msg('Сборка добавлена: ' + comp + ' → ' + asm))
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleDeleteComponent() {
        const name = deleteCompName.trim();
        if (!name) {
            msg('Введите имя компонента для удаления.', true);
            return;
        }
        DeleteComponent(name)
            .then(() => msg('Компонент удалён (логически): ' + name))
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleDeleteAssembly() {
        const comp = deleteAssemblyComp.trim();
        const asm = deleteAssemblyName.trim();
        if (!comp || !asm) {
            msg('Введите компонент и сборку.', true);
            return;
        }
        DeleteAssembly(comp, asm)
            .then(() => msg('Сборка удалена: ' + comp + ' / ' + asm))
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleRestoreComponent() {
        const name = restoreName.trim();
        if (!name) {
            msg('Введите имя компонента для восстановления.', true);
            return;
        }
        RestoreComponent(name)
            .then(() => msg('Компонент восстановлен: ' + name))
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleRestoreAll() {
        RestoreAll()
            .then(() => msg('Все удалённые записи восстановлены.'))
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    function handleTruncate() {
        Truncate()
            .then(() => {
                msg('Удалённые записи физически удалены (дефрагментация).');
                refreshOpen();
            })
            .catch((e) => msg('Ошибка: ' + e, true));
    }

    // --- Печать ---
    function handlePrintComponent() {
        const name = printName.trim();
        if (!name) {
            msg('Введите имя компонента для вывода дерева.', true);
            return;
        }
        PrintComponent(name)
            .then((out) => {
                setPrintOutput(out || '(пусто)');
                msg('Дерево компонента выведено.');
            })
            .catch((e) => {
                msg('Ошибка: ' + e, true);
                setPrintOutput('');
            });
    }

    function handlePrintAll() {
        PrintAll()
            .then((out) => {
                setPrintOutput(out || '(пусто)');
                msg('Список всех компонентов выведен.');
            })
            .catch((e) => {
                msg('Ошибка: ' + e, true);
                setPrintOutput('');
            });
    }

    function showHelp() {
        setHelpText('Загрузка…');
        Help()
            .then(setHelpText)
            .catch((e) => setHelpText('Ошибка: ' + e));
    }

    return (
        <div id="App">
            <img src={logo} id="logo" alt="logo" />
            <div className={`result ${message.isError ? 'error' : ''}`}>
                {fileOpen ? '✓ Файл открыт' : 'Файл не открыт'}
            </div>
            {message.text && (
                <div className={`status ${message.isError ? 'error' : ''}`}>{message.text}</div>
            )}

            <section className="section">
                <h3>Файл (.prd / .prs)</h3>
                <div className="input-row">
                    <input
                        className="input"
                        value={createPath}
                        onChange={(e) => setCreatePath(e.target.value)}
                        placeholder="Имя файла (например product.prd)"
                    />
                    <input
                        className="input input-short"
                        type="number"
                        min={1}
                        value={createMaxLen}
                        onChange={(e) => setCreateMaxLen(e.target.value)}
                        placeholder="Макс. длина имени"
                        title="Макс. длина имени"
                    />
                    <input
                        className="input input-short"
                        value={createSpec}
                        onChange={(e) => setCreateSpec(e.target.value)}
                        placeholder=".prs (необяз.)"
                    />
                </div>
                <div className="btn-row">
                    <button className="btn" onClick={handleCreate}>
                        Создать
                    </button>
                    <button className="btn" onClick={handleCreateOverwrite}>
                        Создать (перезапись)
                    </button>
                </div>
                <div className="input-box">
                    <input
                        className="input"
                        value={openPath}
                        onChange={(e) => setOpenPath(e.target.value)}
                        placeholder="Путь к существующему .prd"
                    />
                    <button className="btn" onClick={handleOpen}>
                        Открыть
                    </button>
                    <button className="btn" onClick={handleClose} disabled={!fileOpen}>
                        Закрыть
                    </button>
                </div>
            </section>

            <section className="section">
                <h3>Добавить компонент</h3>
                <p className="hint">Тип: Product, Unit, Part</p>
                <div className="input-box">
                    <input
                        className="input"
                        value={compName}
                        onChange={(e) => setCompName(e.target.value)}
                        placeholder="Имя компонента"
                    />
                    <select
                        className="input input-select"
                        value={compType}
                        onChange={(e) => setCompType(e.target.value)}
                    >
                        {COMPONENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                    <button className="btn" onClick={handleInputComponent} disabled={!fileOpen}>
                        Добавить
                    </button>
                </div>
            </section>

            {/* Связывание (сборка) */}
            <section className="section">
                <h3>Добавить сборку (связь компонент → сборка)</h3>
                <div className="input-box">
                    <input
                        className="input"
                        value={assemblyComponent}
                        onChange={(e) => setAssemblyComponent(e.target.value)}
                        placeholder="Компонент"
                    />
                    <input
                        className="input"
                        value={assemblyName}
                        onChange={(e) => setAssemblyName(e.target.value)}
                        placeholder="Сборка"
                    />
                    <button className="btn" onClick={handleInputAssembly} disabled={!fileOpen}>
                        Связать
                    </button>
                </div>
            </section>

            {/* Удаление */}
            <section className="section">
                <h3>Удаление (логическое)</h3>
                <div className="input-box">
                    <input
                        className="input"
                        value={deleteCompName}
                        onChange={(e) => setDeleteCompName(e.target.value)}
                        placeholder="Удалить компонент по имени"
                    />
                    <button className="btn" onClick={handleDeleteComponent} disabled={!fileOpen}>
                        Удалить компонент
                    </button>
                </div>
                <div className="input-box">
                    <input
                        className="input"
                        value={deleteAssemblyComp}
                        onChange={(e) => setDeleteAssemblyComp(e.target.value)}
                        placeholder="Компонент"
                    />
                    <input
                        className="input"
                        value={deleteAssemblyName}
                        onChange={(e) => setDeleteAssemblyName(e.target.value)}
                        placeholder="Сборка"
                    />
                    <button className="btn" onClick={handleDeleteAssembly} disabled={!fileOpen}>
                        Удалить сборку
                    </button>
                </div>
            </section>

            {/* Восстановление */}
            <section className="section">
                <h3>Восстановление</h3>
                <div className="input-box">
                    <input
                        className="input"
                        value={restoreName}
                        onChange={(e) => setRestoreName(e.target.value)}
                        placeholder="Имя компонента"
                    />
                    <button className="btn" onClick={handleRestoreComponent} disabled={!fileOpen}>
                        Восстановить
                    </button>
                    <button className="btn" onClick={handleRestoreAll} disabled={!fileOpen}>
                        Восстановить всё
                    </button>
                </div>
            </section>

            <section className="section">
                <h3>Усечение</h3>
                <p className="hint">Физически удалить помеченные записи (дефрагментация)</p>
                <button className="btn" onClick={handleTruncate} disabled={!fileOpen}>
                    Выполнить Truncate
                </button>
            </section>

            {/* Печать */}
            <section className="section">
                <h3>Печать</h3>
                <div className="input-box">
                    <input
                        className="input"
                        value={printName}
                        onChange={(e) => setPrintName(e.target.value)}
                        placeholder="Имя компонента для дерева"
                    />
                    <button className="btn" onClick={handlePrintComponent} disabled={!fileOpen}>
                        Дерево компонента
                    </button>
                    <button className="btn" onClick={handlePrintAll} disabled={!fileOpen}>
                        Все компоненты
                    </button>
                </div>
                {printOutput && (
                    <pre className="help-text print-output">{printOutput}</pre>
                )}
            </section>

            <section className="section">
                <h3>Справка</h3>
                <button className="btn" onClick={showHelp}>
                    Показать справку
                </button>
                {helpText && <pre className="help-text">{helpText}</pre>}
            </section>
        </div>
    );
}

export default App;
