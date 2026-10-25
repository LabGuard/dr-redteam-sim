import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Hud } from './ui/Hud'
import './styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><Hud /></StrictMode>)
