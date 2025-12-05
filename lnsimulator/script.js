// ============================================================================
// LIGHTNING NETWORK SIMULATOR 3D
// Modular architecture with Three.js visualization
// ============================================================================

// ============================================================================
// MODULE 1: Network Data Model
// ============================================================================
class NetworkModel {
    constructor() {
        this.nodes = [];
        this.channels = [];
        this.transactionHistory = [];
    }

    generateNetwork(numNodes, channelProbability) {
        this.nodes = [];
        this.channels = [];
        
        // Create nodes with force-directed initial positions
        for (let i = 0; i < numNodes; i++) {
            this.nodes.push({
                id: i,
                label: String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) : ''),
                position: this._generateNodePosition(i, numNodes),
                velocity: { x: 0, y: 0, z: 0 }
            });
        }

        // Create channels with realistic capacity distribution
        for (let i = 0; i < numNodes; i++) {
            for (let j = i + 1; j < numNodes; j++) {
                if (Math.random() < channelProbability) {
                    const capacity = this._generateCapacity();
                    const balance1 = Math.floor(capacity * (0.2 + Math.random() * 0.6)); // 20-80% balance
                    
                    this.channels.push({
                        id: this.channels.length,
                        start: i,
                        end: j,
                        capacity: capacity,
                        balance1: balance1,
                        balance2: capacity - balance1,
                        baseFee: 1000, // 1 sat base fee
                        feeRate: 0.001 // 0.1% fee rate
                    });
                }
            }
        }

        // Run force-directed layout simulation
        this._applyForceLayout();
    }

    _generateNodePosition(index, total) {
        // Initial positions in a sphere
        const phi = Math.acos(-1 + (2 * index) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;
        const radius = 150;
        
        return {
            x: radius * Math.cos(theta) * Math.sin(phi),
            y: radius * Math.sin(theta) * Math.sin(phi),
            z: radius * Math.cos(phi)
        };
    }

    _generateCapacity() {
        const capacities = [
            1000000, 5000000, 10000000, 20000000, 30000000, 
            40000000, 50000000, 100000000, 200000000
        ];
        // Weighted towards smaller channels
        const weights = [0.25, 0.20, 0.15, 0.12, 0.10, 0.08, 0.05, 0.03, 0.02];
        const rand = Math.random();
        let sum = 0;
        
        for (let i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (rand < sum) return capacities[i];
        }
        return capacities[0];
    }

    _applyForceLayout() {
        const iterations = 50;
        const repulsionStrength = 5000;
        const attractionStrength = 0.01;
        const damping = 0.9;

        for (let iter = 0; iter < iterations; iter++) {
            // Apply repulsion between all nodes
            for (let i = 0; i < this.nodes.length; i++) {
                for (let j = i + 1; j < this.nodes.length; j++) {
                    const dx = this.nodes[j].position.x - this.nodes[i].position.x;
                    const dy = this.nodes[j].position.y - this.nodes[i].position.y;
                    const dz = this.nodes[j].position.z - this.nodes[i].position.z;
                    const distSq = dx * dx + dy * dy + dz * dz + 0.01;
                    const dist = Math.sqrt(distSq);
                    const force = repulsionStrength / distSq;
                    
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    const fz = (dz / dist) * force;
                    
                    this.nodes[i].velocity.x -= fx;
                    this.nodes[i].velocity.y -= fy;
                    this.nodes[i].velocity.z -= fz;
                    this.nodes[j].velocity.x += fx;
                    this.nodes[j].velocity.y += fy;
                    this.nodes[j].velocity.z += fz;
                }
            }

            // Apply attraction along channels
            this.channels.forEach(channel => {
                const node1 = this.nodes[channel.start];
                const node2 = this.nodes[channel.end];
                const dx = node2.position.x - node1.position.x;
                const dy = node2.position.y - node1.position.y;
                const dz = node2.position.z - node1.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const force = (dist - 100) * attractionStrength;
                
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                const fz = (dz / dist) * force;
                
                node1.velocity.x += fx;
                node1.velocity.y += fy;
                node1.velocity.z += fz;
                node2.velocity.x -= fx;
                node2.velocity.y -= fy;
                node2.velocity.z -= fz;
            });

            // Update positions and apply damping
            this.nodes.forEach(node => {
                node.position.x += node.velocity.x;
                node.position.y += node.velocity.y;
                node.position.z += node.velocity.z;
                node.velocity.x *= damping;
                node.velocity.y *= damping;
                node.velocity.z *= damping;
            });
        }
    }

    findPath(start, end, amount) {
        const visited = new Set();
        const queue = [[start]];
        const fees = new Map([[start, 0]]);
        
        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];
            
            if (node === end) {
                return { path, totalFees: fees.get(node) };
            }
            
            if (!visited.has(node)) {
                visited.add(node);
                
                // Find neighbors with sufficient capacity
                const neighbors = this.channels
                    .filter(c => {
                        const requiredAmount = amount + fees.get(node);
                        if (c.start === node && c.balance1 >= requiredAmount) return true;
                        if (c.end === node && c.balance2 >= requiredAmount) return true;
                        return false;
                    })
                    .map(c => c.start === node ? c.end : c.start);
                
                for (const neighbor of neighbors) {
                    const channel = this.channels.find(c => 
                        (c.start === node && c.end === neighbor) || 
                        (c.end === node && c.start === neighbor)
                    );
                    
                    const fee = channel.baseFee + Math.floor((amount + fees.get(node)) * channel.feeRate);
                    const totalFees = fees.get(node) + fee;
                    
                    if (!fees.has(neighbor) || totalFees < fees.get(neighbor)) {
                        fees.set(neighbor, totalFees);
                        queue.push([...path, neighbor]);
                    }
                }
            }
        }
        
        return { path: [], totalFees: 0 };
    }

    updateChannelBalances(path, amount, fees) {
        let remainingAmount = amount + fees;
        
        for (let i = 0; i < path.length - 1; i++) {
            const channel = this.channels.find(c => 
                (c.start === path[i] && c.end === path[i + 1]) || 
                (c.end === path[i] && c.start === path[i + 1])
            );
            
            const fee = channel.baseFee + Math.floor(remainingAmount * channel.feeRate);
            const amountWithFee = remainingAmount;
            remainingAmount -= fee;

            if (channel.start === path[i]) {
                channel.balance1 -= amountWithFee;
                channel.balance2 += amountWithFee - fee;
            } else {
                channel.balance2 -= amountWithFee;
                channel.balance1 += amountWithFee - fee;
            }
        }
    }

    addTransaction(transaction) {
        this.transactionHistory.unshift(transaction); // Add to beginning
        if (this.transactionHistory.length > 50) {
            this.transactionHistory.pop(); // Keep max 50 transactions
        }
    }

    getStats() {
        const totalCapacity = this.channels.reduce((sum, c) => sum + c.capacity, 0);
        const successCount = this.transactionHistory.filter(t => t.status === 'Success').length;
        const totalPayments = this.transactionHistory.length;
        const successRate = totalPayments > 0 ? (successCount / totalPayments * 100).toFixed(1) : 0;
        const avgFee = successCount > 0 
            ? Math.floor(this.transactionHistory.filter(t => t.status === 'Success')
                .reduce((sum, t) => sum + t.fees, 0) / successCount)
            : 0;

        return {
            totalCapacity,
            channelCount: this.channels.length,
            successRate,
            totalPayments,
            avgFee
        };
    }
}

// ============================================================================
// MODULE 2: Three.js 3D Renderer
// ============================================================================
class Network3DRenderer {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.nodeMeshes = [];
        this.channelMeshes = [];
        this.labelSprites = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.activeTransactions = [];
        this.hoveredObject = null;
        this.selectedNode = null;
        this.tooltip = document.getElementById('tooltip3d');
        
        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        this.scene.fog = new THREE.Fog(0x1a1a1a, 300, 800);

        // Camera setup
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
        this.camera.position.set(0, 0, 400);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x00d4ff, 0.8, 1000);
        pointLight1.position.set(200, 200, 200);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff6b00, 0.6, 1000);
        pointLight2.position.set(-200, -200, -200);
        this.scene.add(pointLight2);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(400, 20, 0x00d4ff, 0x2c5364);
        gridHelper.position.y = -200;
        this.scene.add(gridHelper);

        // Mouse events
        this.container.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
        this.container.addEventListener('click', (e) => this.onClick(e), false);

        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.animate();
    }

    renderNetwork() {
        // Clear existing meshes
        this.clearNetwork();

        // Render channels first (so they appear behind nodes)
        this.model.channels.forEach(channel => {
            this.createChannelMesh(channel);
        });

        // Render nodes
        this.model.nodes.forEach(node => {
            this.createNodeMesh(node);
        });
    }

    // Update only channel visuals without full re-render
    updateChannelVisuals() {
        this.model.channels.forEach((channel, index) => {
            const mesh = this.channelMeshes[index];
            if (!mesh) return;
            
            // Update color based on new balance
            const balance1Ratio = channel.balance1 / channel.capacity;
            const color1 = new THREE.Color(0x8293AB);
            const color2 = new THREE.Color(0xE8916B);
            const newColor = color1.lerp(color2, balance1Ratio);
            
            mesh.material.color.copy(newColor);
            mesh.material.emissive.copy(newColor);
            
            // Update channel reference in userData
            mesh.userData.channel = channel;
        });
    }

    createNodeMesh(node) {
        // Node sphere
        const geometry = new THREE.SphereGeometry(8, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xE8916B,
            emissive: 0x8B5A42,
            shininess: 100
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(node.position.x, node.position.y, node.position.z);
        mesh.userData = { type: 'node', nodeId: node.id, node: node };
        
        this.scene.add(mesh);
        this.nodeMeshes.push(mesh);

        // Node label
        this.createLabel(node.label, node.position);
    }

    createLabel(text, position) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;
        
        // context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        // context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'Bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 64, 32);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(position.x, position.y + 15, position.z);
        sprite.scale.set(30, 15, 1);
        
        this.scene.add(sprite);
        this.labelSprites.push(sprite);
    }

    createChannelMesh(channel) {
        const node1 = this.model.nodes[channel.start];
        const node2 = this.model.nodes[channel.end];
        
        const start = new THREE.Vector3(node1.position.x, node1.position.y, node1.position.z);
        const end = new THREE.Vector3(node2.position.x, node2.position.y, node2.position.z);
        
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        
        // Channel width based on capacity
        const minWidth = 0.5;
        const maxWidth = 3;
        const logWidth = Math.log(channel.capacity / 1000000) / Math.log(200);
        const width = minWidth + (maxWidth - minWidth) * Math.min(1, Math.max(0, logWidth));
        
        // Create cylinder for channel
        const geometry = new THREE.CylinderGeometry(width, width, length, 8);
        
        // Gradient color based on balance
        const balance1Ratio = channel.balance1 / channel.capacity;
        const color1 = new THREE.Color(0x8293AB);
        const color2 = new THREE.Color(0xE8916B);
        const color = color1.lerp(color2, balance1Ratio);
        
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.7
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position and rotate cylinder
        mesh.position.copy(start.clone().add(direction.multiplyScalar(0.5)));
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize()
        );
        
        mesh.userData = { type: 'channel', channelId: channel.id, channel: channel };
        
        this.scene.add(mesh);
        this.channelMeshes.push(mesh);
    }

    clearNetwork() {
        this.nodeMeshes.forEach(mesh => this.scene.remove(mesh));
        this.channelMeshes.forEach(mesh => this.scene.remove(mesh));
        this.labelSprites.forEach(sprite => this.scene.remove(sprite));
        
        this.nodeMeshes = [];
        this.channelMeshes = [];
        this.labelSprites = [];
        this.hoveredObject = null;
        this.selectedNode = null;
    }

    highlightPath(path) {
        // Reset all highlights
        this.nodeMeshes.forEach(mesh => {
            mesh.material.emissive.setHex(0x004466);
            mesh.material.emissiveIntensity = 1;
        });
        
        this.channelMeshes.forEach(mesh => {
            mesh.material.emissiveIntensity = 0.3;
        });

        // Highlight path nodes
        path.forEach(nodeId => {
            const mesh = this.nodeMeshes[nodeId];
            if (mesh) {
                mesh.material.emissive.setHex(0xff6b00);
                mesh.material.emissiveIntensity = 2;
            }
        });

        // Highlight path channels
        for (let i = 0; i < path.length - 1; i++) {
            const channel = this.model.channels.find(c =>
                (c.start === path[i] && c.end === path[i + 1]) ||
                (c.end === path[i] && c.start === path[i + 1])
            );
            
            if (channel) {
                const mesh = this.channelMeshes.find(m => m.userData.channelId === channel.id);
                if (mesh) {
                    mesh.material.emissiveIntensity = 1;
                }
            }
        }
    }

    animatePayment(path, onComplete) {
        if (path.length < 2) return;

        const lightning = this.createLightningBolt();
        this.scene.add(lightning.group);
        
        const transaction = {
            lightning: lightning,
            path: path,
            currentStep: 0,
            progress: 0,
            speed: 0.02
        };
        
        this.activeTransactions.push(transaction);

        // Auto-remove after completion
        setTimeout(() => {
            this.scene.remove(lightning.group);
            const index = this.activeTransactions.indexOf(transaction);
            if (index > -1) this.activeTransactions.splice(index, 1);
            if (onComplete) onComplete();
        }, path.length * 1000);
    }

    createLightningBolt() {
        const group = new THREE.Group();
        
        // Main bolt
        const boltGeometry = new THREE.SphereGeometry(3, 16, 16);
        const boltMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1
        });
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        group.add(bolt);
        
        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(6, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffa500,
            transparent: true,
            opacity: 0.5
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        group.add(glow);
        
        // Particle trail
        const particles = [];
        for (let i = 0; i < 10; i++) {
            const particleGeometry = new THREE.SphereGeometry(1, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.8 - i * 0.08
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            group.add(particle);
            particles.push(particle);
        }
        
        return { group, bolt, glow, particles };
    }

    updateTransactions() {
        this.activeTransactions.forEach(tx => {
            // Only update if we haven't completed the path
            if (tx.currentStep >= tx.path.length - 1) {
                return; // Animation complete, wait for cleanup
            }
            
            tx.progress += tx.speed;
            
            // Move to next hop when current segment is complete
            if (tx.progress >= 1) {
                tx.currentStep++;
                tx.progress = 0;
                
                // Check if we've reached the destination
                if (tx.currentStep >= tx.path.length - 1) {
                    // Animation complete - position at final node
                    const finalNode = this.model.nodes[tx.path[tx.path.length - 1]];
                    tx.lightning.group.position.set(
                        finalNode.position.x,
                        finalNode.position.y,
                        finalNode.position.z
                    );
                    return;
                }
            }
            
            // Animate current segment
            const startNode = this.model.nodes[tx.path[tx.currentStep]];
            const endNode = this.model.nodes[tx.path[tx.currentStep + 1]];
            
            const start = new THREE.Vector3(startNode.position.x, startNode.position.y, startNode.position.z);
            const end = new THREE.Vector3(endNode.position.x, endNode.position.y, endNode.position.z);
            
            const position = start.lerp(end, tx.progress);
            tx.lightning.group.position.copy(position);
            
            // Update particle trail
            tx.lightning.particles.forEach((particle, i) => {
                const trailProgress = Math.max(0, tx.progress - i * 0.05);
                const trailPos = start.clone().lerp(end, trailProgress);
                particle.position.copy(trailPos).sub(position);
            });
        });
    }

    onMouseMove(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to detect hovering
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects([...this.nodeMeshes, ...this.channelMeshes]);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            if (this.hoveredObject !== object) {
                // Reset previous hover
                if (this.hoveredObject) {
                    this.resetHoverState(this.hoveredObject);
                }
                
                this.hoveredObject = object;
                this.applyHoverState(object);
                this.showTooltip(event, object);
            } else {
                // Update tooltip position
                this.updateTooltipPosition(event);
            }
        } else {
            if (this.hoveredObject) {
                this.resetHoverState(this.hoveredObject);
                this.hoveredObject = null;
                this.hideTooltip();
            }
        }
    }

    applyHoverState(object) {
        if (object.userData.type === 'node') {
            object.material.emissive.setHex(0x00ff88);
            object.material.emissiveIntensity = 1.5;
        } else if (object.userData.type === 'channel') {
            object.material.emissiveIntensity = 0.8;
        }
    }

    resetHoverState(object) {
        if (object.userData.type === 'node') {
            if (this.selectedNode === object.userData.nodeId) {
                object.material.emissive.setHex(0xffaa00);
                object.material.emissiveIntensity = 2;
            } else {
                object.material.emissive.setHex(0x004466);
                object.material.emissiveIntensity = 1;
            }
        } else if (object.userData.type === 'channel') {
            object.material.emissiveIntensity = 0.3;
        }
    }

    showTooltip(event, object) {
        let content = '';
        
        if (object.userData.type === 'node') {
            content = this.generateNodeTooltip(object.userData.node);
        } else if (object.userData.type === 'channel') {
            content = this.generateChannelTooltip(object.userData.channel);
        }
        
        this.tooltip.innerHTML = content;
        this.tooltip.classList.add('visible');
        this.updateTooltipPosition(event);
    }

    generateNodeTooltip(node) {
        const nodeChannels = this.model.channels.filter(c => 
            c.start === node.id || c.end === node.id
        );
        
        const totalCapacity = nodeChannels.reduce((sum, c) => sum + c.capacity, 0);
        const totalLocalBalance = nodeChannels.reduce((sum, c) => 
            sum + (c.start === node.id ? c.balance1 : c.balance2), 0
        );
        const totalRemoteBalance = totalCapacity - totalLocalBalance;
        
        const channelList = nodeChannels.map(c => {
            const peer = c.start === node.id 
                ? this.model.nodes[c.end].label 
                : this.model.nodes[c.start].label;
            return `
                <div class="channel-item">
                    <span class="channel-peer">→ ${peer}</span>
                    <span class="channel-capacity">${this.formatCapacity(c.capacity)}</span>
                </div>
            `;
        }).join('');
        
        const localPercent = totalCapacity > 0 ? (totalLocalBalance / totalCapacity * 100).toFixed(1) : 0;
        const remotePercent = totalCapacity > 0 ? (totalRemoteBalance / totalCapacity * 100).toFixed(1) : 0;
        
        return `
            <div class="tooltip-header">
                <i class="fas fa-network-wired"></i>
                <span>Node ${node.label}</span>
            </div>
            <div class="tooltip-body">
                <div class="tooltip-section">
                    <div class="tooltip-label">Total Channels</div>
                    <div class="tooltip-value highlight">${nodeChannels.length}</div>
                </div>
                
                <div class="tooltip-section">
                    <div class="tooltip-label">Total Capacity</div>
                    <div class="tooltip-value">${this.formatCapacity(totalCapacity)}</div>
                </div>
                
                <div class="tooltip-divider"></div>
                
                <div class="tooltip-section">
                    <div class="tooltip-label">Liquidity Distribution</div>
                    <div class="balance-bar">
                        <div class="balance-bar-fill balance-bar-left" style="width: ${localPercent}%"></div>
                        <div class="balance-bar-fill balance-bar-right" style="width: ${remotePercent}%"></div>
                    </div>
                    <div class="balance-legend">
                        <div class="balance-legend-item">
                            <div class="balance-dot left"></div>
                            <span>Local: ${this.formatCapacity(totalLocalBalance)}</span>
                        </div>
                        <div class="balance-legend-item">
                            <div class="balance-dot right"></div>
                            <span>Remote: ${this.formatCapacity(totalRemoteBalance)}</span>
                        </div>
                    </div>
                </div>
                
                ${nodeChannels.length > 0 ? `
                    <div class="tooltip-divider"></div>
                    <div class="tooltip-section">
                        <div class="tooltip-label">Connected Peers</div>
                        <div class="channel-list">${channelList}</div>
                    </div>
                ` : ''}
                
                <div class="tooltip-divider"></div>
                <div class="tooltip-section" style="font-size: 11px; color: rgba(255,255,255,0.6); text-align: center;">
                    Click node for more details
                </div>
            </div>
        `;
    }

    generateChannelTooltip(channel) {
        const node1 = this.model.nodes[channel.start];
        const node2 = this.model.nodes[channel.end];
        
        const balance1Percent = (channel.balance1 / channel.capacity * 100).toFixed(1);
        const balance2Percent = (channel.balance2 / channel.capacity * 100).toFixed(1);
        
        // Calculate routing fees for a 1m sat payment in both directions
        const testAmount = 1000000;
        
        // Node 1 -> Node 2 direction (using Node 1's balance to route to Node 2)
        const fee1to2 = channel.baseFee + Math.floor(testAmount * channel.feeRate);
        
        // Node 2 -> Node 1 direction (in real LN, this could have different fees)
        // For now, we'll use the same fee structure but show both directions
        const fee2to1 = channel.baseFee + Math.floor(testAmount * channel.feeRate);
        
        return `
            <div class="tooltip-header">
                <i class="fas fa-exchange-alt"></i>
                <span>Payment Channel</span>
            </div>
            <div class="tooltip-body">
                <div class="tooltip-section">
                    <div class="tooltip-label">Channel Endpoints</div>
                    <div class="tooltip-value">${node1.label} ↔ ${node2.label}</div>
                </div>
                
                <div class="tooltip-section">
                    <div class="tooltip-label">Total Capacity</div>
                    <div class="tooltip-value highlight">${this.formatCapacity(channel.capacity)}</div>
                </div>
                
                <div class="tooltip-divider"></div>
                
                <div class="tooltip-section">
                    <div class="tooltip-label">Balance Distribution</div>
                    <div class="balance-bar">
                        <div class="balance-bar-fill balance-bar-left" style="width: ${balance1Percent}%"></div>
                        <div class="balance-bar-fill balance-bar-right" style="width: ${balance2Percent}%"></div>
                    </div>
                    <div class="balance-legend">
                        <div class="balance-legend-item">
                            <div class="balance-dot left"></div>
                            <span>${node1.label}: ${this.formatCapacity(channel.balance1)}</span>
                        </div>
                        <div class="balance-legend-item">
                            <div class="balance-dot right"></div>
                            <span>${node2.label}: ${this.formatCapacity(channel.balance2)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="tooltip-divider"></div>
                
                <div class="tooltip-section">
                    <div class="tooltip-label">Routing Fees</div>
                    
                    <div style="margin-bottom: 8px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 3px;">
                            <strong>${node1.label} → ${node2.label}</strong>
                        </div>
                        <div class="tooltip-value" style="margin-bottom: 2px; font-size: 13px;">
                            ${this.formatCapacity(channel.baseFee)} base + ${(channel.feeRate * 100).toFixed(2)}% rate
                        </div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.6);">
                            Example: ${this.formatCapacity(testAmount)} → ${this.formatCapacity(fee1to2)} fee
                        </div>
                    </div>
                    
                    <div style="margin-top: 8px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 3px;">
                            <strong>${node2.label} → ${node1.label}</strong>
                        </div>
                        <div class="tooltip-value" style="margin-bottom: 2px; font-size: 13px;">
                            ${this.formatCapacity(channel.baseFee)} base + ${(channel.feeRate * 100).toFixed(2)}% rate
                        </div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.6);">
                            Example: ${this.formatCapacity(testAmount)} → ${this.formatCapacity(fee2to1)} fee
                        </div>
                    </div>
                    
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: rgba(255,255,255,0.5); font-style: italic;">
                        Note: In this simulation, both directions use the same fee policy
                    </div>
                </div>
            </div>
        `;
    }

    updateTooltipPosition(event) {
        const padding = 15;
        const containerRect = this.container.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let left = event.clientX - containerRect.left + padding;
        let top = event.clientY - containerRect.top + padding;
        
        // Prevent tooltip from going off-screen (relative to container)
        if (left + tooltipRect.width > containerRect.width) {
            left = event.clientX - containerRect.left - tooltipRect.width - padding;
        }
        if (top + tooltipRect.height > containerRect.height) {
            top = event.clientY - containerRect.top - tooltipRect.height - padding;
        }
        
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }

    onClick(event) {
        if (this.hoveredObject && this.hoveredObject.userData.type === 'node') {
            const nodeId = this.hoveredObject.userData.nodeId;
            
            // Toggle selection
            if (this.selectedNode === nodeId) {
                this.selectedNode = null;
                this.resetHoverState(this.hoveredObject);
            } else {
                // Reset previous selection
                if (this.selectedNode !== null) {
                    const prevNode = this.nodeMeshes[this.selectedNode];
                    if (prevNode) {
                        prevNode.material.emissive.setHex(0x004466);
                        prevNode.material.emissiveIntensity = 1;
                    }
                }
                
                this.selectedNode = nodeId;
                this.hoveredObject.material.emissive.setHex(0xffaa00);
                this.hoveredObject.material.emissiveIntensity = 2;
                
                // Show detailed stats
                this.showNodeDetails(this.hoveredObject.userData.node);
            }
        }
    }

    showNodeDetails(node) {
        const nodeChannels = this.model.channels.filter(c => 
            c.start === node.id || c.end === node.id
        );
        
        // Removed alert for cleaner UX - keeping function for future features
        // alert(`🔍 Node ${node.label} Details\n\n` +
        //       `Channels: ${nodeChannels.length}\n` +
        //       `Total Capacity: ${this.formatCapacity(nodeChannels.reduce((sum, c) => sum + c.capacity, 0))}\n\n` +
        //       `Click on different nodes to compare!`);
    }

    formatCapacity(sats) {
        if (sats >= 100000000) {
            return (sats / 100000000).toFixed(2) + " BTC";
        } else if (sats >= 1000000) {
            return (sats / 1000000).toFixed(1) + "m sats";
        } else if (sats >= 1000) {
            return (sats / 1000).toFixed(1) + "k sats";
        } else {
            return sats + " sats";
        }
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.updateTransactions();
        this.renderer.render(this.scene, this.camera);
    }

    resetCamera() {
        this.camera.position.set(0, 0, 400);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    toggleAutoRotate() {
        this.controls.autoRotate = !this.controls.autoRotate;
        return this.controls.autoRotate;
    }
}

// ============================================================================
// MODULE 3: UI Controller
// ============================================================================
class UIController {
    constructor(model, renderer) {
        this.model = model;
        this.renderer = renderer;
        this.elements = this.cacheElements();
        this.bindEvents();
    }

    cacheElements() {
        return {
            nodeCount: document.getElementById('nodeCount'),
            channelProbability: document.getElementById('channelProbability'),
            regenerate: document.getElementById('regenerate'),
            senderNode: document.getElementById('senderNode'),
            receiverNode: document.getElementById('receiverNode'),
            paymentAmount: document.getElementById('paymentAmount'),
            sendPayment: document.getElementById('sendPayment'),
            transactionTableBody: document.getElementById('transactionTableBody'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            resetCamera: document.getElementById('resetCamera'),
            autoRotate: document.getElementById('autoRotate'),
            // New UI elements
            toggleStats: document.getElementById('toggleStats'),
            statsOverlay: document.getElementById('statsOverlay'),
            statsClose: document.getElementById('statsClose'),
            transactionToggle: document.getElementById('transactionToggle'),
            transactionSection: document.querySelector('.transaction-section'),
            transactionCount: document.getElementById('transactionCount'),
            // Stats
            statTotalCapacity: document.getElementById('statTotalCapacity'),
            statChannels: document.getElementById('statChannels'),
            // statSuccessRate: document.getElementById('statSuccessRate'),
            // statTotalPayments: document.getElementById('statTotalPayments'),
            // Instructions
            instructionsToggle: document.getElementById('instructionsToggle'),
            instructionsSection: document.querySelector('.instructions-section')
        };
    }

    bindEvents() {
        this.elements.regenerate.addEventListener('click', () => this.regenerateNetwork());
        this.elements.sendPayment.addEventListener('click', () => this.sendPayment());
        this.elements.resetCamera.addEventListener('click', () => this.renderer.resetCamera());
        this.elements.autoRotate.addEventListener('click', () => {
            const isActive = this.renderer.toggleAutoRotate();
            this.elements.autoRotate.classList.toggle('active', isActive);
        });
        
        // Stats overlay toggle
        this.elements.toggleStats.addEventListener('click', () => this.toggleStatsOverlay());
        this.elements.statsClose.addEventListener('click', () => this.hideStatsOverlay());
        
        // Transaction history collapse
        this.elements.transactionToggle.addEventListener('click', () => this.toggleTransactionHistory());
        
        // Instructions collapse
        this.elements.instructionsToggle.addEventListener('click', () => this.toggleInstructions());
    }
    
    toggleStatsOverlay() {
        const isHidden = this.elements.statsOverlay.classList.toggle('hidden');
        this.elements.toggleStats.classList.toggle('active', !isHidden);
    }
    
    hideStatsOverlay() {
        this.elements.statsOverlay.classList.add('hidden');
        this.elements.toggleStats.classList.remove('active');
    }
    
    toggleTransactionHistory() {
        this.elements.transactionSection.classList.toggle('collapsed');
    }

    toggleInstructions() {
        this.elements.instructionsSection.classList.toggle('collapsed');
    }

    collapseInstructions() {
        this.elements.instructionsSection.classList.add('collapsed');
    }

    showLoading() {
        this.elements.loadingOverlay.classList.add('active');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.remove('active');
    }

    regenerateNetwork() {
        this.showLoading();
        
        setTimeout(() => {
            const numNodes = parseInt(this.elements.nodeCount.value);
            const channelProbability = parseFloat(this.elements.channelProbability.value);
            
            this.model.generateNetwork(numNodes, channelProbability);
            this.renderer.renderNetwork();
            this.populateNodeDropdowns();
            this.updateStats();
            
            this.hideLoading();
        }, 100);
    }

    populateNodeDropdowns() {
        this.elements.senderNode.innerHTML = '';
        this.elements.receiverNode.innerHTML = '';
        
        this.model.nodes.forEach((node, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Node ${node.label}`;
            this.elements.senderNode.appendChild(option.cloneNode(true));
            this.elements.receiverNode.appendChild(option);
        });
        
        // Set different default values
        if (this.model.nodes.length > 1) {
            this.elements.receiverNode.selectedIndex = this.model.nodes.length - 1;
        }
    }

    sendPayment() {
        const senderIndex = parseInt(this.elements.senderNode.value);
        const receiverIndex = parseInt(this.elements.receiverNode.value);
        const paymentAmount = parseInt(this.elements.paymentAmount.value);

        if (senderIndex === receiverIndex) {
            alert("⚠️ Sender and receiver must be different nodes.");
            return;
        }

        const { path, totalFees } = this.model.findPath(senderIndex, receiverIndex, paymentAmount);
        
        if (path.length === 0) {
            this.addTransaction({
                from: this.model.nodes[senderIndex].label,
                to: this.model.nodes[receiverIndex].label,
                amount: paymentAmount,
                status: 'Failed',
                reason: 'No path found',
                timestamp: new Date()
            });
            alert(`❌ No path found for payment of ${this.formatCapacity(paymentAmount)}.\n\nTry:\n• Smaller amount\n• Different nodes\n• Regenerate network with more channels`);
            return;
        }

        // Highlight path
        this.renderer.highlightPath(path);

        // Animate payment
        this.renderer.animatePayment(path, () => {
            // Update channel balances after animation
            this.model.updateChannelBalances(path, paymentAmount, totalFees);
            
            // Update only channel visuals (colors) without full re-render
            this.renderer.updateChannelVisuals();
            
            // Re-highlight the path to maintain visual feedback
            this.renderer.highlightPath(path);
            
            this.updateStats();
        });

        // Add transaction immediately
        this.addTransaction({
            from: this.model.nodes[senderIndex].label,
            to: this.model.nodes[receiverIndex].label,
            amount: paymentAmount,
            path: path.map(id => this.model.nodes[id].label),
            fees: totalFees,
            hops: path.length - 1,
            status: 'Success',
            timestamp: new Date()
        });
    }

    addTransaction(transaction) {
        this.model.addTransaction(transaction);
        this.updateTransactionTable();
        this.updateStats();
    }

    updateTransactionTable() {
        this.elements.transactionTableBody.innerHTML = '';
        
        // Update transaction counter
        const count = this.model.transactionHistory.length;
        this.elements.transactionCount.textContent = `${count} transaction${count !== 1 ? 's' : ''}`;
        
        // Show empty state if no transactions
        if (count === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'empty-state';
            emptyRow.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 2rem; color: #999;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    No transactions yet. Send your first payment to get started!
                </td>
            `;
            this.elements.transactionTableBody.appendChild(emptyRow);
            return;
        }
        
        this.model.transactionHistory.forEach((tx, index) => {
            const row = document.createElement('tr');
            row.className = 'transaction-new';
            
            const statusBadge = tx.status === 'Success' 
                ? '<span class="status-badge status-success">✓ Success</span>'
                : '<span class="status-badge status-failed">✗ Failed</span>';
            
            const pathDisplay = tx.path 
                ? `<span class="path-display">${tx.path.join(' → ')}</span>`
                : 'N/A';
            
            row.innerHTML = `
                <td>${this.model.transactionHistory.length - index}</td>
                <td>${this.formatTime(tx.timestamp)}</td>
                <td><strong>${tx.from}</strong></td>
                <td><strong>${tx.to}</strong></td>
                <td>${this.formatCapacity(tx.amount)}</td>
                <td>${statusBadge}</td>
                <td>${tx.fees ? this.formatCapacity(tx.fees) : 'N/A'}</td>
                <td>${pathDisplay}</td>
                <td>${tx.hops || 'N/A'}</td>
            `;
            
            this.elements.transactionTableBody.appendChild(row);
        });
    }

    updateStats() {
        const stats = this.model.getStats();
        
        this.elements.statTotalCapacity.textContent = (stats.totalCapacity / 100000000).toFixed(2) + ' BTC';
        this.elements.statChannels.textContent = stats.channelCount;
        // this.elements.statSuccessRate.textContent = stats.successRate + '%';
        // this.elements.statTotalPayments.textContent = stats.totalPayments;
    }

    formatCapacity(sats) {
        if (sats >= 100000000) {
            return (sats / 100000000).toFixed(2) + " BTC";
        } else if (sats >= 1000000) {
            return (sats / 1000000).toFixed(1) + "m sats";
        } else if (sats >= 1000) {
            return (sats / 1000).toFixed(1) + "k sats";
        } else {
            return sats + " sats";
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString();
    }
}

// ============================================================================
// MODULE 4: Application Initialization
// ============================================================================
class LightningNetworkSimulator {
    constructor() {
        this.model = new NetworkModel();
        this.renderer = null;
        this.ui = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    start() {
        const container = document.getElementById('network3d');
        
        if (!container) {
            console.error('Network container not found');
            return;
        }

        // Initialize renderer
        this.renderer = new Network3DRenderer(container, this.model);
        
        // Initialize UI controller
        this.ui = new UIController(this.model, this.renderer);
        
        // Generate initial network
        this.ui.regenerateNetwork();
        
        // Auto-collapse instructions after 20 seconds
        setTimeout(() => this.ui.collapseInstructions(), 20000);
        
        console.log('⚡ Lightning Network Simulator 3D initialized!');
    }
}

// ============================================================================
// Start the application
// ============================================================================
const app = new LightningNetworkSimulator();
