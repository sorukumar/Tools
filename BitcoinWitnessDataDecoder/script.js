// Utility functions
function isValidHex(str) {
    // Remove any whitespace and common separators
    const cleaned = str.replace(/[\s\n\r]/g, '');
    // Check if it's valid hex after cleaning
    return /^[0-9a-fA-F]*$/.test(cleaned);
}

function hexToBytes(hex) {
    return hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
}

function hexToAscii(hex) {
    const bytes = hexToBytes(hex);
    return bytes.map(byte => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.').join('');
}

// Example data
const examples = {
    p2wpkh: {
        data: "304402203a0f5f0e1f2bdbcd04db3061d18f3af70e07f4f467cbc1b8116f267025f5360b0220472b88f391186fbaa2d735d0630f241650f2874c47ac794e0be95b72fd1d57b901210279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        description: "Standard P2WPKH witness with DER signature and compressed public key",
        txReference: {
            note: "To find similar transactions:",
            steps: [
                "Visit mempool.space",
                "Look for transactions with 1 input and witness size ~108 bytes",
                "Check for native SegWit addresses (bc1q...)"
            ],
            explorerUrl: "https://mempool.space"
        }
    },
    p2wsh: {
        data: "304402200af4e47c9b9629dbecc21f73af989bdaa911f7e6f6c2e9394588a3aa68f81e9902204f3fcf6ade7e5abb1295b6774c8e0abd94ae62217367096bc02ee5e435b67da201210279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ac",
        description: "P2WSH witness with signature and witness script",
        txReference: {
            note: "To find similar transactions:",
            steps: [
                "Visit mempool.space",
                "Look for transactions with witness size >200 bytes",
                "Check for P2WSH addresses (bc1q...)"
            ],
            explorerUrl: "https://mempool.space"
        }
    },
    ordinal: {
        data: "0063036f726401010f746578742f706c61696e0048656c6c6f",
        description: "Ordinal inscription with text content",
        txReference: {
            note: "To find ordinal inscriptions:",
            steps: [
                "Visit ordinals.com/inscriptions",
                "Look for recent text inscriptions",
                "Check witness data in inscription transaction"
            ],
            explorerUrl: "https://ordinals.com"
        }
    },
    taproot: {
        data: "4140b32d0b2c9ed336e2c8f1c6f53bd1e0c6b91d34c0b4f8dcd8bbc9a1cea8a15c25d5383717a3c49d4788d787d973815e9d6e04d18f7b655886ecd049f9d8a578",
        description: "Taproot key path spend with Schnorr signature",
        txReference: {
            note: "To find Taproot transactions:",
            steps: [
                "Visit mempool.space",
                "Look for Taproot inputs (bc1p...)",
                "Check for 64-byte Schnorr signatures"
            ],
            explorerUrl: "https://mempool.space"
        }
    }
};

// Decoder functions
const decoders = {
    p2wpkh: function(hex) {
        if (hex.length >= 210 && hex.length <= 216) {
            const sigLength = parseInt(hex.slice(2, 4), 16);
            if (sigLength >= 69 && sigLength <= 71) {
                const signature = hex.slice(0, (sigLength + 3) * 2);
                const publicKey = hex.slice((sigLength + 3) * 2);
                
                return {
                    type: 'P2WPKH',
                    details: {
                        signature: {
                            hex: signature,
                            size: `${sigLength} bytes`,
                            type: 'DER-encoded ECDSA'
                        },
                        publicKey: {
                            hex: publicKey,
                            size: '33 bytes',
                            type: 'Compressed'
                        }
                    },
                    metadata: {
                        witnessVersion: 0,
                        totalSize: `${hex.length / 2} bytes`,
                        format: 'Native SegWit'
                    }
                };
            }
        }
        return null;
    },

    p2wsh: function(hex) {
        let pos = 0;
        const items = [];
        
        while (pos < hex.length) {
            const size = parseInt(hex.slice(pos, pos + 2), 16);
            pos += 2;
            const item = hex.slice(pos, pos + size * 2);
            
            items.push({
                type: size === 32 ? 'Script Hash' : 
                      item.startsWith('30') ? 'DER Signature' : 'Script',
                value: item,
                size: `${size} bytes`
            });
            
            pos += size * 2;
        }

        if (items.length > 1) {
            return {
                type: 'P2WSH',
                details: {
                    stackItems: items
                },
                metadata: {
                    itemCount: items.length,
                    totalSize: `${hex.length / 2} bytes`,
                    witnessVersion: 0,
                    format: 'Native SegWit'
                }
            };
        }
        return null;
    },

     ordinal: function(hex) {
        // Clean the input first
        hex = hex.replace(/[\s\n\r]/g, '');
        
        // Check for the ord marker (0063036f7264)
        if (hex.includes('0063036f7264')) {
            try {
                // Find the start of the ord protocol marker
                const ordStart = hex.indexOf('0063036f7264');
                // Extract the relevant portion
                const relevantHex = hex.slice(ordStart);
                
                // Parse components
                let pos = 12; // Skip the ord marker
                const version = relevantHex.slice(pos, pos + 2);
                pos += 2;
                
                // Get content type length and content
                const contentTypeLength = parseInt(relevantHex.slice(pos, pos + 2), 16);
                pos += 2;
                
                const contentType = hexToAscii(relevantHex.slice(pos, pos + contentTypeLength * 2));
                pos += contentTypeLength * 2;
                
                // Get content (remaining data)
                const content = hexToAscii(relevantHex.slice(pos + 2)); // +2 to skip size byte

                return {
                    type: 'Ordinal Inscription',
                    details: {
                        contentType: contentType,
                        content: content.length > 100 ? content.substring(0, 100) + '...' : content,
                        protocol: 'ord'
                    },
                    metadata: {
                        version: parseInt(version, 16),
                        totalSize: `${hex.length / 2} bytes`,
                        format: 'Taproot Script Path',
                        fullHex: hex
                    }
                };
            } catch (e) {
                console.error('Error parsing ordinal:', e);
                return null;
            }
        }
        return null;
    },

    taproot: function(hex) {
        if (hex.length === 128 || (hex.length > 128 && hex.startsWith('01'))) {
            const isKeyPath = hex.length === 128;
            
            return {
                type: 'Taproot',
                details: {
                    spendType: isKeyPath ? 'Key Path' : 'Script Path',
                    signature: isKeyPath ? hex : hex.slice(2, 130),
                    script: !isKeyPath ? hex.slice(130) : null
                },
                metadata: {
                    signatureType: 'Schnorr',
                    witnessVersion: 1,
                    format: 'Taproot',
                    totalSize: `${hex.length / 2} bytes`
                }
            };
        }
        return null;
    }
};

// Main decode function
function decodeWitnessData() {
    const witnessData = document.getElementById('witnessInput').value.trim();
    const resultDiv = document.getElementById('result');

    if (!witnessData) {
        resultDiv.innerHTML = '<div class="text-red-500">Please enter witness data</div>';
        return;
    }

    if (!isValidHex(witnessData)) {
        resultDiv.innerHTML = '<div class="text-red-500">Invalid hex format</div>';
        return;
    }

    const cleaned = witnessData.replace(/\s/g, '');
    let decoded = null;

    // Try each decoder
    for (const [name, decoder] of Object.entries(decoders)) {
        const result = decoder(cleaned);
        if (result) {
            decoded = result;
            break;
        }
    }

    if (!decoded) {
        resultDiv.innerHTML = '<div class="text-red-500">Unable to determine witness type</div>';
        return;
    }

    // Generate detailed HTML output
    let html = `
        <div class="bg-gray-100 p-4 rounded-lg">
            <h2 class="text-xl font-bold mb-2">Detected Type: ${decoded.type}</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                    <h3 class="font-bold text-lg">Details</h3>
    `;

    // Render details based on type
    if (decoded.details.stackItems) {
        html += `<div class="space-y-2">`;
        decoded.details.stackItems.forEach((item, index) => {
            html += `
                <div class="bg-white p-2 rounded">
                    <strong>Stack Item ${index + 1} (${item.type}):</strong>
                    <div class="break-all text-sm font-mono">${item.value}</div>
                    <div class="text-sm text-gray-600">Size: ${item.size}</div>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        for (const [key, value] of Object.entries(decoded.details)) {
            if (typeof value === 'object' && value !== null) {
                html += `
                    <div class="bg-white p-2 rounded">
                        <strong>${key}:</strong>
                        <div class="text-sm space-y-1">
                            ${Object.entries(value).map(([k, v]) => 
                                `<div><span class="text-gray-600">${k}:</span> ${v}</div>`
                            ).join('')}
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="bg-white p-2 rounded">
                        <strong>${key}:</strong>
                        <div class="break-all text-sm">${value}</div>
                    </div>
                `;
            }
        }
    }

    html += `
                </div>
                <div class="space-y-2">
                    <h3 class="font-bold text-lg">Metadata</h3>
    `;

    for (const [key, value] of Object.entries(decoded.metadata)) {
        html += `
            <div class="bg-white p-2 rounded">
                <strong class="text-gray-700">${key}:</strong>
                <div class="break-all text-sm">
                    ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                </div>
            </div>
        `;
    }

    html += `
                </div>
            </div>
        </div>
    `;

    resultDiv.innerHTML = html;
}

// Load example function
function loadExample(type) {
    const selected = examples[type];
    document.getElementById('witnessInput').value = selected.data;
    document.getElementById('exampleDescription').innerHTML = `
        <div class="space-y-2">
            <p>${selected.description}</p>
            <div class="bg-gray-50 p-3 rounded">
                <p class="font-semibold">${selected.txReference.note}</p>
                <ol class="list-decimal pl-5 mt-1">
                    ${selected.txReference.steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
                <a href="${selected.txReference.explorerUrl}" 
                   target="_blank" 
                   class="text-blue-500 hover:text-blue-700 mt-2 inline-block">
                    🔍 Explore Similar Transactions
                </a>
            </div>
        </div>
    `;
}

// Hex converter function
function convertHex() {
    const hex = document.getElementById('hexInput').value.trim();
    if (isValidHex(hex)) {
        document.getElementById('asciiOutput').value = hexToAscii(hex);
    } else {
        document.getElementById('asciiOutput').value = 'Invalid hex input';
    }
}
