<template>
  <div class="player-container">
    <player-component></player-component>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import PlayerComponent from '../components/PlayerComponent.vue'

onMounted(() => {
  // Initialize player logic here if needed
})
</script>

<style scoped>
.player-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
}

#player-wrapper {
  width: 100%;
  height: 60vh;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
}
</style>
