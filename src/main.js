import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistPlugin } from './stores/plugins/persist.js'
import App from './App.vue'
import './styles/main.scss'

const app = createApp(App)
const pinia = createPinia()
pinia.use(createPersistPlugin())

app.use(pinia)
app.mount('#app')
