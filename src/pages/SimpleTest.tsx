import React from 'react';

const SimpleTest = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">✅ App is Working!</h1>
        <p className="text-gray-600 mb-4">The React application is rendering correctly.</p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>• React components are loading</p>
          <p>• Tailwind CSS is working</p>
          <p>• TypeScript compilation is successful</p>
        </div>
      </div>
    </div>
  );
};

export default SimpleTest;
