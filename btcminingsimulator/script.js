let blockchain = [];
let transactionPool = [];
let mining = false;
const miningReward = 10; // Reward for mining a block

// Function to generate a random transaction
function generateRandomTransaction() {
    const randomRecipient = `User${Math.floor(Math.random() * 100)}`;
    const randomAmount = Math.floor(Math.random() * 10) + 1; // Random amount between 1 and 10
    return { recipient: randomRecipient, amount: randomAmount };
}

document.getElementById('addTransaction').addEventListener('click', () => {
    const recipient = document.getElementById('recipient').value;
    const amount = parseFloat(document.getElementById('amount').value);

    if (!recipient || isNaN(amount) || amount <= 0) {
        alert('Invalid transaction details.');
        return;
    }

    const transaction = { recipient, amount };
    transactionPool.push(transaction);
    updateTransactionList();
    document.getElementById('recipient').value = '';
    document.getElementById('amount').value = '';
});

document.getElementById('startMining').addEventListener('click', () => {
    const difficulty = parseInt(document.getElementById('difficulty').value);
    if (mining) {
        alert('Mining is already in progress!');
        return;
    }
    mining = true;
    document.getElementById('miningStatus').innerText = 'Mining in progress...';
    document.getElementById('miningVisualization').innerText = ''; // Clear previous visualization
    document.getElementById('explanationText').innerText = ''; // Clear previous explanation
    document.getElementById('hashInputs').innerText = ''; // Clear previous hash inputs

    // Add a random transaction to the pool
    const randomTransaction = generateRandomTransaction();
    transactionPool.push(randomTransaction);
    updateTransactionList();

    // Simulate mining process
    setTimeout(() => {
        mineBlock(difficulty);
    }, 1000); // Simulate a delay for mining
});

function mineBlock(difficulty) {
    const previousBlock = blockchain[blockchain.length - 1];
    const index = previousBlock ? previousBlock.index + 1 : 0;
    const timestamp = new Date().getTime();
    let nonce = 0;
    let hash;

    // Include transactions in the block
    const transactionsToMine = [...transactionPool];

    // Simulate the mining process
    let validHashFound = false;
    const leadingZeros = '0'.repeat(difficulty);
    let visualization = '';

    // Example calculation for educational purposes
    const exampleIndex = index;
    const exampleTimestamp = timestamp;
    const examplePreviousHash = previousBlock ? previousBlock.hash : '0';
    let exampleNonce = 0;
    let exampleHash;

    while (!validHashFound) {
        nonce++;
        hash = sha256(index + timestamp + nonce + (previousBlock ? previousBlock.hash : '') + JSON.stringify(transactionsToMine));
        
        // Update visualization
        visualization += `Trying nonce: ${nonce} => Hash: ${hash}\n`;
        document.getElementById('miningVisualization').innerText = visualization;

        // Explanation for the user
        if (nonce === 1) {
            document.getElementById('explanationText').innerText = `Starting the mining process with difficulty ${difficulty}. We need a hash that starts with ${leadingZeros}.`;
        }

        if (hash.substring(0, difficulty) === leadingZeros) {
            validHashFound = true;
            document.getElementById('explanationText').innerText += ` Found a valid hash on attempt ${nonce}: ${hash}. This hash starts with ${leadingZeros}, which meets the difficulty requirement!`;
            // Show the actual string used for hashing
            const hashInputString = `Index: ${index}, Timestamp: ${timestamp}, Nonce: ${nonce}, Previous Hash: ${examplePreviousHash}, Transactions: ${JSON.stringify(transactionsToMine)}`;
            document.getElementById('hashInputs').innerText = `Hash Input String: ${hashInputString}`;
        }

        // Example calculation to find a solution in 3-7 attempts
        if (exampleNonce < 7) {
            exampleNonce++;
            exampleHash = sha256(exampleIndex + exampleTimestamp + exampleNonce + examplePreviousHash + JSON.stringify(transactionsToMine));
            if (exampleHash.substring(0, difficulty) === leadingZeros) {
                document.getElementById('exampleCalculation').innerText = `Example Nonce: ${exampleNonce}, Hash: ${exampleHash}`;
                break;
            }
        }
    }

    const newBlock = {
        index,
        timestamp,
        nonce,
        hash,
        previousHash: previousBlock ? previousBlock.hash : '0',
        transactions: transactionsToMine
    };

    // Add mining reward transaction
    const rewardTransaction = { recipient: 'miner', amount: miningReward };
    blockchain.push(newBlock);
    transactionPool = []; // Clear the transaction pool after mining
    updateBlockchainDisplay();
    updateTransactionList();
    mining = false;
    document.getElementById('miningStatus').innerText = `Mined a new block: ${newBlock.hash}`;
}

function updateBlockchainDisplay() {
    const blocksDiv = document.getElementById('blocks');
    blocksDiv.innerHTML = '';
    blockchain.forEach(block => {
        const blockDiv = document.createElement('div');
        blockDiv.innerHTML = `
            <strong>Block ${block.index}</strong><br>
            Hash: ${block.hash}<br>
            Previous Hash: ${block.previousHash}<br>
            Nonce: ${block.nonce}<br>
            Timestamp: ${new Date(block.timestamp).toLocaleString()}<br>
            Transactions: ${JSON.stringify(block.transactions)}<br><br>
        `;
        blocksDiv.appendChild(blockDiv);
    });
}

function updateTransactionList() {
    const transactionList = document.getElementById('transactionList');
    transactionList.innerHTML = '';
    transactionPool.forEach((tx, index) => {
        const li = document.createElement('div');
        li.innerText = `Transaction ${index + 1}: ${tx.amount} BTC to ${tx.recipient}`;
        transactionList.appendChild(li);
    });
}