from flask import Flask, request, jsonify
from flask_cors import CORS
import heapq
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow frontend to connect from different port

# ==========================================
# A* PATHFINDING ALGORITHM
# ==========================================

def manhattan_heuristic(a, b):
    """
    Manhattan distance heuristic for A* algorithm
    Perfect for grid-based movement (up, down, left, right only)
    """
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def get_neighbors(grid, current):
    """
    Get valid neighboring cells (4-directional movement)
    Returns list of (row, col) tuples
    """
    rows, cols = len(grid), len(grid[0])
    row, col = current
    neighbors = []
    
    # 4 directions: up, down, left, right
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    
    for dr, dc in directions:
        new_row, new_col = row + dr, col + dc
        
        # Check bounds and if cell is walkable (not obstacle)
        if (0 <= new_row < rows and 
            0 <= new_col < cols and 
            grid[new_row][new_col] != 1):
            neighbors.append((new_row, new_col))
    
    return neighbors


def astar_pathfinding(grid, start, end):
    """
    A* Pathfinding Algorithm
    
    Args:
        grid: 2D array where 0=walkable, 1=obstacle
        start: (row, col) tuple for start position
        end: (row, col) tuple for end position
    
    Returns:
        List of (row, col) coordinates forming the optimal path
        None if no path exists
    """
    
    # Priority queue: (f_score, counter, current_node)
    # Counter prevents comparison of tuples when f_scores are equal
    counter = 0
    open_set = [(0, counter, start)]
    counter += 1
    
    # Track where each node came from
    came_from = {}
    
    # g_score: cost from start to current node
    g_score = {start: 0}
    
    # f_score: g_score + heuristic (estimated total cost)
    f_score = {start: manhattan_heuristic(start, end)}
    
    # Track nodes in open set for faster lookup
    open_set_hash = {start}
    
    while open_set:
        # Get node with lowest f_score
        current_f, _, current = heapq.heappop(open_set)
        open_set_hash.discard(current)
        
        # Goal reached! Reconstruct path
        if current == end:
            path = []
            while current in came_from:
                path.append({"row": current[0], "col": current[1]})
                current = came_from[current]
            path.append({"row": start[0], "col": start[1]})
            path.reverse()
            return path
        
        # Explore neighbors
        for neighbor in get_neighbors(grid, current):
            # Cost to reach neighbor from start
            tentative_g_score = g_score[current] + 1
            
            # If this path to neighbor is better than any previous one
            if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                # Update path tracking
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                f_score[neighbor] = tentative_g_score + manhattan_heuristic(neighbor, end)
                
                # Add to open set if not already there
                if neighbor not in open_set_hash:
                    heapq.heappush(open_set, (f_score[neighbor], counter, neighbor))
                    counter += 1
                    open_set_hash.add(neighbor)
    
    # No path found
    return None


# ==========================================
# API ENDPOINTS
# ==========================================

@app.route('/')
def home():
    """API welcome endpoint"""
    return jsonify({
        "message": "🤖 VoiceRover Backend API",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "/": "API information",
            "/health": "Health check",
            "/pathfind": "POST - Calculate optimal path using A*"
        }
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for monitoring"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }), 200


@app.route('/pathfind', methods=['POST'])
def pathfind():
    """
    Pathfinding endpoint
    
    Expected JSON body:
    {
        "grid": [[0, 0, 1], [0, 0, 0], ...],  # 2D array
        "start": {"row": 0, "col": 0},
        "end": {"row": 10, "col": 10}
    }
    
    Returns:
    {
        "success": true,
        "path": [{"row": 0, "col": 0}, ...],
        "length": 15,
        "algorithm": "A*",
        "computation_time_ms": 5.2
    }
    """
    try:
        # Start timing
        start_time = datetime.now()
        
        # Parse request data
        data = request.json
        
        # Validate required fields
        if not data or 'grid' not in data or 'start' not in data or 'end' not in data:
            return jsonify({
                "success": False,
                "error": "Missing required fields: grid, start, end"
            }), 400
        
        grid = data['grid']
        start = (data['start']['row'], data['start']['col'])
        end = (data['end']['row'], data['end']['col'])
        
        # Validate grid
        if not grid or not isinstance(grid, list):
            return jsonify({
                "success": False,
                "error": "Invalid grid format"
            }), 400
        
        # Validate start and end positions
        rows, cols = len(grid), len(grid[0])
        if not (0 <= start[0] < rows and 0 <= start[1] < cols):
            return jsonify({
                "success": False,
                "error": "Start position out of bounds"
            }), 400
        
        if not (0 <= end[0] < rows and 0 <= end[1] < cols):
            return jsonify({
                "success": False,
                "error": "End position out of bounds"
            }), 400
        
        # Check if start or end is on an obstacle
        if grid[start[0]][start[1]] == 1:
            return jsonify({
                "success": False,
                "error": "Start position is on an obstacle"
            }), 400
        
        if grid[end[0]][end[1]] == 1:
            return jsonify({
                "success": False,
                "error": "End position is on an obstacle"
            }), 400
        
        # Run A* algorithm
        path = astar_pathfinding(grid, start, end)
        
        # Calculate computation time
        end_time = datetime.now()
        computation_time = (end_time - start_time).total_seconds() * 1000  # milliseconds
        
        if path:
            return jsonify({
                "success": True,
                "path": path,
                "length": len(path),
                "algorithm": "A* (A-Star)",
                "heuristic": "Manhattan Distance",
                "computation_time_ms": round(computation_time, 2)
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "No path found - destination unreachable",
                "computation_time_ms": round(computation_time, 2)
            }), 404
    
    except KeyError as e:
        return jsonify({
            "success": False,
            "error": f"Missing or invalid field: {str(e)}"
        }), 400
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500


# ==========================================
# RUN SERVER
# ==========================================

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 VoiceRover Backend Starting...")
    print("=" * 60)
    print("📡 API Server: http://localhost:5000")
    print("🔍 Health Check: http://localhost:5000/health")
    print("🗺️  Pathfinding: POST to http://localhost:5000/pathfind")
    print("=" * 60)
    print("⚡ Using A* Algorithm with Manhattan Distance Heuristic")
    print("=" * 60)
    
    app.run(debug=True, port=5000, host='0.0.0.0')