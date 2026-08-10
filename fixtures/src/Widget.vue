<script setup lang="ts">
import { ref } from 'vue'

const isActive = ref(false)
const size = ref<'sm' | 'lg'>('sm')
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-2">plain class attribute</div>

  <div
    class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm
      hover:border-slate-300 hover:shadow-md
      dark:border-slate-700 dark:bg-slate-900
      sm:p-8 md:p-10 lg:p-12
      grid grid-cols-1 gap-4
      transition-colors duration-200"
  >
    wrapped over several lines
  </div>

  <div :class="['flex gap-2', isActive ? 'ring-2 ring-brand-500' : 'ring-0']">array syntax</div>

  <div :class="{ 'bg-brand-500': isActive, 'text-white': isActive, 'opacity-50': !isActive }">
    object syntax — the keys are class strings, the conditions are not
  </div>

  <div v-bind:class="size === 'lg' ? 'h-12 px-6 text-lg' : 'h-8 px-3 text-sm'">v-bind</div>

  <div class="static" :class="'flex gap-2'">both a static and a bound class</div>
</template>

<style scoped>
.card {
  @apply rounded-lg border border-slate-200 bg-white p-6 shadow-sm;
}
</style>
