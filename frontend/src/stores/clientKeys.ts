import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clientKeysApi, type ClientKey, type CreateClientKeyRequest } from '@/api'

export const useClientKeysStore = defineStore('clientKeys', () => {
  const clientKeys = ref<ClientKey[]>([])
  const currentClientKey = ref<ClientKey | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchClientKeys = async () => {
    try {
      loading.value = true
      error.value = null
      const response = await clientKeysApi.list()
      clientKeys.value = response.items
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load client keys'
      console.error('Failed to fetch client keys:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchClientKey = async (id: number) => {
    try {
      currentClientKey.value = await clientKeysApi.get(id)
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to load client key'
      console.error('Failed to fetch client key:', err)
    }
  }

  const createClientKey = async (clientKey: CreateClientKeyRequest) => {
    try {
      const newKey = await clientKeysApi.create(clientKey)
      clientKeys.value.push(newKey)
      return newKey
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to create client key'
      console.error('Failed to create client key:', err)
      throw new Error(errorMsg)
    }
  }

  const updateClientKey = async (id: number, clientKey: Partial<CreateClientKeyRequest>) => {
    try {
      const updated = await clientKeysApi.update(id, clientKey)
      const index = clientKeys.value.findIndex(k => k.id === id)
      if (index !== -1) {
        clientKeys.value[index] = updated
      }
      return updated
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update client key'
      console.error('Failed to update client key:', err)
      throw new Error(errorMsg)
    }
  }

  const deleteClientKey = async (id: number) => {
    try {
      await clientKeysApi.delete(id)
      clientKeys.value = clientKeys.value.filter(k => k.id !== id)
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to delete client key'
      console.error('Failed to delete client key:', err)
      throw new Error(errorMsg)
    }
  }

  return {
    clientKeys,
    currentClientKey,
    loading,
    error,
    fetchClientKeys,
    fetchClientKey,
    createClientKey,
    updateClientKey,
    deleteClientKey
  }
})
