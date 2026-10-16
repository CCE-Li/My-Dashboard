import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ToastMessage } from '@/types/dashboard';

const TOAST_DURATION_MS = 2500;

export const useToastStore = defineStore('toast', () => {
  const messages = ref<ToastMessage[]>([]);
  let nextId = 1;

  function push(text: string): void {
    const id = nextId;
    nextId += 1;
    messages.value = [...messages.value, { id, text }];
    setTimeout(() => {
      messages.value = messages.value.filter((message) => message.id !== id);
    }, TOAST_DURATION_MS);
  }

  return { messages, push };
});
