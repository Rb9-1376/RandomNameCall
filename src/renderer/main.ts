import { createApp } from 'vue'
import App from './App.vue'
import './styles/app.css'

if (location.hash.startsWith('#/ball')) {
  document.body.classList.add('ball-window')
}

createApp(App).mount('#app')
