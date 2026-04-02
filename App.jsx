import { useState, useEffect, useRef } from "react";
import {
  Mic,
  Play,
  RotateCcw,
  Timer,
  Target,
  Navigation,
  Wifi,
  WifiOff,
} from "lucide-react";
import axios from "axios";
import "./App.css";

const BACKEND_URL = "http://localhost:5000";

// Predefined locations for voice commands
const LOCATIONS = {
  pharmacy: { row: 2, col: 18 },
  icu: { row: 18, col: 18 },
  lab: { row: 18, col: 2 },
  entrance: { row: 2, col: 2 },
  loading: { row: 10, col: 18 },
  storage: { row: 10, col: 2 },
  emergency: { row: 15, col: 10 },
  cafeteria: { row: 5, col: 10 },
};

const SCENARIOS = {
  hospital: {
    name: "Hospital Ward",
    icon: "🏥",
    description: "Navigate sterile wards safely",
    bgClass: "bg-hospital",
    gradient: "gradient-blue",
    robotColor: "robot-blue",
    pathColor: "path-blue",
    locations: ["pharmacy", "icu", "lab", "entrance", "emergency"],
  },
  warehouse: {
    name: "Smart Warehouse",
    icon: "📦",
    description: "Optimize inventory logistics",
    bgClass: "bg-warehouse",
    gradient: "gradient-orange",
    robotColor: "robot-orange",
    pathColor: "path-orange",
    locations: ["loading", "storage", "entrance", "cafeteria"],
  },
  disaster: {
    name: "Disaster Zone",
    icon: "🔥",
    description: "Reach survivors through rubble",
    bgClass: "bg-disaster",
    gradient: "gradient-red",
    robotColor: "robot-red",
    pathColor: "path-red",
    locations: ["entrance", "emergency", "icu"],
  },
};

function App() {
  const moveIntervalRef = useRef(null);
  const wasMovingRef = useRef(false);

  // Screen state
  const [screen, setScreen] = useState("menu");
  const [scenario, setScenario] = useState(null);

  // Grid state
  const [gridSize] = useState(20);
  const [grid, setGrid] = useState([]);
  const [robotPos, setRobotPos] = useState({ row: 10, col: 10 });
  const [targetPos, setTargetPos] = useState(null);
  const [path, setPath] = useState([]);

  // Animation state
  const [isMoving, setIsMoving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Game state
  const [timer, setTimer] = useState(180);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("");
  const [missions, setMissions] = useState(0);

  // Backend state
  const [backendConnected, setBackendConnected] = useState(false);
  const [computationTime, setComputationTime] = useState(null);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // ==========================================
  // BACKEND CONNECTION CHECK
  // ==========================================

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/health`, {
          timeout: 2000,
        });
        if (response.data.status === "healthy") {
          setBackendConnected(true);
        }
      } catch (error) {
        setBackendConnected(false);
        console.log("Backend not available - using client-side fallback");
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // GRID INITIALIZATION
  // ==========================================

  useEffect(() => {
    const newGrid = Array(gridSize)
      .fill(0)
      .map(() => Array(gridSize).fill(0));
    setGrid(newGrid);
  }, [gridSize]);

  // Clean up the interval if the component unmounts
  useEffect(() => {
    return () => {
      if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
    };
  }, []);

  // ==========================================
  // TIMER
  // ==========================================

  useEffect(() => {
    if (screen === "game" && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else if (timer === 0) {
      showMessage("⏰ Time's up! Mission failed.", "error");
      setTimeout(() => setScreen("menu"), 3000);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, timer]);

  // ==========================================
  // VOICE RECOGNITION
  // ==========================================

  useEffect(() => {
    if ("webkitSpeechRecognition" in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript.toLowerCase();
        setTranscript(text);
        processVoiceCommand(text);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        showMessage("❌ Voice recognition failed. Try again.", "error");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Web Speech API not supported in this browser");
    }
  }, [scenario]);

  // ==========================================
  // VOICE COMMAND PROCESSING
  // ==========================================

  const processVoiceCommand = (command) => {
    console.log("Processing command:", command);

    // Normalize command - remove extra words
    const normalizedCommand = command.toLowerCase().trim();
    let destination = null;

    // Check for each location keyword in the command
    for (const [locationKey, coords] of Object.entries(LOCATIONS)) {
      if (normalizedCommand.includes(locationKey)) {
        destination = locationKey;
        break;
      }
    }

    console.log("Detected destination:", destination);
    console.log("Current scenario:", scenario);
    console.log("Available locations:", SCENARIOS[scenario]?.locations);

    if (destination && scenario) {
      if (SCENARIOS[scenario].locations.includes(destination)) {
        console.log("Setting target to:", LOCATIONS[destination]);
        setTargetPos(LOCATIONS[destination]);
        showMessage(
          `🎯 Navigating to ${destination.toUpperCase()}...`,
          "success",
        );
      } else {
        const availableList = SCENARIOS[scenario].locations.join(", ");
        showMessage(
          `❌ "${destination}" not available. Try: ${availableList}`,
          "error",
        );
      }
    } else if (!destination) {
      const availableList = SCENARIOS[scenario].locations.join(", ");
      showMessage(
        `❓ Location not recognized. Available: ${availableList}`,
        "warning",
      );
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      showMessage("❌ Voice recognition not supported", "error");
      return;
    }

    if (!isListening) {
      setIsListening(true);
      setTranscript("🎤 Listening...");
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting recognition:", error);
        setIsListening(false);
        showMessage("❌ Could not start voice recognition", "error");
      }
    }
  };

  // ==========================================
  // PATHFINDING
  // ==========================================

  // Client-side A* fallback
  const clientSidePathfinding = (start, end) => {
    const heuristic = (a, b) =>
      Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const key = (node) => `${node.row},${node.col}`;

    gScore.set(key(start), 0);
    fScore.set(key(start), heuristic(start, end));

    while (openSet.length > 0) {
      openSet.sort(
        (a, b) =>
          (fScore.get(key(a)) || Infinity) - (fScore.get(key(b)) || Infinity),
      );
      const current = openSet.shift();

      if (current.row === end.row && current.col === end.col) {
        const path = [current];
        let curr = current;
        while (cameFrom.has(key(curr))) {
          curr = cameFrom.get(key(curr));
          path.unshift(curr);
        }
        return path;
      }

      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of directions) {
        const neighbor = { row: current.row + dr, col: current.col + dc };

        if (
          neighbor.row >= 0 &&
          neighbor.row < gridSize &&
          neighbor.col >= 0 &&
          neighbor.col < gridSize &&
          grid[neighbor.row][neighbor.col] !== 1
        ) {
          const tentativeG = (gScore.get(key(current)) || Infinity) + 1;

          if (tentativeG < (gScore.get(key(neighbor)) || Infinity)) {
            cameFrom.set(key(neighbor), current);
            gScore.set(key(neighbor), tentativeG);
            fScore.set(key(neighbor), tentativeG + heuristic(neighbor, end));

            if (
              !openSet.some(
                (n) => n.row === neighbor.row && n.col === neighbor.col,
              )
            ) {
              openSet.push(neighbor);
            }
          }
        }
      }
    }
    return null;
  };

  const calculatePath = async () => {
    if (!targetPos) return;

    setIsCalculating(true);
    const startTime = Date.now();

    console.log("=== PATHFINDING DEBUG ===");
    console.log("Robot Position:", robotPos);
    console.log("Target Position:", targetPos);
    console.log("Grid size:", grid.length, "x", grid[0]?.length);
    console.log("Backend connected:", backendConnected);

    try {
      if (backendConnected) {
        // Use Flask backend API
        console.log("Sending request to backend...");
        const response = await axios.post(
          `${BACKEND_URL}/pathfind`,
          {
            grid: grid,
            start: robotPos,
            end: targetPos,
          },
          { timeout: 5000 },
        );

        console.log("Backend response:", response.data);

        if (response.data.success && response.data.path) {
          console.log("Path found:", response.data.path.length, "steps");
          setPath(response.data.path);
          setComputationTime(response.data.computation_time_ms);
          showMessage(
            `✅ Path calculated! ${response.data.path.length} steps (${response.data.computation_time_ms.toFixed(1)}ms)`,
            "success",
          );
        } else {
          console.error("No path found by backend");
          wasMovingRef.current = false;
          showMessage(
            "❌ No path available - destination unreachable!",
            "error",
          );
          setPath([]);
        }
      } else {
        // Fallback to client-side
        console.log("Using client-side pathfinding...");
        const newPath = clientSidePathfinding(robotPos, targetPos);
        const endTime = Date.now();
        const compTime = endTime - startTime;

        console.log(
          "Client-side result:",
          newPath ? newPath.length + " steps" : "No path",
        );

        if (newPath && newPath.length > 0) {
          setPath(newPath);
          setComputationTime(compTime);
          showMessage(
            `✅ Path calculated! ${newPath.length} steps (Client: ${compTime}ms)`,
            "success",
          );
        } else {
          console.error("No path found by client-side algorithm");
          wasMovingRef.current = false;
          showMessage(
            "❌ No path available - destination unreachable!",
            "error",
          );
          setPath([]);
        }
      }
    } catch (error) {
      console.error("Pathfinding error:", error);
      console.log("Falling back to client-side...");

      // Fallback to client-side on error
      const newPath = clientSidePathfinding(robotPos, targetPos);
      const endTime = Date.now();
      const compTime = endTime - startTime;

      if (newPath && newPath.length > 0) {
        setPath(newPath);
        setComputationTime(compTime);
        showMessage(
          `⚠️ Using fallback pathfinding: ${newPath.length} steps (${compTime}ms)`,
          "warning",
        );
      } else {
        console.error("Fallback also failed");
        wasMovingRef.current = false;
        showMessage("❌ Pathfinding failed completely", "error");
        setPath([]);
      }
    } finally {
      setIsCalculating(false);
      console.log("=== END DEBUG ===");
    }
  };

  // Auto-calculate path when target changes or grid updates
  useEffect(() => {
    if (targetPos && !isMoving) {
      calculatePath();
    }
  }, [targetPos, grid, robotPos]);

  // Auto-resume movement if interrupted by dynamic obstacle placement
  useEffect(() => {
    if (path.length > 0 && wasMovingRef.current) {
      wasMovingRef.current = false;
      moveRobot();
    }
  }, [path]);

  // ==========================================
  // ROBOT MOVEMENT
  // ==========================================

  const moveRobot = () => {
    if (path.length === 0 || isMoving) return;

    setIsMoving(true);
    let step = 0;

    // If path recalculation starts exactly on the robot, skip step 0 to prevent a visual stutter
    if (
      path.length > 0 &&
      path[0].row === robotPos.row &&
      path[0].col === robotPos.col
    ) {
      step = 1;
    }

    moveIntervalRef.current = setInterval(() => {
      if (step < path.length) {
        setRobotPos(path[step]);
        step++;
      } else {
        clearInterval(moveIntervalRef.current);
        setIsMoving(false);

        // Mission complete
        const points = 100 + Math.floor(timer / 2);
        setScore((s) => s + points);
        setMissions((m) => m + 1);
        showMessage(`🎉 Destination reached! +${points} points`, "success");

        // Reset for next mission
        setPath([]);
        setTargetPos(null);
        setTranscript("");
      }
    }, 600);
  };

  // ==========================================
  // GRID INTERACTION
  // ==========================================

  const handleGridClick = (row, col) => {
    // FR3.2: Prevent placing obstacles on Robot's or Target's position
    if (row === robotPos.row && col === robotPos.col) {
      showMessage("⚠️ Cannot place obstacle on the robot!", "warning");
      return;
    }
    if (targetPos && row === targetPos.row && col === targetPos.col) {
      showMessage("⚠️ Cannot place obstacle on the target!", "warning");
      return;
    }

    // FR3.4: Check if placing obstacle blocks current path
    if (isMoving && grid[row][col] === 0) {
      const isOnPath = path.some((p) => p.row === row && p.col === col);
      if (isOnPath) {
        wasMovingRef.current = true;
        clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
        setIsMoving(false);
      }
    }

    // FR3.1: Toggle grid cell's state (0 to 1 or 1 to 0)
    const newGrid = grid.map((r, i) =>
      r.map((cell, j) =>
        i === row && j === col ? (cell === 1 ? 0 : 1) : cell,
      ),
    );
    setGrid(newGrid);
  };

  // ==========================================
  // GAME CONTROLS
  // ==========================================

  const resetSimulation = () => {
    setRobotPos({ row: 10, col: 10 });
    setTargetPos(null);
    setPath([]);
    // Clear ALL obstacles
    const emptyGrid = Array(gridSize)
      .fill(0)
      .map(() => Array(gridSize).fill(0));
    setGrid(emptyGrid);
    setTimer(180);
    setScore(0);
    setMissions(0);
    setMessage("");
    setTranscript("");
    setComputationTime(null);
    showMessage("🔄 Simulation reset!", "info");
  };

  const startScenario = (scenarioKey) => {
    setScenario(scenarioKey);
    setScreen("game");
    resetSimulation();
  };

  const showMessage = (msg, type = "info") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(""), 3000);
  };

  // ==========================================
  // MENU SCREEN
  // ==========================================

  if (screen === "menu") {
    return (
      <div className="menu-screen">
        {/* Floating Orbs */}
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>

        <div className="menu-container">
          <div className="menu-header">
            <h1 className="menu-title">
              <img
                src="/logo.png"
                alt="VoiceRover Logo"
                className="title-logo"
              />
              VoiceRover
            </h1>

            <div className="status-badge">
              {backendConnected ? (
                <div className="badge badge-success">
                  <Wifi size={16} />
                  <span>Flask API Connected</span>
                </div>
              ) : (
                <div className="badge badge-warning">
                  <WifiOff size={16} />
                  <span>Client-Side Mode</span>
                </div>
              )}
            </div>
          </div>

          <div className="scenarios-grid">
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <button
                key={key}
                onClick={() => startScenario(key)}
                className={`scenario-card ${s.gradient}`}
              >
                <div className="scenario-icon">{s.icon}</div>
                <h2 className="scenario-name">{s.name}</h2>
                <p className="scenario-description">{s.description}</p>
              </button>
            ))}
          </div>

          <div className="instructions-card">
            <h3 className="instructions-title">How to Play:</h3>
            <ul className="instructions-list">
              <li>
                🎤 Press the microphone button and say: "Go to [location]"
              </li>
              <li>🗺️ Click grid cells to place obstacles dynamically</li>
              <li>
                🤖 Watch the robot automatically recalculate its path in
                real-time
              </li>
              <li>
                ⏱️ Complete as many missions as possible before time runs out!
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // GAME SCREEN
  // ==========================================

  const currentScenario = SCENARIOS[scenario];

  return (
    <div className={`game-screen ${currentScenario.bgClass}`}>
      {/* Header */}
      <div className="game-header">
        <div className="header-content">
          <div className="header-left">
            <button onClick={() => setScreen("menu")} className="btn btn-back">
              ← Menu
            </button>
            <div className="scenario-info">
              <span className="scenario-icon-small">
                {currentScenario.icon}
              </span>
              <div>
                <h2 className="scenario-title">{currentScenario.name}</h2>
                <p className="scenario-mission">Voice-Controlled Navigation</p>
              </div>
            </div>
          </div>

          <div className="header-stats">
            {backendConnected && (
              <div className="stat-item stat-success">
                <Wifi size={18} />
                <span>API</span>
              </div>
            )}
            <div className="stat-item">
              <Timer size={18} />
              <span className="stat-value">
                {Math.floor(timer / 60)}:
                {(timer % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="stat-item">
              <Target size={18} />
              <span className="stat-value">{score}</span>
            </div>
            <div className="stat-item">
              <span>🎯</span>
              <span className="stat-value">{missions}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="game-container">
        {/* Grid */}
        <div className="grid-panel">
          <div className="grid-wrapper">
            {grid.map((row, i) => (
              <div key={i} className="grid-row">
                {row.map((cell, j) => {
                  const isRobot = robotPos.row === i && robotPos.col === j;
                  const isTarget =
                    targetPos && targetPos.row === i && targetPos.col === j;
                  const isPath = path.some((p) => p.row === i && p.col === j);

                  let cellClass = "grid-cell";
                  if (isRobot) cellClass += ` ${currentScenario.robotColor}`;
                  else if (isTarget) cellClass += " cell-target";
                  else if (cell === 1) cellClass += " cell-obstacle";
                  else if (isPath) cellClass += ` ${currentScenario.pathColor}`;

                  return (
                    <button
                      key={`${i}-${j}`}
                      onClick={() => handleGridClick(i, j)}
                      className={cellClass}
                      title={
                        isMoving
                          ? "Cannot modify while robot is moving"
                          : "Click to toggle obstacle"
                      }
                    >
                      {isRobot && "🤖"}
                      {isTarget && "🎯"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Control Panel */}
        <div className="control-panel">
          {/* Voice Control */}
          <div className="control-card">
            <h3 className="control-title">
              <Mic size={18} />
              Voice Control
            </h3>
            <button
              onClick={startListening}
              disabled={isListening || isMoving}
              className={`btn btn-voice ${isListening ? "btn-listening" : currentScenario.gradient}`}
            >
              <Mic size={20} />
              {isListening ? "Listening..." : "Voice Command"}
            </button>
            {transcript && (
              <div className="transcript">
                <strong>Command:</strong> "{transcript}"
              </div>
            )}
            {/* Debug: Manual location selector */}
            <div style={{ marginTop: "0.75rem" }}>
              <small
                style={{
                  color: "#6b7280",
                  display: "block",
                  marginBottom: "0.5rem",
                }}
              >
                Or click to test:
              </small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {SCENARIOS[scenario].locations.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      setTargetPos(LOCATIONS[loc]);
                      showMessage(
                        `🎯 Target set to ${loc.toUpperCase()}`,
                        "success",
                      );
                    }}
                    disabled={isMoving}
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.75rem",
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                    }}
                  >
                    {loc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Available Locations */}
          <div className="control-card">
            <h3 className="control-title">Available Locations:</h3>
            <div className="locations-list">
              {SCENARIOS[scenario].locations.map((loc) => (
                <div key={loc} className="location-item">
                  <Navigation size={14} />
                  <span>{loc.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Path Info */}
          {(path.length > 0 || isCalculating) && (
            <div className="control-card">
              <h3 className="control-title">Path Information:</h3>
              {isCalculating ? (
                <div className="path-info">
                  <div className="info-row">
                    <span>Status:</span>
                    <strong style={{ color: "#f59e0b" }}>Calculating...</strong>
                  </div>
                </div>
              ) : path.length > 0 ? (
                <div className="path-info">
                  <div className="info-row">
                    <span>Steps:</span>
                    <strong>{path.length}</strong>
                  </div>
                  {computationTime && (
                    <div className="info-row">
                      <span>Computed:</span>
                      <strong>{computationTime.toFixed(1)}ms</strong>
                    </div>
                  )}
                  <div className="info-row">
                    <span>Algorithm:</span>
                    <strong>A*</strong>
                  </div>
                  <div className="info-row">
                    <span>Source:</span>
                    <strong>{backendConnected ? "Backend" : "Client"}</strong>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Action Buttons */}
          <div className="control-card">
            <button
              onClick={moveRobot}
              disabled={path.length === 0 || isMoving}
              className="btn btn-execute"
            >
              <Play size={18} />
              {isMoving ? "Moving..." : "Execute Path"}
            </button>
            <button
              onClick={resetSimulation}
              disabled={isMoving}
              className="btn btn-reset"
            >
              <RotateCcw size={18} />
              Reset
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`message message-${message.type}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
