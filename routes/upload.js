if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

const {
    BlobServiceClient,
    StorageSharedKeyCredential,
    newPipeline
} = require('@azure/storage-blob');

const express = require('express');
const router = express.Router();
const multer = require('multer');
const inMemoryStorage = multer.memoryStorage();
const uploadStrategy = multer({ storage: inMemoryStorage }).single('image');
const getStream = require('into-stream');
const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20};
const ONE_MINUTE = 60 * 1000;
const containerName = 'uploads';
const azureStorageBlobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

const sharedKeyCredential = new StorageSharedKeyCredential(
    process.env.AZURE_STORAGE_ACCOUNT_NAME,
    process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY
);


const pipeline = newPipeline(sharedKeyCredential);

const blobServiceClient = new BlobServiceClient(`https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`, pipeline);

const handleError = (err, res) => {
    res.status(500);
    res.render('error', { error: err });
};

const getBlobName = originalName => {
    const identifier = Math.random().toString().replace(/0\./, ''); // remove "0." from start of string
    return `${identifier}-${originalName}`;
};


router.post('/', uploadStrategy, async (req, res) => {
   
    //const blobServiceClient = new BlobServiceClient(azureStorageBlobConnectionString);
    const blobName = getBlobName(req.file.originalname);
    const stream = getStream(req.file.buffer);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    try {
        await blockBlobClient.uploadStream(stream,
        uploadOptions.bufferSize, uploadOptions.maxBuffers,{
        blobHTTPHeaders: {blobContentType: "text/plain"},
        onProgress: 
            ev => { console.log(`${Math.round((ev.loadedBytes / req.file.size) * 100 )}`) }
    });
        res.render('success', { message: 'File uploaded to Azure Blob storage.' });
    } catch (err) {
        res.render('error', { message: err.message });
    }

});

module.exports = router;