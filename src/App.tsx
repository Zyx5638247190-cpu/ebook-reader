import Bookshelf from './pages/Bookshelf'
import Reader from './pages/Reader'
import { useReaderStore } from './stores/readerStore'

export default function App() {
  const currentBookId = useReaderStore((state) => state.currentBookId)

  return currentBookId ? <Reader bookId={currentBookId} /> : <Bookshelf />
}
