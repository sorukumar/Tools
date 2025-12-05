# Lightning Network Simulator 3D - Architecture Documentation

**Version:** 1.0  
**Last Updated:** December 4, 2025  
**Tech Stack:** Three.js, Vanilla JavaScript (ES6+), CSS3

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Module Details](#module-details)
4. [Data Flow](#data-flow)
5. [Key Concepts](#key-concepts)
6. [Common Patterns](#common-patterns)
7. [Enhancement Guide](#enhancement-guide)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### Purpose
An interactive 3D visualization tool that simulates the Lightning Network payment routing. Users can:
- Generate random Lightning Network topologies
- Send payments between nodes
- Watch lightning bolts animate through routing paths
- View real-time channel liquidity and routing fees
- Track transaction history and network statistics

### Design Principles
1. **Modular Architecture** - Clean separation of concerns (Model, Renderer, UI)
2. **Educational Focus** - Helps users understand Lightning Network mechanics
3. **Visual Feedback** - Immediate visual response to all interactions
4. **Performance** - Efficient updates without full re-renders
5. **Maintainability** - Well-documented, single-responsibility modules

---

## 🏗️ Architecture

### High-Level Structure
```
┌─────────────────────────────────────────────────────┐
│                 User Interface (HTML)                │
│  Controls • 3D Canvas • Stats Panel • Table         │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│              UIController (Module 3)                 │
│  Event Binding • User Input • DOM Updates           │
└─────┬──────────────────────────────────┬────────────┘
      │                                  │
┌─────▼──────────────────┐    ┌──────────▼───────────┐
│  NetworkModel (Mod 1)  │    │  Network3DRenderer   │
│  Data & Logic          │◄───┤  (Module 2)          │
│  • Nodes               │    │  Three.js Rendering  │
│  • Channels            │    │  • Scene Management  │
│  • Pathfinding         │    │  • Animations        │
│  • Balances            │    │  • Interactions      │
└────────────────────────┘    └──────────────────────┘
```

### File Structure
```
lnsimulator/
├── lnsimulator.html    # Main HTML structure, includes Three.js
├── script.js           # All JavaScript (4 modules)
├── styles.css          # All custom styles
└── ARCHITECTURE.md     # This file
```

---

## 📦 Module Details

### Module 1: NetworkModel (Data Layer)

**Responsibility:** Manages all network data and business logic

**Key Data Structures:**
```javascript
// Node Object
{
    id: number,           // Unique identifier (0-based index)
    label: string,        // Display name (A, B, C, etc.)
    position: {           // 3D coordinates
        x: number,
        y: number,
        z: number
    },
    velocity: {           // For force-directed layout
        x: number,
        y: number,
        z: number
    }
}

// Channel Object
{
    id: number,           // Unique identifier
    start: number,        // Start node ID
    end: number,          // End node ID
    capacity: number,     // Total capacity in sats (FIXED)
    balance1: number,     // Balance on start node side (DYNAMIC)
    balance2: number,     // Balance on end node side (DYNAMIC)
    baseFee: number,      // Base fee in sats (default: 1000)
    feeRate: number       // Fee rate as decimal (default: 0.001 = 0.1%)
}

// Transaction Object
{
    from: string,         // Sender node label
    to: string,           // Receiver node label
    amount: number,       // Payment amount in sats
    path: string[],       // Array of node labels in route
    fees: number,         // Total routing fees paid
    hops: number,         // Number of hops (path.length - 1)
    status: string,       // 'Success' or 'Failed'
    timestamp: Date,      // When transaction occurred
    reason: string        // Optional: reason for failure
}
```

**Key Methods:**

| Method | Purpose | Important Notes |
|--------|---------|-----------------|
| `generateNetwork(numNodes, channelProbability)` | Creates nodes and channels | Uses force-directed layout for positioning |
| `findPath(start, end, amount)` | Dijkstra-based pathfinding | Returns `{path: [], totalFees: 0}` |
| `updateChannelBalances(path, amount, fees)` | Updates liquidity after payment | Maintains `balance1 + balance2 = capacity` invariant |
| `getStats()` | Calculates network metrics | Returns capacity, success rate, avg fees, etc. |

**Critical Invariants:**
- ✅ `channel.balance1 + channel.balance2 === channel.capacity` (ALWAYS)
- ✅ Total network capacity never changes after generation
- ✅ Node count never changes after generation

---

### Module 2: Network3DRenderer (Visualization Layer)

**Responsibility:** All Three.js rendering, animations, and 3D interactions

**Scene Structure:**
```
Scene
├── Ambient Light
├── Point Light 1 (cyan)
├── Point Light 2 (orange)
├── Grid Helper
├── Channels (Cylinders)
│   └── Material: Color gradient based on balance
├── Nodes (Spheres)
│   └── Material: Phong with emissive glow
├── Labels (Sprites)
└── Lightning Bolts (Groups)
    ├── Main Bolt (Sphere)
    ├── Glow Effect (Larger Sphere)
    └── Particle Trail (10 spheres)
```

**Key Methods:**

| Method | Purpose | When to Use |
|--------|---------|-------------|
| `renderNetwork()` | Full network re-render | Only on regeneration |
| `updateChannelVisuals()` | Update channel colors only | After transaction completes |
| `highlightPath(path)` | Highlight nodes/channels | Before animation starts |
| `animatePayment(path, callback)` | Lightning bolt animation | For each payment |
| `generateNodeTooltip(node)` | Create node tooltip HTML | On hover over node |
| `generateChannelTooltip(channel)` | Create channel tooltip HTML | On hover over channel |

**Animation System:**
```javascript
// Transaction Animation Object
{
    lightning: {           // Visual components
        group: THREE.Group,
        bolt: THREE.Mesh,
        glow: THREE.Mesh,
        particles: THREE.Mesh[]
    },
    path: number[],       // Node IDs to traverse
    currentStep: number,  // Current hop index
    progress: number,     // 0-1 progress on current hop
    speed: number         // Animation speed (default: 0.02)
}
```

**Performance Optimization:**
- ✅ Uses `updateChannelVisuals()` instead of full re-render
- ✅ Raycasting only on mouse move
- ✅ Tooltip updates throttled by mouse movement
- ✅ Maximum 50 transactions in history (auto-pruned)

**Color Scheme:**
| Element | Default Color | Hover | Selected | Highlighted |
|---------|---------------|-------|----------|-------------|
| Node | Cyan (#00d4ff) | Green (#00ff88) | Orange (#ffaa00) | Orange glow |
| Channel | Blue→Orange gradient | Brighter | - | Full glow |
| Lightning | Yellow (#ffff00) | - | - | - |

---

### Module 3: UIController (Interaction Layer)

**Responsibility:** Bridges user actions with model and renderer

**Event Flow:**
```
User Action → UIController → Model Update → Renderer Update → DOM Update
```

**Key Methods:**

| Method | Triggers | Updates |
|--------|----------|---------|
| `regenerateNetwork()` | "Regenerate" button | Model, Renderer, Dropdowns, Stats |
| `sendPayment()` | "Send Payment" button | Model balances, Renderer visuals, Table, Stats |
| `updateStats()` | After any transaction | Stats panel DOM elements |
| `updateTransactionTable()` | After any transaction | Transaction history table |

**Important Update Sequence (sendPayment):**
```javascript
1. Validate inputs
2. Find path using model.findPath()
3. If no path → Add failed transaction, return
4. Highlight path in renderer
5. Start animation with callback
6. Add transaction to history (immediately)
7. In animation callback:
   a. Update model balances
   b. Update renderer visuals (colors only)
   c. Re-highlight path
   d. Update stats
```

---

## 🔄 Data Flow

### Network Generation Flow
```
User clicks "Regenerate"
    ↓
UIController.regenerateNetwork()
    ↓
NetworkModel.generateNetwork()
    ├── Create node positions (sphere layout)
    ├── Apply force-directed layout
    └── Create channels with capacities
    ↓
Network3DRenderer.renderNetwork()
    ├── Clear old meshes
    ├── Create channel cylinders
    └── Create node spheres + labels
    ↓
UIController.populateNodeDropdowns()
    ↓
UIController.updateStats()
```

### Payment Transaction Flow
```
User clicks "Send Payment"
    ↓
UIController.sendPayment()
    ↓
NetworkModel.findPath() → {path, totalFees}
    ↓
If no path found:
    └── Add failed transaction → Update table → STOP
    ↓
Network3DRenderer.highlightPath()
    ↓
Network3DRenderer.animatePayment()
    ├── Create lightning bolt
    ├── Animate along path (updateTransactions() loop)
    └── Callback on completion:
        ├── NetworkModel.updateChannelBalances()
        ├── Network3DRenderer.updateChannelVisuals()
        └── UIController.updateStats()
    ↓
UIController.addTransaction()
    ├── Add to model.transactionHistory
    └── Update transaction table
```

### Hover Interaction Flow
```
Mouse moves over 3D canvas
    ↓
Network3DRenderer.onMouseMove()
    ↓
Raycasting detects intersection
    ↓
If new object hovered:
    ├── Reset previous hover state
    ├── Apply new hover state (color change)
    └── Show tooltip (generateNodeTooltip or generateChannelTooltip)
    ↓
Tooltip displays:
    - Node: Channels, capacity, liquidity distribution, peers
    - Channel: Endpoints, capacity, balance, bidirectional fees
```

---

## 💡 Key Concepts

### 1. Channel Balance Mechanics

**Critical Understanding:**
```javascript
// Channel capacity is FIXED at creation
capacity = 10,000,000 sats  // Never changes!

// Balances are DYNAMIC and must always sum to capacity
balance1 = 6,000,000 sats  // Node A's side
balance2 = 4,000,000 sats  // Node B's side

// Invariant: balance1 + balance2 === capacity
```

**When Node A sends 1m sats to Node B through this channel:**
```javascript
// Before:
balance1: 6,000,000  →  // After: 5,000,000  (reduced by 1m)
balance2: 4,000,000  →  // After: 5,000,000  (increased by 1m - fees)
```

### 2. Routing Fee Calculation

**Fee Structure:**
```javascript
fee = baseFee + (amount × feeRate)

// Example:
baseFee = 1000 sats
feeRate = 0.001 (0.1%)
amount = 1,000,000 sats

fee = 1000 + (1,000,000 × 0.001) = 2,000 sats
```

**Multi-hop Routing:**
```javascript
// Path: A → B → C → D
// Amount: 1,000,000 sats

// Hop 3 (C→D): Forwards 1,000,000 + 0 = 1,000,000
// Hop 2 (B→C): Forwards 1,000,000 + fee(C) = 1,002,000
// Hop 1 (A→B): Forwards 1,002,000 + fee(B) = 1,004,000

// Total fees paid by A: 4,000 sats
```

### 3. Force-Directed Layout Algorithm

**Purpose:** Spreads nodes naturally in 3D space

**Physics Simulation:**
```javascript
Forces applied each iteration:
1. Repulsion: All nodes push each other away (inverse-square law)
2. Attraction: Connected nodes pull together (spring force)
3. Damping: Velocities gradually reduce

Result: Nodes settle into aesthetically pleasing arrangement
```

### 4. Pathfinding (Dijkstra's Algorithm)

**Implementation Details:**
```javascript
// Queue-based breadth-first search with fee tracking
// Finds shortest path by total fees, considering:
- Available balance in each direction
- Fee accumulation from destination backwards
- Multiple paths (picks cheapest)
```

**Why fees track backwards:**
```javascript
// Each hop needs: amount + all downstream fees
// Example path A→B→C, sending 100:
C receives: 100
B needs:    100 + feeC = 102
A needs:    102 + feeB = 104
```

---

## 🛠️ Common Patterns

### Pattern 1: Adding New Node Properties

**Example: Add "lastActive" timestamp to nodes**

```javascript
// 1. Update NetworkModel.generateNetwork()
this.nodes.push({
    id: i,
    label: String.fromCharCode(65 + i % 26),
    position: this._generateNodePosition(i, numNodes),
    velocity: { x: 0, y: 0, z: 0 },
    lastActive: null  // NEW PROPERTY
});

// 2. Update in relevant methods (e.g., updateChannelBalances)
path.forEach(nodeId => {
    this.nodes[nodeId].lastActive = Date.now();
});

// 3. Display in tooltip (Network3DRenderer.generateNodeTooltip)
return `
    ...existing sections...
    <div class="tooltip-section">
        <div class="tooltip-label">Last Active</div>
        <div class="tooltip-value">
            ${node.lastActive ? new Date(node.lastActive).toLocaleString() : 'Never'}
        </div>
    </div>
`;
```

### Pattern 2: Adding New Statistics

**Example: Track total volume routed**

```javascript
// 1. Add to NetworkModel
constructor() {
    this.nodes = [];
    this.channels = [];
    this.transactionHistory = [];
    this.totalVolumeRouted = 0;  // NEW
}

// 2. Update in sendPayment
this.model.totalVolumeRouted += paymentAmount;

// 3. Add to getStats()
getStats() {
    return {
        ...existingStats,
        totalVolume: this.totalVolumeRouted
    };
}

// 4. Display in UI (UIController.updateStats)
this.elements.statTotalVolume.textContent = 
    this.formatCapacity(stats.totalVolume);

// 5. Add HTML element in lnsimulator.html
<div class="stat-item">
    <span class="stat-label">Total Volume:</span>
    <span class="stat-value" id="statTotalVolume">0 sats</span>
</div>
```

### Pattern 3: Adding New Visual Effects

**Example: Flash nodes when receiving payment**

```javascript
// 1. Add method to Network3DRenderer
flashNode(nodeId) {
    const mesh = this.nodeMeshes[nodeId];
    if (!mesh) return;
    
    // Save original state
    const originalColor = mesh.material.emissive.getHex();
    const originalIntensity = mesh.material.emissiveIntensity;
    
    // Flash effect
    mesh.material.emissive.setHex(0x00ff00);
    mesh.material.emissiveIntensity = 3;
    
    // Reset after delay
    setTimeout(() => {
        mesh.material.emissive.setHex(originalColor);
        mesh.material.emissiveIntensity = originalIntensity;
    }, 500);
}

// 2. Call in animatePayment callback
this.renderer.animatePayment(path, () => {
    this.model.updateChannelBalances(path, paymentAmount, totalFees);
    this.renderer.updateChannelVisuals();
    
    // Flash the receiver
    this.renderer.flashNode(path[path.length - 1]);
    
    this.updateStats();
});
```

---

## 🚀 Enhancement Guide

### Adding New Features - Checklist

**Before Starting:**
- [ ] Read relevant module documentation above
- [ ] Identify which module(s) need changes
- [ ] Check if similar patterns exist in codebase
- [ ] Consider data flow implications

**Implementation Steps:**
1. **Data Model** (if needed)
   - Add properties to NetworkModel
   - Update initialization/generation
   - Maintain invariants

2. **Visual Representation** (if needed)
   - Add to Network3DRenderer
   - Create/update meshes
   - Add to animation loop if dynamic

3. **User Interaction** (if needed)
   - Add UI elements in HTML
   - Add event handlers in UIController
   - Connect to model/renderer

4. **Testing Checklist:**
   - [ ] No console errors
   - [ ] Channel balances still sum to capacity
   - [ ] Tooltips show correct data
   - [ ] Animation completes properly
   - [ ] Stats update correctly
   - [ ] Multiple transactions work
   - [ ] Network regeneration works

### Common Enhancement Ideas

**Easy (Low Complexity):**
- Add new statistics
- Change color schemes
- Add sound effects (use Web Audio API)
- Add network presets (different topologies)
- Export/import network state

**Medium (Moderate Complexity):**
- Multi-path payments (split across routes)
- Different pathfinding algorithms (A*, BFS)
- Node reputation/scoring system
- Channel rebalancing visualization
- Time-based fee changes

**Hard (High Complexity):**
- Real Lightning Network data import
- Submarine swaps visualization
- HTLC timeout simulation
- Network attack scenarios
- Machine learning route optimization

---

## 🐛 Troubleshooting

### Issue: Lightning bolt doesn't stop at destination

**Symptom:** Animation continues past final node

**Cause:** Incorrect loop condition in `updateTransactions()`

**Fix:** Ensure condition is `currentStep >= path.length - 1`

```javascript
// WRONG:
if (tx.currentStep < tx.path.length - 2)

// CORRECT:
if (tx.currentStep >= tx.path.length - 1) return;
```

---

### Issue: Channel balances don't add up

**Symptom:** `balance1 + balance2 ≠ capacity`

**Cause:** Fee deduction logic error in `updateChannelBalances()`

**Debug:**
```javascript
// Add after balance update:
if (channel.balance1 + channel.balance2 !== channel.capacity) {
    console.error('Balance invariant violated!', {
        channelId: channel.id,
        balance1: channel.balance1,
        balance2: channel.balance2,
        capacity: channel.capacity,
        sum: channel.balance1 + channel.balance2
    });
}
```

---

### Issue: Tooltip shows stale data

**Symptom:** Tooltip doesn't reflect recent transaction changes

**Cause:** Using old reference instead of fresh model data

**Fix:** Always fetch fresh data from model:
```javascript
// WRONG:
const nodeChannels = object.userData.node.channels;

// CORRECT:
const nodeChannels = this.model.channels.filter(c => 
    c.start === node.id || c.end === node.id
);
```

---

### Issue: Network doesn't update after transaction

**Symptom:** Visual colors don't change, tooltip shows old values

**Cause:** Using `renderNetwork()` instead of `updateChannelVisuals()`

**Fix:**
```javascript
// WRONG (destroys everything):
this.renderer.renderNetwork();

// CORRECT (updates colors only):
this.renderer.updateChannelVisuals();
```

---

### Issue: Multiple transactions conflict

**Symptom:** Animations overlap, balances update incorrectly

**Cause:** Balances updating immediately vs. after animation

**Current Design:** 
- Transaction added to history immediately (for UI feedback)
- Balances update after animation completes
- Multiple animations can run concurrently

**If you need synchronous transactions:**
```javascript
// Add queue in UIController
this.transactionQueue = [];
this.isProcessing = false;

sendPayment() {
    this.transactionQueue.push({sender, receiver, amount});
    if (!this.isProcessing) {
        this.processNextTransaction();
    }
}

processNextTransaction() {
    if (this.transactionQueue.length === 0) {
        this.isProcessing = false;
        return;
    }
    
    this.isProcessing = true;
    const tx = this.transactionQueue.shift();
    // ...send payment logic...
    // In animation callback:
    this.processNextTransaction();
}
```

---

## 📚 External Resources

### Three.js Documentation
- [Three.js Docs](https://threejs.org/docs/)
- [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)
- [Raycaster](https://threejs.org/docs/#api/en/core/Raycaster)

### Lightning Network Resources
- [Lightning Network Specs](https://github.com/lightning/bolts)
- [Understanding LN](https://docs.lightning.engineering/the-lightning-network/overview)
- [Channel Liquidity](https://docs.lightning.engineering/the-lightning-network/liquidity)

### Algorithms
- [Dijkstra's Algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm)
- [Force-Directed Graph](https://en.wikipedia.org/wiki/Force-directed_graph_drawing)

---

## 🔄 Changelog

### Version 1.0 (December 4, 2025)
- Initial architecture with modular design
- 3D visualization with Three.js
- Force-directed network layout
- Lightning bolt animations
- Interactive tooltips (nodes and channels)
- Real-time stats dashboard
- Transaction history tracking
- Bidirectional fee display
- Optimized channel visual updates

---

## 📝 Notes for AI/LLM Assistants

When working on this codebase:

1. **Always preserve invariants:**
   - Channel capacity never changes
   - balance1 + balance2 = capacity
   - Path arrays are node IDs (numbers), not labels

2. **Update patterns to follow:**
   - Model change → Renderer update → UI update
   - Use `updateChannelVisuals()` for balance changes
   - Use `renderNetwork()` only for full regeneration

3. **Common mistakes to avoid:**
   - Don't modify channel.capacity after creation
   - Don't use full re-render after transactions
   - Don't forget to update tooltips when adding node/channel properties
   - Don't mix node IDs (numbers) with labels (strings)

4. **Testing checklist after changes:**
   - Send multiple transactions
   - Hover over nodes/channels
   - Regenerate network
   - Check console for errors
   - Verify transaction table updates

5. **Code style:**
   - Use ES6+ features (const/let, arrow functions, template literals)
   - Keep methods focused (single responsibility)
   - Add comments for complex logic
   - Use descriptive variable names

---

**End of Documentation**

For questions or improvements to this documentation, please update this file and note changes in the Changelog section.
