<template>
  <div class="watch-container">
    <player-component></player-component>
  </div>
</template>

<script setup>
import PlayerComponent from '../components/PlayerComponent.vue'
</script>

<style scoped>
.watch-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
</style>
