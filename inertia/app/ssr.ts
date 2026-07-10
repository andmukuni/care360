
import { createInertiaApp } from '@inertiajs/vue3'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h, type DefineComponent } from 'vue'
import NavigationSpinner from '~/components/ui/NavigationSpinner.vue'
import ToastContainer from '~/components/ui/ToastContainer.vue'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: renderToString,
    resolve: (name) => {
      const pages = import.meta.glob<DefineComponent>('../pages/**/*.vue', { eager: true })
      return pages[`../pages/${name}.vue`]
    },

    setup({ App, props, plugin }) {
      return createSSRApp({ render: () => [h(App, props), h(NavigationSpinner), h(ToastContainer)] }).use(plugin)
    },
  })
}