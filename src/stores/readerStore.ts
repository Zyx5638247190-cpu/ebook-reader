import { create } from 'zustand'

interface ReaderState {
  currentBookId: string | null
  openBook: (bookId: string) => void
  closeBook: () => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentBookId: null,
  openBook: (bookId) => set({ currentBookId: bookId }),
  closeBook: () => set({ currentBookId: null }),
}))
