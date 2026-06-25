<template>
  <div id="app">
    <h1>Token Gate Frontend</h1>
    <p>Current theme: {{ theme }}</p>
    <button @click="toggleTheme">Toggle Theme</button>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from './composables/useTheme'

const { theme, toggleTheme } = useTheme()
</script>

<style>
#app {
  padding: 2rem;
}

button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--accent-primary);
  color: white;
  border-radius: var(--radius-md);
}
</style>
