<template>
  <div class="signature-capture-page">
    <div class="signature-capture-page__inner" style="text-align: center">
      <div class="signature-capture-page__brand">
        <div class="signature-capture-page__brand-icon" aria-hidden="true">!</div>
        <h1 class="signature-capture-page__brand-title">Link unavailable</h1>
        <p class="signature-capture-page__brand-sub">
          This signing link is invalid or has been replaced. Ask an administrator to generate a new link.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.signature-capture-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: #0f172a;
}

.signature-capture-page__inner {
  width: 100%;
  max-width: 28rem;
}

.signature-capture-page__brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  margin-bottom: 0.75rem;
  border-radius: 1rem;
  background: rgb(239 68 68 / 20%);
  color: #f87171;
  font-size: 1.5rem;
  font-weight: 700;
}

.signature-capture-page__brand-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
}

.signature-capture-page__brand-sub {
  margin-top: 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #94a3b8;
}
</style>
