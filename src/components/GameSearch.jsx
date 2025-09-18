import { useState, useCallback } from 'react';
import useRawg from '../hooks/useRawg';

const GameSearch = ({ onGameSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const { loading, error, searchGames, getGameDetails } = useRawg();

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    try {
      const results = await searchGames(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, [searchQuery, searchGames]);

  const handleGameSelect = useCallback(async (game) => {
    try {
      const details = await getGameDetails(game.id);
      setSelectedGame({
        ...game,
        ...details
      });
      setShowDetails(true);
      
      // Pass the selected game to the parent component if needed
      if (onGameSelect) {
        onGameSelect({
          ...game,
          ...details
        });
      }
    } catch (err) {
      console.error('Failed to fetch game details:', err);
    }
  }, [getGameDetails, onGameSelect]);

  return (
    <div className="game-search-container p-4 bg-gray-50 rounded-lg shadow">
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a game..."
            className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 mb-4 text-red-700 bg-red-100 border border-red-300 rounded">
          {error}
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="search-results mb-6">
          <h3 className="text-lg font-semibold mb-2">Search Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {searchResults.map((game) => (
              <div
                key={game.id}
                onClick={() => handleGameSelect(game)}
                className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {game.background_image && (
                    <img
                      src={game.background_image}
                      alt={game.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div>
                    <h4 className="font-medium">{game.name}</h4>
                    <p className="text-sm text-gray-600">
                      {game.released?.split('-')[0] || 'N/A'}
                      {game.genres?.length > 0 && ` • ${game.genres[0].name}`}
                    </p>
                    <div className="flex items-center mt-1">
                      {game.rating && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                          ★ {game.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedGame && showDetails && (
        <div className="game-details mt-6 p-4 bg-white rounded-lg shadow">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold">{selectedGame.name}</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {selectedGame.background_image && (
                <img
                  src={selectedGame.background_image}
                  alt={selectedGame.name}
                  className="w-full h-64 object-cover rounded-lg mb-4"
                />
              )}
              
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: selectedGame.description }} />
              </div>
              
              <div className="mt-4 flex flex-wrap gap-2">
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
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700">Release Date</h4>
                <p>{selectedGame.released || 'N/A'}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700">Platforms</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedGame.platforms?.map(({ platform }) => (
                    <span
                      key={platform.id}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded"
                    >
                      {platform.name}
                    </span>
                  )) || 'N/A'}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700">Developers</h4>
                <p>{selectedGame.developers?.map(d => d.name).join(', ') || 'N/A'}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700">Publishers</h4>
                <p>{selectedGame.publishers?.map(p => p.name).join(', ') || 'N/A'}</p>
              </div>
              
              {selectedGame.website && (
                <div>
                  <h4 className="font-semibold text-gray-700">Website</h4>
                  <a
                    href={selectedGame.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {selectedGame.website}
                  </a>
                </div>
              )}
              
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-gray-700 mb-2">Rating</h4>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">
                    {selectedGame.rating?.toFixed(1) || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">
                    based on {selectedGame.ratings_count || 0} ratings
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameSearch;
