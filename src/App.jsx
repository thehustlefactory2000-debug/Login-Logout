import React from "react";
import { Outlet } from "react-router-dom";

function App() {
  return (
    <div className="min-h-screen flex flex-col text-slate-800">
      <main className="flex-grow page-shell">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
