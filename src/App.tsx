// React is not needed as it's the new JSX transform
import GameCanvas from './components/GameCanvas';

function App() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw'
    }}>
      <GameCanvas />
    </main>
  );
}

export default App;
