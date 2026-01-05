<template>
  <div class="api-manager-component">
    <div class="api-header">
      <h2>API管理</h2>
      <p>管理您的视频源API</p>
    </div>
    
    <div v-if="apiLoading" class="api-loading">
      加载API列表中...
    </div>
    
    <div v-else-if="apiError" class="api-error">
      {{ apiError }}
    </div>
    
    <div v-else>
      <div class="api-list">
        <h3>可用API</h3>
        
        <div class="api-items">
          <div
            v-for="api in allApis"
            :key="api.id"
            class="api-item"
            :class="{ 'selected': selectedApi?.id === api.id }"
          >
            <div class="api-info">
              <h4>{{ api.name }}</h4>
              <p class="api-url">{{ api.url }}</p>
              <p class="api-type">{{ api.type === 'custom' ? '自定义API' : '内置API' }}</p>
            </div>
            
            <div class="api-actions">
              <button
                @click="selectApi(api.id)"
                class="select-btn"
                :class="{ 'active': selectedApi?.id === api.id }"
              >
                {{ selectedApi?.id === api.id ? '已选择' : '选择' }}
              </button>
              
              <button
                v-if="api.type === 'custom'"
                @click="removeApi(api.id)"
                class="remove-btn"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="add-api">
        <h3>添加自定义API</h3>
        <form @submit.prevent="addCustomApi" class="api-form">
          <div class="form-group">
            <label for="apiName">API名称</label>
            <input
              type="text"
              id="apiName"
              v-model="newApi.name"
              placeholder="输入API名称"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="apiUrl">API地址</label>
            <input
              type="url"
              id="apiUrl"
              v-model="newApi.url"
              placeholder="输入API地址（https://example.com）"
              required
            />
          </div>
          
          <button type="submit" :disabled="addingApi" class="submit-btn">
            <span v-if="addingApi">添加中...</span>
            <span v-else>添加API</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApiStore } from '../store/apiStore'

const apiStore = useApiStore()
const newApi = ref({ name: '', url: '' })
const addingApi = ref(false)

const apiLoading = computed(() => apiStore.apiLoading)
const apiError = computed(() => apiStore.apiError)
const allApis = computed(() => apiStore.allApis)
const selectedApi = computed(() => apiStore.selectedApi)

onMounted(() => {
  // 加载API列表
  apiStore.fetchApis()
  // 加载自定义API
  apiStore.loadCustomApis()
})

const selectApi = (apiId) => {
  apiStore.selectApi(apiId)
}

const addCustomApi = async () => {
  if (newApi.value.name.trim() && newApi.value.url.trim()) {
    addingApi.value = true
    
    try {
      // 创建自定义API对象
      const customApi = {
        id: `custom-${Date.now()}`,
        name: newApi.value.name.trim(),
        url: newApi.value.url.trim(),
        type: 'custom'
      }
      
      // 添加到store
      apiStore.addCustomApi(customApi)
      
      // 清空表单
      newApi.value = { name: '', url: '' }
    } catch (error) {
      console.error('添加自定义API失败:', error)
    } finally {
      addingApi.value = false
    }
  }
}

const removeApi = (apiId) => {
  if (confirm('确定要删除这个自定义API吗？')) {
    apiStore.removeCustomApi(apiId)
  }
}
</script>

<style scoped>
.api-manager-component {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.api-header h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.api-header p {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 2rem;
}

.api-loading, .api-error {
  padding: 20px;
  text-align: center;
  border-radius: 8px;
  margin-bottom: 20px;
}

.api-loading {
  background-color: #f3f4f6;
  color: #666;
}

.api-error {
  background-color: #fee2e2;
  color: #dc2626;
}

.api-list {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.api-list h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  font-size: 1.2rem;
}

.api-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
}

.api-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 15px;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}

.api-item:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}

.api-item.selected {
  border-color: #2563eb;
  background-color: #eff6ff;
}

.api-info h4 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 1.1rem;
}

.api-url {
  margin: 0 0 6px 0;
  color: #666;
  font-size: 0.9rem;
  word-break: break-all;
}

.api-type {
  margin: 0 0 12px 0;
  color: #888;
  font-size: 0.8rem;
}

.api-actions {
  margin-top: auto;
  display: flex;
  gap: 10px;
}

.select-btn, .remove-btn, .submit-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.select-btn {
  background-color: #e5e7eb;
  color: #333;
  flex: 1;
}

.select-btn:hover, .select-btn.active {
  background-color: #2563eb;
  color: white;
}

.remove-btn {
  background-color: #fee2e2;
  color: #dc2626;
}

.remove-btn:hover {
  background-color: #fecaca;
}

.add-api {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.add-api h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  font-size: 1.2rem;
}

.api-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #333;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.submit-btn {
  background-color: #2563eb;
  color: white;
  padding: 10px 20px;
  font-size: 1rem;
}

.submit-btn:hover {
  background-color: #1d4ed8;
}

.submit-btn:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .api-manager-component {
    padding: 10px;
  }
  
  .api-items {
    grid-template-columns: 1fr;
  }
  
  .api-actions {
    flex-direction: column;
  }
  
  .api-form {
    max-width: 100%;
  }
}
</style>
