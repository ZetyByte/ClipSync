import pako from 'pako';

self.onmessage = async (event) => {
    let receivedChunks = event.data.receivedChunks as { [key: number]: ArrayBuffer };
    let totalSize = 0;

    for (let i = 1; i <= Object.keys(receivedChunks).length; i++) {
        totalSize += receivedChunks[i].byteLength;
    }
    let receivedChunksArray = new Uint8Array(totalSize);
    for (let i = 1, offset = 0; i <= Object.keys(receivedChunks).length; i++) {
        receivedChunksArray.set(new Uint8Array(receivedChunks[i]), offset);
        offset += receivedChunks[i].byteLength;
    }
    let start = new Date().getTime();
    const decompressedChunk = pako.inflate(receivedChunksArray);
    let end = new Date().getTime();
    console.log("Decompression time: " + (end - start)/1000);
    let blob = new Blob([decompressedChunk], {type: event.data.type});
    self.postMessage({data: blob});
}
