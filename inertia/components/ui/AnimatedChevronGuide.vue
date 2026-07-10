<template>
  <div class="animated-chevron-guide" aria-hidden="true">
    <svg
      v-for="i in 2"
      :key="i"
      class="animated-chevron-guide__icon"
      :style="{ animationDelay: `${(i - 1) * 1}s` }"
      viewBox="0 0 28 16"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2 2l6 6-6 6" />
      <path d="M10 2l6 6-6 6" />
      <path d="M18 2l6 6-6 6" />
    </svg>
  </div>
</template>

<style scoped>
.animated-chevron-guide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.animated-chevron-guide__icon {
  position: absolute;
  top: 50%;
  left: 0;
  width: 40px;
  height: 22px;
  color: #525252;
  transform: translateY(-50%);
  animation: chevron-travel 2s ease-in-out infinite;
  will-change: left, opacity;
}

:global(.dark) .animated-chevron-guide__icon {
  color: #d4d4d4;
}

@keyframes chevron-travel {
  0% {
    left: 8px;
    opacity: 0.35;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: calc(100% - 48px);
    opacity: 0.35;
  }
}
</style>
