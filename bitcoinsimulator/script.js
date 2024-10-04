// Simple SHA-256 hash function (for demonstration purposes)
function sha256(ascii) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(ascii).digest('hex');
}

let blockchain = [];
let transactionPool = [];
let mining = false;
const miningReward = 10; // Reward for mining a block

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
    mineBlock(difficulty);
});

function mineBlock(difficulty) {
    const previousBlock = blockchain[blockchain.length - 1];
    const index = previousBlock ? previousBlock.index + 1 : 0;
    const timestamp = new Date().getTime();
    let nonce = 0;
    let hash;

    // Include transactions in the block
    const transactionsToMine = [...transactionPool];

    do {
        nonce++;
        hash = sha256(index + timestamp + nonce + (previousBlock ? previousBlock.hash : '') + JSON.stringify(transactionsToMine));
    } while (hash.substring(0, difficulty) !== '0'.repeat(difficulty));

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
