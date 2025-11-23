const originalFetch = window.fetch;

function mergeFiles(fileParts) {
    return new Promise((resolve, reject) => {
        let buffers = [];
        let totalSize = 0;

        function fetchOne(urls, iUrl = 0) {
            if (iUrl >= urls.length) return Promise.reject(new Error("Missing part: " + urls[0]));
            return originalFetch(urls[iUrl]).then((response) => {
                if (!response.ok) return fetchOne(urls, iUrl + 1);
                return response.arrayBuffer();
            });
        }

        function fetchPart(index) {
            if (index >= fileParts.length) {
                const mergedBuffer = new Uint8Array(totalSize);
                let offset = 0;
                for (const buffer of buffers) {
                    mergedBuffer.set(new Uint8Array(buffer), offset);
                    offset += buffer.byteLength;
                }
                console.log(`Merged file total size: ${totalSize} bytes`);
                resolve(mergedBuffer.buffer);
                return;
            }
            const part = fileParts[index];
            const urls = Array.isArray(part) ? part : [part];
            fetchOne(urls).then((data) => {
                console.log(`Loaded part ${index + 1}/${fileParts.length}: ${data.byteLength} bytes`);
                buffers.push(data);
                totalSize += data.byteLength;
                fetchPart(index + 1);
            }).catch(reject);
        }
        fetchPart(0);
    });
}

function getParts(file, start, end) {
    let parts = [];
    for (let i = start; i <= end; i++) {
        const plain = file + ".part" + i;
        const padded = file + ".part" + String(i).padStart(2, "0");
        parts.push(plain === padded ? plain : [plain, padded]);
    }
    return parts;
}

// Merge uncompressed files
window.unityMergeComplete = Promise.all([
    mergeFiles(getParts("Build/WebGL.data", 1, 3)),
    mergeFiles(getParts("Build/WebGL.wasm", 1, 2))
]).then(([dataBuffer, wasmBuffer]) => {
    const dataUrl = URL.createObjectURL(new Blob([dataBuffer]));
    const wasmUrl = URL.createObjectURL(new Blob([wasmBuffer]));
    
    window.fetch = async function (url, ...args) {
        if (url.endsWith("Build/WebGL.data")) {
            const response = await originalFetch(dataUrl, ...args);
            return response;
        } else if (url.endsWith("Build/WebGL.wasm")) {
            const response = await originalFetch(wasmUrl, ...args);
            return response;
        } else {
            return originalFetch(url, ...args);
        }
    };
    console.log("Unity files merged successfully");
}).catch((error) => {
    console.error("Failed to merge Unity files:", error);
    throw error;
});