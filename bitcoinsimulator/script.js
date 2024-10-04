let balance = 0;
let transactions = [];
let walletAddress = '';

document.getElementById('createWallet').addEventListener('click', () => {
    walletAddress = 'Wallet-' + Math.random().toString(36).substring(2, 15);
    balance = 100; // Starting balance for the wallet
    document.getElementById('balance').innerText = balance;
    alert(`Wallet created: ${walletAddress}`);
});

document.getElementById('sendTransaction').addEventListener('click', () => {
    const recipient = document.getElementById('recipient').value;
    const amount = parseFloat(document.getElementById('amount').value);

    if (!recipient || isNaN(amount) || amount <= 0 || amount > balance) {
        alert('Invalid transaction details.');
        return;
    }

    transactions.push({ recipient, amount });
    balance -= amount;
    document.getElementById('balance').innerText = balance;
    updateTransactionList();
    alert(`Transaction of ${amount} BTC sent to ${recipient}`);
});

document.getElementById('mineBlock').addEventListener('click', () => {
    if (transactions.length === 0) {
        alert('No transactions to mine.');
        return;
    }

    const minedBlock = `Mined a block with transactions: ${JSON.stringify(transactions)}`;
    document.getElementById('minedBlock').innerText = minedBlock;
    transactions = []; // Clear transactions after mining
    updateTransactionList();
});

function updateTransactionList() {
    const transactionList = document.getElementById('transactionList');
    transactionList.innerHTML = '';
    transactions.forEach((tx, index) => {
        const li = document.createElement('li');
        li.innerText = `Transaction ${index + 1}: ${tx.amount} BTC to ${tx.recipient}`;
        transactionList.appendChild(li);
    });
}
