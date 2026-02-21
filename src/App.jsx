import React from "react";
import { Outlet } from "react-router-dom";

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col text-gray-800 font-sans">
      {/* Page Content */}
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
