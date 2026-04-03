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

function safeUnlink(filePath) {
  if (!filePath) return;
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/reencode', authMiddleware, upload.single('file'), async (req, res) => {
  const inputFile = req.file?.path;
  if (!inputFile) return res.status(400).json({ error: 'file is required' });

  const targetVideoBitrate = req.body.target_video_bitrate || '3500k';
  const targetAudioBitrate = req.body.target_audio_bitrate || '128k';
  const targetFps = parseInt(req.body.target_fps || '30', 10);
  const targetWidth = parseInt(req.body.target_width || '1080', 10);
  const targetHeight = parseInt(req.body.target_height || '1920', 10);

  const outputFile = path.join(os.tmpdir(), `output-${crypto.randomUUID()}.mp4`);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-profile:v high', '-level 4.1', '-pix_fmt yuv420p',
          `-r ${targetFps}`, `-b:v ${targetVideoBitrate}`,
          '-maxrate 4000k', '-bufsize 7000k',
          `-b:a ${targetAudioBitrate}`, '-ar 48000', '-movflags +faststart'
        ])
        .videoFilters([
          { filter: 'scale', options: { w: targetWidth, h: targetHeight, force_original_aspect_ratio: 'decrease' } },
          { filter: 'pad', options: { w: targetWidth, h: targetHeight, x: '(ow-iw)/2', y: '(oh-ih)/2' } }
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputFile);
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="output.mp4"');
    const stream = fs.createReadStream(outputFile);
    stream.on('close', () => { safeUnlink(inputFile); safeUnlink(outputFile); });
    stream.pipe(res);
  } catch (error) {
    safeUnlink(inputFile);
    safeUnlink(outputFile);
    res.status(500).json({ error: 'Re-encode failed', details: String(error?.message || error) });
  }
});

app.listen(PORT, () => {
  console.log(`FFmpeg service running on port ${PORT}`);
});
