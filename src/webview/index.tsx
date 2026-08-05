import { createRoot } from 'react-dom/client'
import { App } from './App'

declare function acquireVsCodeApi(): { postMessage(m: unknown): void }

const vscode = acquireVsCodeApi()
const container = document.getElementById('root')
if (container !== null) createRoot(container).render(<App vscode={vscode} />)
