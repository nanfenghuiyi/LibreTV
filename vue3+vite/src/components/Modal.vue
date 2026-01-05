<template>
  <ModalComponent v-bind="$attrs" v-on="$listeners">
    <slot></slot>
    <slot name="footer"></slot>
  </ModalComponent>
</template>

<script setup>
import ModalComponent from './ModalComponent.vue'
</script>