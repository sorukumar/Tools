// This simulator demonstrates the basic concepts of a Lightning Network:
// - Nodes: Participants in the network
// - Channels: Payment channels between nodes
// - Routing: Finding a path to send payments between nodes

const network = document.querySelector('.network');
const nodeCountSelect = document.getElementById('nodeCount');
const channelProbabilitySelect = document.getElementById('channelProbability');
const regenerateButton = document.getElementById('regenerate');
const sendPaymentButton = document.getElementById('sendPayment');
const tooltip = document.getElementById('tooltip');

let nodes = [];
let channels = [];
let transactionHistory = [];

// Generates a random Lightning Network with the specified number of nodes and channel probability
function generateNetwork() {
    network.innerHTML = '';
    nodes = [];
    channels = [];

    const numNodes = parseInt(nodeCountSelect.value);
    const channelProbability = parseFloat(channelProbabilitySelect.value);

    const networkRect = network.getBoundingClientRect();
    const networkWidth = networkRect.width;
    const networkHeight = networkRect.height;

    for (let i = 0; i < numNodes; i++) {
        const node = document.createElement('div');
        node.className = 'node';
        node.textContent = String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) : '');
        node.style.left = `${Math.random() * (networkWidth - 30)}px`;
        node.style.top = `${Math.random() * (networkHeight - 30)}px`;
        network.appendChild(node);
        nodes.push(node);
    }

    for (let i = 0; i < numNodes; i++) {
        for (let j = i + 1; j < numNodes; j++) {
            if (Math.random() < channelProbability) {
                const channel = document.createElement('div');
                channel.className = 'channel';
                network.appendChild(channel);
                const capacity = generateCapacity();
                const channelClass = getChannelClass(capacity);
                channel.classList.add(channelClass);
                const balance1 = Math.floor(capacity * Math.random());
                const channelData = {
                    element: channel,
                    start: i,
                    end: j,
                    capacity: capacity,
                    balance1: balance1,
                    balance2: capacity - balance1,
                    baseFee: 1000,
                    feeRate: 0.001
                };
                channels.push(channelData);

                channel.addEventListener('mouseenter', (e) => showTooltip(e, channelData));
                channel.addEventListener('mouseleave', hideTooltip);
            }
        }
    }

    updateChannels(networkRect); // Pass it to updateChannels
    populateNodeDropdowns();
    validateChannelBalances();
}

// Simulates the random capacity of a payment channel
function generateCapacity() {
    const capacities = [
        1000000, 5000000, 10000000, 20000000, 30000000, 40000000, 50000000,
        60000000, 70000000, 80000000, 90000000, 100000000, 200000000
    ];
    return capacities[Math.floor(Math.random() * capacities.length)];
}

function formatCapacity(sats) {
    if (sats >= 100000000) {
        return (sats / 100000000).toFixed(2) + " BTC";
    } else {
        return (sats / 1000000).toFixed(2) + "m sats";
    }
}

function updateChannels(networkRect) {
    channels.forEach(channel => {
        const start = nodes[channel.start].getBoundingClientRect();
        const end = nodes[channel.end].getBoundingClientRect();
        const dx = end.left - start.left;
        const dy = end.top - start.top;
        const length = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        const minWidth = 1;
        const maxWidth = 5;
        const minCapacity = 1000000; // 1m sats
        const maxCapacity = 200000000; // 2 BTC
        
        const logWidth = Math.log(channel.capacity / minCapacity) / Math.log(maxCapacity / minCapacity);
        const width = minWidth + (maxWidth - minWidth) * logWidth;
        
        channel.element.style.width = `${length}px`;
        channel.element.style.height = `${width}px`;
        channel.element.style.left = `${start.left - networkRect.left + 15}px`;
        channel.element.style.top = `${start.top - networkRect.top + 15}px`;
        channel.element.style.transform = `rotate(${angle}deg)`;

        visualizeChannelBalance(channel);
    });
}

function visualizeChannelBalance(channel) {
    const balance1Percent = (channel.balance1 / channel.capacity) * 100;
    
    const balance1Element = document.createElement('div');
    balance1Element.className = 'channel-balance balance1';
    balance1Element.style.width = `${balance1Percent}%`;
    
    const balance2Element = document.createElement('div');
    balance2Element.className = 'channel-balance balance2';
    balance2Element.style.width = `${100 - balance1Percent}%`;
    
    channel.element.innerHTML = '';
    channel.element.appendChild(balance1Element);
    channel.element.appendChild(balance2Element);
}

function showTooltip(event, channel) {
    tooltip.innerHTML = `
        Total Capacity: ${formatCapacity(channel.capacity)}<br>
        Node ${nodes[channel.start].textContent} Balance: ${formatCapacity(channel.balance1)}<br>
        Node ${nodes[channel.end].textContent} Balance: ${formatCapacity(channel.balance2)}
    `;
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
    tooltip.style.opacity = 1;
}

function hideTooltip() {
    tooltip.style.opacity = 0;
}

function populateNodeDropdowns() {
    const senderSelect = document.getElementById('senderNode');
    const receiverSelect = document.getElementById('receiverNode');
    senderSelect.innerHTML = '';
    receiverSelect.innerHTML = '';
    
    nodes.forEach((node, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = node.textContent;
        senderSelect.appendChild(option.cloneNode(true));
        receiverSelect.appendChild(option);
    });
}

function getChannelClass(capacity) {
    if (capacity < 5000001) return 'Myway';
    if (capacity < 100000001) return 'Highway';
    return 'Freeway';
}

// Implements a simple pathfinding algorithm to route payments through the network
function findPathWithCapacity(start, end, amount) {
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
            const neighbors = channels
                .filter(c => {
                    if (c.start === node && c.balance1 >= amount + fees.get(node)) return true;
                    if (c.end === node && c.balance2 >= amount + fees.get(node)) return true;
                    return false;
                })
                .map(c => c.start === node ? c.end : c.start);
            
            for (const neighbor of neighbors) {
                const channel = channels.find(c => 
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

function highlightPath(path) {
    path.forEach((nodeIndex, i) => {
        if (i < path.length - 1) {
            const channel = channels.find(c => 
                (c.start === nodeIndex && c.end === path[i + 1]) || 
                (c.end === nodeIndex && c.start === path[i + 1])
            );
            if (channel) {
                channel.element.classList.add('highlighted');
            }
        }
        nodes[nodeIndex].classList.add('highlighted');
    });
}

function clearHighlights() {
    channels.forEach(channel => channel.element.classList.remove('highlighted'));
    nodes.forEach(node => node.classList.remove('highlighted'));
}

// Simulates and visualizes a payment being routed through the network
function animateTransaction() {
    const senderIndex = parseInt(document.getElementById('senderNode').value);
    const receiverIndex = parseInt(document.getElementById('receiverNode').value);
    const paymentAmount = parseInt(document.getElementById('paymentAmount').value);

    if (senderIndex === receiverIndex) {
        alert("Sender and receiver must be different nodes.");
        return;
    }

    const { path, totalFees } = findPathWithCapacity(senderIndex, receiverIndex, paymentAmount);
    if (path.length === 0) {
        const failedTransaction = {
            attempt: transactionHistory.length + 1,
            from: nodes[senderIndex].textContent,
            to: nodes[receiverIndex].textContent,
            amount: paymentAmount,
            status: 'Failed',
            reason: 'No path found'
        };
        addTransactionToHistory(failedTransaction);
        alert(`No path found for the payment of ${formatCapacity(paymentAmount)}. Try a smaller amount or choose different nodes.`);
        return;
    }

    clearHighlights();
    highlightPath(path);

    const transaction = document.createElement('div');
    transaction.className = 'transaction';
    network.appendChild(transaction);

    let step = 0;
    function animate() {
        if (step >= path.length - 1) {
            transaction.remove();
            const updatedBalances = updateChannelBalances(path, paymentAmount, totalFees);
            validateChannelBalances();
            
            const successfulTransaction = {
                attempt: transactionHistory.length + 1,
                from: nodes[senderIndex].textContent,
                to: nodes[receiverIndex].textContent,
                amount: paymentAmount,
                path: path.map(nodeIndex => nodes[nodeIndex].textContent),
                fees: totalFees,
                status: 'Success',
                updatedBalances: updatedBalances
            };
            addTransactionToHistory(successfulTransaction);
            
            alert(`Payment of ${formatCapacity(paymentAmount)} successfully sent from Node ${nodes[senderIndex].textContent} to Node ${nodes[receiverIndex].textContent}\nTotal fees paid: ${formatCapacity(totalFees)}`);
            return;
        }

        const startNode = nodes[path[step]];
        const endNode = nodes[path[step + 1]];
        const start = startNode.getBoundingClientRect();
        const end = endNode.getBoundingClientRect();
        const startX = start.left - networkRect.left + 15;
        const startY = start.top - networkRect.top + 15;
        const endX = end.left - networkRect.left + 15;
        const endY = end.top - networkRect.top + 15;

        transaction.style.display = 'block';
        transaction.style.left = `${startX}px`;
        transaction.style.top = `${startY}px`;

        const duration = 1000;
        const startTime = Date.now();

        function moveTransaction() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const x = startX + (endX - startX) * progress;
            const y = startY + (endY - startY) * progress;
            transaction.style.left = `${x}px`;
            transaction.style.top = `${y}px`;

            if (progress < 1) {
                requestAnimationFrame(moveTransaction);
            } else {
                step++;
                animate();
            }
        }

        moveTransaction();
    }

    animate();
}

function updateChannelBalances(path, amount, fees) {
    let remainingAmount = amount + fees;
    const updatedBalances = [];
    for (let i = 0; i < path.length - 1; i++) {
        const channel = channels.find(c => 
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
        
        updatedBalances.push({
            channel: `${nodes[channel.start].textContent}-${nodes[channel.end].textContent}`,
            balance1: channel.balance1,
            balance2: channel.balance2
        });
    }
    updateChannels();
    return updatedBalances;
}

function validateChannelBalances() {
    channels.forEach(channel => {
        if (channel.balance1 + channel.balance2 !== channel.capacity) {
            console.error('Invalid channel balance:', channel);
        }
    });
}

function addTransactionToHistory(transaction) {
    transactionHistory.push(transaction);
    updateTransactionTable();
}

function updateTransactionTable() {
    const tableBody = document.getElementById('transactionTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    transactionHistory.forEach(transaction => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${transaction.attempt}</td>
            <td>${transaction.from}</td>
            <td>${transaction.to}</td>
            <td>${formatCapacity(transaction.amount)}</td>
            <td>${transaction.status}</td>
            <td>${transaction.status === 'Success' ? formatCapacity(transaction.fees) : 'N/A'}</td>
            <td>${transaction.status === 'Success' ? transaction.path.join(' → ') : 'N/A'}</td>
            <td>${transaction.status === 'Success' ? formatUpdatedBalances(transaction.updatedBalances) : 'N/A'}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function formatUpdatedBalances(balances) {
    return balances.map(b => `${b.channel}: ${formatCapacity(b.balance1)} | ${formatCapacity(b.balance2)}`).join('<br>');
}

regenerateButton.addEventListener('click', generateNetwork);
sendPaymentButton.addEventListener('click', animateTransaction);

// Initial network generation
generateNetwork();

// Add a window resize event listener to update the network when the window is resized
window.addEventListener('resize', () => {
    updateChannels();
});
