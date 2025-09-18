import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameSearch from '../components/GameSearch';
import { toast } from 'react-toastify';

const GameDatabase = () => {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState(null);

  const handleAddGame = useCallback(async (newGame) => {
    try {
      // Get existing games from localStorage
      const existingGames = JSON.parse(localStorage.getItem('gameTracker_games') || '[]');
      
      // Check if game already exists
      const gameExists = existingGames.some(game => game.id === newGame.id);
      
      if (gameExists) {
        toast.warning('This game is already in your library!');
        return { success: false, gameId: newGame.id };
      }
      
      // Add the new game
      const updatedGames = [...existingGames, newGame];
      localStorage.setItem('gameTracker_games', JSON.stringify(updatedGames));
      
      toast.success(`${newGame.title} has been added to your library!`);
      setSelectedGame(newGame);
      
      // Return success and the game ID for potential redirection
      return { success: true, gameId: newGame.id };
    } catch (error) {
      console.error('Error adding game:', error);
      toast.error('Failed to add game to library');
      return { success: false, error };
    }
  }, []);
  
  // Redirect to game details when a new game is added
  useEffect(() => {
    if (selectedGame) {
      // Navigate to the game details page
      navigate(`/game/${selectedGame.id}`);
    }
  }, [selectedGame, navigate]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Game Database</h1>
          <p className="text-gray-600">
            Search for games to track in your collection. Powered by RAWG.io
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <GameSearch onAddGame={handleAddGame} />
        </div>

        {selectedGame && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Selected Game</h2>
              <button
                onClick={async () => {
                  try {
                    // Format the game data to match our expected structure
                    const gameToAdd = {
                      id: `rawg-${selectedGame.id}`,
                      title: selectedGame.name,
                      platform: selectedGame.platforms?.map(p => p.platform.name).join(', ') || 'Unknown',
                      status: 'not_started',
                      progress: 0,
                      coverImage: selectedGame.background_image || '',
                      lastPlayed: new Date().toISOString(),
                      milestones: [],
                      notes: [],
                      rawgData: selectedGame
                    };
                    
                    handleAddGame(gameToAdd);
                  } catch (error) {
                    console.error('Error adding game:', error);
                    toast.error('Failed to add game to library');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Track This Game
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                {selectedGame.background_image && (
                  <img
                    src={selectedGame.background_image}
                    alt={selectedGame.name}
                    className="w-full h-auto rounded-lg shadow-md"
                  />
                )}
              </div>
              
              <div className="md:col-span-2">
                <h3 className="text-xl font-semibold mb-2">{selectedGame.name}</h3>
                <p className="text-gray-600 mb-4">
                  {selectedGame.released && `Released: ${selectedGame.released.split('-')[0]}`}
                </p>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-700 mb-1">Genres</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedGame.genres?.map((genre) => (
                      <span
                        key={genre.id}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-700 mb-1">Platforms</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedGame.platforms?.map(({ platform }) => (
                      <span
                        key={platform.id}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded"
                      >
                        {platform.name}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-700 mb-1">Rating</h4>
                  <div className="flex items-center">
                    <span className="text-yellow-500 text-xl mr-2">★</span>
                    <span className="font-medium">
                      {selectedGame.rating?.toFixed(1) || 'N/A'}
                      <span className="text-sm text-gray-500 ml-1">
                        ({selectedGame.ratings_count || 0} ratings)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {selectedGame.description && (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-700 mb-2">About</h4>
                <div 
                  className="prose max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: selectedGame.description }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameDatabase;
