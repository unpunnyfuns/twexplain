<script lang="ts">
  let isActive = $state(false)
  let extra = $state('px-4')
</script>

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

<div class={isActive ? 'ring-2 ring-brand-500' : 'ring-0'}>expression</div>

<div class={`flex gap-2 ${extra} py-2`}>template literal</div>

<div class="rounded-md p-4" class:bg-brand-500={isActive} class:opacity-50={!isActive}>
  class: directives
</div>

<style>
  .card {
    @apply rounded-lg border border-slate-200 bg-white p-6 shadow-sm;
  }
</style>
