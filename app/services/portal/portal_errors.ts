import { Exception } from '@adonisjs/core/exceptions'

/**
 * HTTP-aware abort helpers mirroring Laravel's abort()/abort_if()/abort_unless().
 * The portal services throw these so controllers surface the same 403/404/422
 * responses the Laravel app returned.
 */
export function abort(status: number, message?: string): never {
  throw new Exception(message ?? httpMessage(status), {
    status,
    code: `E_HTTP_${status}`,
  })
}

export function abortIf(condition: unknown, status: number, message?: string): void {
  if (condition) {
    abort(status, message)
  }
}

export function abortUnless(condition: unknown, status: number, message?: string): void {
  if (!condition) {
    abort(status, message)
  }
}

function httpMessage(status: number): string {
  switch (status) {
    case 403:
      return 'This action is unauthorized.'
    case 404:
      return 'Not found.'
    case 422:
      return 'The given data was invalid.'
    default:
      return 'Request failed.'
  }
}
