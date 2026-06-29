import React from 'react'
import { createRoot } from 'react-dom/client'
import MusicHub from './components/lifeos/panels/MusicHub.jsx'
import './index.css'

createRoot(document.getElementById('music-root')).render(
  <MusicHub />
)
