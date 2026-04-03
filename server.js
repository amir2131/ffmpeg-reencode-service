const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: 'uploads/' });
const API_TOKEN = process.env.API_TOKEN || 'default-token-change-me';

// Middleware ???? ????? ????
app.use((req, res, next) => {
  const token = req.headers['authorization'] || req.query.token;
  if (token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.post('/reencode', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = `uploads/output-${Date.now()}.mp4`;
  const targetCodec = req.body.codec || 'libx264';

  ffmpeg(inputPath)
    .videoCodec(targetCodec)
    .audioCodec('aac')
    .outputOptions(['-preset fast', '-crf 23'])
    .on('end', () => {
      res.download(outputPath, (err) => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        if (err) console.error(err);
      });
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
      fs.unlinkSync(inputPath);
    })
    .save(outputPath);
});

app.get('/health', (req, res) => {
  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
