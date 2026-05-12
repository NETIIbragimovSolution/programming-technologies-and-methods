import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const defaultApiBase = () =>
  import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

function ts() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function joinServerPath(root, name) {
  if (!name) return root || '.'
  if (!root || root === '.') return name
  const sep = root.includes('\\') ? '\\' : '/'
  const base = /[/\\]$/.test(root) ? root : root + sep
  return `${base}${name}`
}

function parsePortString(s) {
  const n = Number.parseInt(s, 10)
  if (Number.isNaN(n)) throw new Error('Некорректный порт')
  return n
}

async function oneShot(host, port, path) {
  const res = await fetch(`${defaultApiBase()}/one-shot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, path }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function App() {
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('9000')
  const [connected, setConnected] = useState(false)
  const [drives, setDrives] = useState([])
  const [selectedDrive, setSelectedDrive] = useState('')
  const [entries, setEntries] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [selectedName, setSelectedName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [clientLog, setClientLog] = useState('')
  const [serverLog, setServerLog] = useState('')
  const [lastFilePreview, setLastFilePreview] = useState('')

  const clientLogRef = useRef(null)
  const serverLogRef = useRef(null)

  const appendClient = useCallback((line) => {
    setClientLog((prev) => `${prev}${ts()} ${line}\n`)
  }, [])

  const appendServer = useCallback((line) => {
    setServerLog((prev) => `${prev}${ts()} ${line}\n`)
  }, [])

  useEffect(() => {
    const el = clientLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [clientLog])

  useEffect(() => {
    const el = serverLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [serverLog])

  /** TCP one-shot + обновление списка и журналов (как в учебном примере). */
  const requestPath = useCallback(
    async (path, shortLabel) => {
      const p = parsePortString(port)
      appendClient(`Отправлен запрос «${shortLabel}» (${path})`)
      appendServer(`Сервер получил запрос по пути «${path}».`)
      let data
      try {
        data = await oneShot(host, p, path)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        appendClient(`Ошибка сети: ${msg}`)
        appendServer(`Ошибка при обработке: ${msg}`)
        throw e
      }
      const drv = Array.isArray(data.drives) ? data.drives : []
      setDrives(drv)
      const resp = data.response ?? {
        type: 'error',
        message: data.error ?? 'нет ответа',
      }

      if (resp.type === 'dir') {
        const list = resp.entries ?? []
        appendClient(
          `Получена структура каталога (${list.length} элементов): ${path}`
        )
        appendServer(
          `Отправлена структура каталога (${list.length} имён файлов и подкаталогов).`
        )
        setEntries(list)
        setCurrentPath(path)
        setLastFilePreview('')
      } else if (resp.type === 'file') {
        appendClient(
          `Получено содержимое текстового файла «${path}» (${(resp.content ?? '').length} симв.)`
        )
        appendServer(`Отправлено содержимое текстового файла «${path}».`)
        setLastFilePreview(resp.content ?? '')
        setEntries([])
      } else if (resp.type === 'error') {
        appendClient(`Ошибка: ${resp.message}`)
        appendServer(`Ошибка: ${resp.message}`)
        setLastFilePreview('')
      } else {
        appendClient(`Ответ: ${JSON.stringify(resp)}`)
        appendServer(`Отправлен ответ.`)
      }
      appendServer('Соединение с клиентом закрыто после обработки запроса.')
      return data
    },
    [appendClient, appendServer, host, port]
  )

  const handleConnect = async () => {
    setLoading(true)
    try {
      appendClient('Инициализация соединения с сервером…')
      appendServer('Сервер включён.')
      appendServer(`Клиент соединился с адреса ${host}.`)
      const data = await oneShot(host, parsePortString(port), '.')
      const drv = Array.isArray(data.drives) ? data.drives : []
      setDrives(drv)
      appendClient(`Получен список логических устройств: ${drv.join('; ')}`)
      appendServer('Передан список логических устройств клиенту.')
      const resp = data.response ?? {}
      if (resp.type === 'dir') {
        setEntries(resp.entries ?? [])
        setCurrentPath('.')
        appendClient(
          `Получена структура каталога песочницы (${(resp.entries ?? []).length} элементов).`
        )
        appendServer('Отправлена структура каталога для текущего каталога сервера.')
      } else {
        setEntries([])
        setCurrentPath('.')
      }
      if (drv.length) setSelectedDrive(drv[0])
      setConnected(true)
      appendServer('Соединение с клиентом закрыто после обработки запроса.')
    } catch (e) {
      appendClient(`Ошибка: ${e instanceof Error ? e.message : e}`)
      appendServer(`Ошибка: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = () => {
    appendClient('Клиент отключился.')
    appendServer('Сервер отключён клиентом (локально).')
    setConnected(false)
    setDrives([])
    setSelectedDrive('')
    setEntries([])
    setCurrentPath('')
    setSelectedName(null)
    setLastFilePreview('')
  }

  const handleDriveChange = async (drive) => {
    setSelectedDrive(drive)
    if (!connected || !drive) return
    setLoading(true)
    try {
      await requestPath(drive, 'смена диска')
    } catch (e) {
      appendClient(`Ошибка: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleListDoubleClick = async (entry) => {
    if (!connected || !entry.is_dir) return
    const next = joinServerPath(currentPath || selectedDrive || '.', entry.name)
    setLoading(true)
    try {
      await requestPath(next, 'переход в каталог')
    } catch (e) {
      appendClient(`Ошибка: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendToServer = async () => {
    if (!connected) return
    const base = currentPath || selectedDrive || '.'
    const path = selectedName ? joinServerPath(base, selectedName) : base
    setLoading(true)
    try {
      await requestPath(path, 'передать серверу')
    } catch (e) {
      appendClient(`Ошибка: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendToClient = async () => {
    if (!connected) return
    setLoading(true)
    try {
      if (lastFilePreview) {
        appendClient(
          '— содержимое файла (фрагмент) —\n' +
            lastFilePreview.slice(0, 1500) +
            (lastFilePreview.length > 1500 ? '\n…' : '')
        )
        appendServer('Повторная передача содержимого файла клиенту (журнал).')
        return
      }
      const path = currentPath || selectedDrive || '.'
      await requestPath(path, 'обновить список с сервера')
    } catch (e) {
      appendClient(`Ошибка: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExit = () => {
    handleDisconnect()
    setClientLog('')
    setServerLog('')
  }

  return (
    <div className="win-shell">
      <div className="win-titlebar">
        <span className="win-title">
          Программа для обмена данными между компьютерами
        </span>
      </div>

      <div className="win-main">
        <aside className="win-left">
          <label className="win-label">Логический диск</label>
          <select
            className="win-combo"
            value={selectedDrive}
            disabled={!connected || loading}
            onChange={(e) => void handleDriveChange(e.target.value)}
          >
            {!drives.length ? (
              <option value="">— не подключено —</option>
            ) : (
              drives.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))
            )}
          </select>

          <div
            className="win-listbox"
            role="listbox"
            aria-label="Содержимое каталога"
          >
            {entries.map((e) => (
              <div
                key={e.name}
                role="option"
                aria-selected={selectedName === e.name}
                className={
                  'win-list-item' +
                  (selectedName === e.name ? ' win-list-item--active' : '')
                }
                onClick={() => setSelectedName(e.name)}
                onDoubleClick={() => void handleListDoubleClick(e)}
              >
                {e.is_dir ? `[${e.name}]` : e.name}
              </div>
            ))}
          </div>

          <div className="win-ip-row">
            <label className="win-label-inline">IP-адрес</label>
            <input
              className="win-input win-input--ip"
              value={host}
              disabled={connected}
              onChange={(e) => setHost(e.target.value)}
            />
            <button
              type="button"
              className="win-btn win-btn--small"
              disabled={!connected}
              onClick={handleDisconnect}
            >
              Сервер отключить
            </button>
          </div>
          <div className="win-ip-row win-ip-row--port">
            <label className="win-label-inline">Порт</label>
            <input
              className="win-input win-input--port"
              value={port}
              disabled={connected}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
            />
          </div>

          <div className="win-btn-row">
            <button
              type="button"
              className="win-btn"
              disabled={connected || loading}
              onClick={() => void handleConnect()}
            >
              Соединиться
            </button>
            <button
              type="button"
              className="win-btn"
              disabled={!connected || loading}
              onClick={handleDisconnect}
            >
              Отключиться
            </button>
            <button type="button" className="win-btn" onClick={handleExit}>
              Выход
            </button>
          </div>

          <div className="win-bottom-btns">
            <button
              type="button"
              className="win-btn win-btn--wide"
              disabled={!connected || loading}
              onClick={() => void handleSendToServer()}
            >
              Передать серверу
            </button>
            <button
              type="button"
              className="win-btn win-btn--wide"
              disabled={!connected || loading}
              onClick={() => void handleSendToClient()}
            >
              Передать клиенту
            </button>
          </div>
          <p className="win-hint">
            Двойной щелчок по каталогу в списке — открыть. Убедитесь, что TCP-сервер
            запущен (порт как у сервера).
          </p>
        </aside>

        <section className="win-log win-log--client">
          <div className="win-log-title">Клиентская сторона</div>
          <textarea
            ref={clientLogRef}
            readOnly
            className="win-textarea"
            value={clientLog}
            spellCheck={false}
          />
        </section>

        <section className="win-log win-log--server">
          <div className="win-log-title">Серверная сторона</div>
          <textarea
            ref={serverLogRef}
            readOnly
            className="win-textarea"
            value={serverLog}
            spellCheck={false}
          />
        </section>
      </div>
    </div>
  )
}

export default App
