class BitcoinAnalytics {
    constructor() {
        this.API_BASE = 'https://mempool.space/api';
        this.BLOCKS_PER_DAY = 144;
        this.blocks = [];
        this.latestBlockVolume = 0;
    }

    satoshiToBTC(satoshi) {
        return (satoshi / 100000000).toFixed(8); // Corrected BTC conversion
    }

    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    formatBTC(btc) {
        return `${this.formatNumber(parseFloat(btc).toFixed(2))} BTC`;
    }

    formatBTCRate(btc) {
        return `${parseFloat(btc).toFixed(4)} BTC/s`;
    }

    formatSize(bytes) {
        return (bytes / 1024 / 1024).toFixed(2);
    }

   async calculateLatestBlockVolume(hash) {
    try {
        const txids = await this.fetchData(`${this.API_BASE}/block/${hash}/txids`);
        const totalTxCount = txids.length;
        const sampleSize = Math.max(Math.floor(totalTxCount * 0.1), 1); // 10% of transactions, minimum 1
        
        // Generate random unique indices for 10% of transactions
        const randomIndices = new Set();
        while (randomIndices.size < sampleSize) {
            const randomIndex = Math.floor(Math.random() * totalTxCount);
            randomIndices.add(randomIndex);
        }
        
        // Get transactions for random indices
        const randomTxids = Array.from(randomIndices).map(index => txids[index]);
        let totalVolume = 0;

        for (const txid of randomTxids) {
            const tx = await this.fetchData(`${this.API_BASE}/tx/${txid}`);
            const inputAddresses = new Set();
            
            // Collect input addresses
            for (const input of tx.vin) {
                if (input.prevout) {
                    inputAddresses.add(input.prevout.scriptpubkey_address);
                }
            }

            // Sum outputs excluding change
            for (const output of tx.vout) {
                if (output.scriptpubkey_address && !inputAddresses.has(output.scriptpubkey_address)) {
                    totalVolume += output.value;
                }
            }
        }

        // Extrapolate to full block
        const extrapolatedVolume = (totalVolume * totalTxCount) / sampleSize;
        return extrapolatedVolume;

    } catch (error) {
        console.error('Error calculating latest block volume:', error);
        return 0;
    }
}

    displaySummaryMetrics() {
        const totalTransactions = this.blocks.reduce((sum, block) => sum + block.tx_count, 0);
        const totalSeconds = this.blocks.length * 600;

        const summary = {
            totalBlocks: this.blocks.length,
            totalTransactions: totalTransactions,
            avgTps: (totalTransactions / totalSeconds).toFixed(2),
            avgBlockSize: this.formatSize(
                this.blocks.reduce((sum, block) => sum + block.size, 0) / this.blocks.length
            ),
            btcPerBlock: this.satoshiToBTC(this.latestBlockVolume),
            btcPerSecond: this.satoshiToBTC(this.latestBlockVolume / 600),
            btcPerDay: this.satoshiToBTC(this.latestBlockVolume * 144)
        };

        const metricsHtml = `
            <div class="metric-card">
                <h3>Total Blocks</h3>
                <div class="value">${this.formatNumber(summary.totalBlocks)}</div>
            </div>
            <div class="metric-card">
                <h3>Total Transactions</h3>
                <div class="value">${this.formatNumber(summary.totalTransactions)}</div>
            </div>
            <div class="metric-card">
                <h3>Average TPS</h3>
                <div class="value">${summary.avgTps}</div>
            </div>
            <div class="metric-card">
                <h3>Average Block Size</h3>
                <div class="value">${summary.avgBlockSize} MB</div>
            </div>

            <div class="metric-card">
            <h3>Estimated BTC per Day</h3>
            <div class="value">${this.formatBTC(summary.btcPerDay)}</div>
                        </div>

            <div class="metric-card">
                <h3>Estimated BTC per Block</h3>
                <div class="value">${this.formatBTC(summary.btcPerBlock)}</div>
            </div>
            <div class="metric-card">
                <h3>Estimated BTC per Second</h3>
                <div class="value">${this.formatBTCRate(summary.btcPerSecond)}</div>
            </div>
        `;

        document.getElementById('summaryMetrics').innerHTML = metricsHtml;
    }

    displayHourlyMetrics() {
    const hourlyData = {};
    
    this.blocks.forEach(block => {
        const date = new Date(block.timestamp * 1000);
        const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;

        if (!hourlyData[hourKey]) {
            hourlyData[hourKey] = {
                blocks: 0,
                transactions: 0,
                size: 0
            };
        }

        hourlyData[hourKey].blocks++;
        hourlyData[hourKey].transactions += block.tx_count;
        hourlyData[hourKey].size += block.size;
    });

    const tbody = Object.entries(hourlyData)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([hour, data]) => {
            const secondsInHour = data.blocks * 600;
            return `
                <tr>
                    <td>${hour}</td>
                    <td>${data.blocks}</td>
                    <td>${this.formatNumber(data.transactions)}</td>
                    <td>${(data.transactions / secondsInHour).toFixed(2)}</td>
                    <td>${this.formatSize(data.size)}</td>
                </tr>
            `;
        }).join('');

    document.querySelector('#hourlyMetrics tbody').innerHTML = tbody;
}

    async fetchData(url) {
        const response = await fetch(url);
        const contentType = response.headers.get('content-type');
        return contentType && contentType.includes('application/json') 
            ? await response.json() 
            : await response.text();
    }

    updateProgress(current, total) {
        const progress = (current / total) * 100;
        document.getElementById('currentBlock').textContent = current;
        document.getElementById('progress').style.width = `${progress}%`;
    }

    async initialize() {
    try {
        // Phase 1: Initial Setup (0-10%)
        const latestHeight = await this.fetchData(`${this.API_BASE}/blocks/tip/height`);
        const startHeight = latestHeight - this.BLOCKS_PER_DAY + 1;
        this.updateProgress(1, this.BLOCKS_PER_DAY);
        
        // Phase 2: Load all blocks (10-80%)
        for (let height = startHeight; height <= latestHeight; height++) {
            const hash = await this.fetchData(`${this.API_BASE}/block-height/${height}`);
            const blockInfo = await this.fetchData(`${this.API_BASE}/block/${hash}`);
            this.blocks.push(blockInfo);
            // Scale progress to 80%
            const scaledProgress = Math.floor((this.blocks.length / this.BLOCKS_PER_DAY) * 80);
            this.updateProgress(scaledProgress, 100);
        }

        // Phase 3: Calculate volume for latest block (80-100%)
        document.getElementById('currentBlock').textContent = "Calculating volume...";
        const latestHash = await this.fetchData(`${this.API_BASE}/block-height/${latestHeight}`);
        this.updateProgress(90, 100);
        
        this.latestBlockVolume = await this.calculateLatestBlockVolume(latestHash);
        this.updateProgress(100, 100);

        // Phase 4: Display results
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
        
        this.displaySummaryMetrics();
        this.displayHourlyMetrics();

    } catch (error) {
        console.error('Error:', error);
        document.body.innerHTML += `
            <div style="color: red; padding: 1rem; text-align: center;">
                Error: ${error.message}
            </div>
        `;
    }
}
}

document.addEventListener('DOMContentLoaded', () => {
    const analytics = new BitcoinAnalytics();
    analytics.initialize();
});