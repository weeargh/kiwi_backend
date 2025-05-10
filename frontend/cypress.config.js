import { defineConfig } from "cypress";

export default defineConfig({
  projectId: '9kns3u',
  e2e: {
    baseUrl: 'http://localhost:8080', // Assuming default port
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
