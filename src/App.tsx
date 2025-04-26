import React from 'react';
import './App.css';
import SphereScene from './components/system/SphereScene';
import Globe from './components/earth/Globe';


function App() {
  return (
    <div className="App">
      {/* <Globe/> */}
      <SphereScene />
    </div>
  );
}

export default App;
