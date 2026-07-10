import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useLiveQueueRefresh } from '~/composables/useLiveQueueRefresh'

export type QueueTab = 'waiting' | 'progress' | 'partially_dispensed' | 'closed'

export type QueuePaginatorMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const STAGE_BY_QUEUE_PATH: Record<string, string> = {
  '/triage/queue': 'triage',
  '/lab/queue': 'lab',
  '/screening/queue': 'screening',
  '/screening-review/queue': 'screening_review',
  '/pharmacy/queue': 'pharmacy',
  '/treatment-room/queue': 'treatment_room',
}

function queueStageForPath(basePath: string): string {
  const stage = STAGE_BY_QUEUE_PATH[basePath]
  if (!stage) {
    throw new Error(`Unknown queue path: ${basePath}`)
  }
  return stage
}

export function useStageQueue(
  basePath: string,
  options?: {
    pollOnly?: string[]
  }
) {
  useLiveQueueRefresh({
    stages: [queueStageForPath(basePath)],
    only: options?.pollOnly ?? ['queued', 'inProgress'],
  })

  const tab = ref<QueueTab>('waiting')
  const receivingId = ref<number | null>(null)

  function queueUrl(
    pageParam: 'queued_page' | 'progress_page' | 'partially_dispensed_page' | 'closed_page',
    page: number,
    props: {
      queued: { meta: QueuePaginatorMeta }
      inProgress: { meta: QueuePaginatorMeta }
      partiallyDispensed?: { meta: QueuePaginatorMeta }
      closedEncounters?: { meta: QueuePaginatorMeta }
      extraParams?: Record<string, string>
    }
  ) {
    const params = new URLSearchParams()
    params.set('queued_page', String(pageParam === 'queued_page' ? page : props.queued.meta.current_page))
    params.set(
      'progress_page',
      String(pageParam === 'progress_page' ? page : props.inProgress.meta.current_page)
    )
    if (props.partiallyDispensed) {
      params.set(
        'partially_dispensed_page',
        String(
          pageParam === 'partially_dispensed_page'
            ? page
            : props.partiallyDispensed.meta.current_page
        )
      )
    }
    if (props.closedEncounters) {
      params.set(
        'closed_page',
        String(pageParam === 'closed_page' ? page : props.closedEncounters.meta.current_page)
      )
    }
    if (props.extraParams) {
      for (const [key, value] of Object.entries(props.extraParams)) {
        if (value !== '') params.set(key, value)
      }
    }
    return `${basePath}?${params.toString()}`
  }

  function receive(receivePath: string, id: number) {
    receivingId.value = id
    router.post(
      receivePath.replace(':id', String(id)),
      {},
      {
        onFinish: () => {
          receivingId.value = null
        },
      }
    )
  }

  return {
    tab,
    receivingId,
    queueUrl,
    receive,
  }
}
