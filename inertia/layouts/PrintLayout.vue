<template>
  <div class="print-layout-screen min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100 print:min-h-0 print:bg-white print:text-black">
    <slot />
  </div>
</template>

<style>
@media print {
  @page {
    margin: 12mm;
  }

  body,
  .print-layout-screen {
    background: #fff !important;
    color: #000 !important;
  }
}
</style>
