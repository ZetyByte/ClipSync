import pako from 'pako';

self.onmessage = async (event) => {
    let receivedChunks = event.data as Map<number, ArrayBuffer>;
    let totalSize = 0;

    for (let i = 1; i <= receivedChunks.size; i++) {
        totalSize += receivedChunks.get(i)!.byteLength;
    }
    let receivedChunksArray = new Uint8Array(totalSize);
    for (let i = 1, offset = 0; i <= receivedChunks.size; i++) {
        receivedChunksArray.set(new Uint8Array(receivedChunks.get(i)!), offset);
        offset += receivedChunks.get(i)!.byteLength;
    }
    let start = new Date().getTime();
    const decompressedChunk = pako.inflate(receivedChunksArray, { to: 'string' });
    let end = new Date().getTime();
    console.log("Decompression time: " + (end - start)/1000);
    self.postMessage({data: decompressedChunk});
}
