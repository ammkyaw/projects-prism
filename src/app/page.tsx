'use client';

import { useRouter } from 'next/navigation';

const LandingPage = () => {
  const router = useRouter();

  const handlePrismButtonClick = () => {
    router.push('/prism');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold">Project Prism</h1>
      <p className="mt-3 text-xl">
        Welcome to Project Prism, your comprehensive project management tool.
      </p>
      <button
        onClick={handlePrismButtonClick}
        className="mt-6 px-6 py-3 text-lg font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
      >
        Prism
      </button>
    </div>
  );
};

export default LandingPage;