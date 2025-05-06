import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import PrimeVue from 'primevue/config';

// Import PrimeVue CSS (choose one theme)
// import 'primevue/resources/themes/lara-light-indigo/theme.css';   //theme
// import 'primevue/resources/themes/lara-dark-indigo/theme.css';   //dark theme
// import 'primevue/resources/themes/md-light-indigo/theme.css'; //material light
// import 'primevue/resources/themes/md-dark-indigo/theme.css'; //material dark
// import 'primevue/resources/themes/saga-blue/theme.css'; // SAGA theme
import 'primevue/resources/themes/arya-blue/theme.css'; // ARYA dark theme
import 'primevue/resources/primevue.min.css'; //core css
import 'primeicons/primeicons.css'; //icons

// Add PrimeVue Components globally here if needed, or import locally
// import Button from 'primevue/button';

const app = createApp(App);

app.use(PrimeVue, { ripple: true }); // Enable ripple effect globally

// app.component('Button', Button); // Example: Register Button globally

app.mount('#app');
