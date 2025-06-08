// src/App.tsx
import FolderProcessorApp from './FolderProcessor';

// No need to import App.css anymore

function App() {
  return (
    // Set a base theme class on the root element
    <div className="dark"> 
      <FolderProcessorApp />
    </div>
  );
}

export default App;