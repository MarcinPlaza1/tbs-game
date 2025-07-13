function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-game-accent mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">Loading...</h2>
        <p className="text-gray-400">Checking authentication status</p>
      </div>
    </div>
  );
}

export default LoadingScreen; 