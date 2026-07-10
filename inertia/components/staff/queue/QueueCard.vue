<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    priority?: string | null
    theme?: 'default' | 'treatment'
  }>(),
  {
    priority: 'normal',
    theme: 'default',
  }
)

function priorityClass(priority: string | null | undefined) {
  const value = String(priority ?? 'normal').toLowerCase()
  if (value === 'stat') return 'queue-card--priority-stat'
  if (value === 'urgent') return 'queue-card--priority-urgent'
  if (value === 'low') return 'queue-card--priority-low'
  return 'queue-card--priority-normal'
}
</script>

<template>
  <article
    class="queue-card"
    :class="[
      priorityClass(props.priority),
      theme === 'treatment' ? 'queue-card--treatment' : '',
    ]"
  >
    <div class="queue-card-body">
      <div class="queue-card-main">
        <div class="queue-card-top">
          <div class="queue-card-ident">
            <slot name="ident" />
          </div>
          <div v-if="$slots.badges" class="queue-card-badges">
            <slot name="badges" />
          </div>
        </div>

        <div v-if="$slots.title" class="queue-card-title">
          <slot name="title" />
        </div>

        <div v-if="$slots.subtitle" class="queue-card-subtitle">
          <slot name="subtitle" />
        </div>

        <div v-if="$slots.details" class="queue-card-details">
          <slot name="details" />
        </div>

        <div v-if="$slots.meta" class="queue-card-meta">
          <slot name="meta" />
        </div>
      </div>

      <div v-if="$slots.action" class="queue-card-action">
        <slot name="action" />
      </div>
    </div>
  </article>
</template>
