
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    https: {
      key: './key.pem',
      cert: './cert.pem'
    }
  },
})
