const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = require('express')();
const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || 'change-this-secret';

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } });

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/reencode', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const outputFilename = `reencoded_${crypto.randomBytes(8).toString('hex')}.mp4`;
  const outputPath = path.join(os.tmpdir(), outputFilename);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-threads 1',
          '-bufsize 4000k',
          '-maxrate 2500k',
          '-movflags +faststart',
          '-y'
        ])
        .on('start', (cmd) => console.log('FFmpeg started:', cmd))
        .on('progress', (progress) => console.log('Progress:', progress.percent, '%'))
        .on('end', () => {
          console.log('FFmpeg finished successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err.message);
          reject(err);
        })
        .save(outputPath);
    });

    res.download(outputPath, outputFilename, (err) => {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  } catch (err) {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
    res.status(500).json({ error: 'Re-encoding failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FFmpeg re-encode service running on port ${PORT}`);
});
