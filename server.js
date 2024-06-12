const express = require('express');
const path = require('path');
const potrace = require('potrace');
const Jimp = require('jimp');
const bodyParser = require('body-parser');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '50mb' }));

app.post('/convert-to-svg', async (req, res) => {
  try {
    const imageDataUrl = req.body.image;
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const image = await Jimp.read(buffer);

    image.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
      if (err) {
        return res.status(500).send({ error: 'Failed to process image' });
      }

      potrace.trace(buffer, (err, svg) => {
        if (err) {
          return res
            .status(500)
            .send({ error: 'Failed to convert image to SVG' });
        }
        res.send({ svg });
      });
    });
  } catch (err) {
    res.status(500).send({ error: 'Failed to process image' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
