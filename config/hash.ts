import { defineConfig, drivers } from '@adonisjs/core/hash'
import { LaravelBcryptDriver } from '../app/lib/laravel_bcrypt_driver.js'

const hashConfig = defineConfig({
  default: 'laravel_bcrypt',

  list: {
    scrypt: drivers.scrypt({
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
      maxMemory: 33554432,
    }),

    /**
     * Laravel-compatible bcrypt hasher. Used as the default so existing
     * staff/patient password hashes ($2y$...) verify without a reset.
     */
    laravel_bcrypt: () => new LaravelBcryptDriver(10),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
