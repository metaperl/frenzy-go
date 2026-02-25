# Prompt: Create "Frenzy Go" - A Real-Time Blitz Strategy App

Act as an expert React game developer. Create a high-fidelity, single-file React application for **Frenzy Go**, a real-time strategy adaptation of the classic board game "Go."

## 🕹️ Game Concept

Frenzy Go replaces traditional turn-based mechanics with an energy-based real-time system. Players and a "Neural Core" AI compete simultaneously on a Go board using a high-fidelity "Cyberpunk" aesthetic.

## 🛠️ Core Mechanics & Logic

1. **Grid System:** Render a standard Go board using intersections. Support selectable sizes from $5 \times 5$ to $19 \times 19$.

2. **The Energy System:**
   
   - **Capacity:** 100 Units.
   
   - **Cost per Move:** 18 Units.
   
   - **Regeneration:** ~5.5% per second (0.55 units every 100ms).
   
   - **Constraint:** Moves are disabled if energy < 18.

3. **Go Engine:**
   
   - Implement recursive liberty checking to handle captures.
   
   - Remove groups with zero liberties instantly.
   
   - Prohibit "Suicide Moves" unless they result in a capture.

4. **Winning Conditions:**
   
   - **Dominance:** Instant win if a player has $\ge 10$ stones AND double the opponent's count.
   
   - **Saturation:** If the board reaches 95% capacity, the player with the most stones wins.

## 🎨 Visual Identity & UI

- **Theme:** Neon Noir / Cyberpunk. Deep Charcoal (`#1e1a16`) board, Sky Blue (`#0ea5e9`) player, Rose Red (`#f43f5e`) AI.

- **HUD:** Real-time pulsing energy bars, capture counters (Skulls), and score counters (Trophies).

- **Shop Overlay:** A sidebar to spend "Skulls" on:
  
  - **Energy Surge (10 Skulls):** Instant +30 Energy.
  
  - **Sabotage (15 Skulls):** Drains 20 AI Energy.

- **Advanced Features:** A toggle for **Fog of War** (only reveal intersections within a 2-unit radius of friendly stones).

## 💻 Technical Requirements

- **Performance:** Use `useRef` to manage the board matrix to bypass React's render cycle for high-frequency real-time updates. Only trigger re-renders for visual state changes.

- **Game Loop:** Use `setInterval` for energy ticks and AI decision-making logic.

- **Styling:** Use **Tailwind CSS** for layout and backdrop blurs. Ensure the UI is responsive.

- **Icons:** Use `lucide-react` for all UI icons.

## 📱 Component Structure

- **Menu:** Board size selector, Fog of War toggle, and a "Rules" manual.

- **Pre-Game:** A 3-second "3, 2, 1, GO!" countdown overlay.

- **Game:** The main interactive board and HUD.

- **Game Over:** Match result summary with a "Reboot" button.
