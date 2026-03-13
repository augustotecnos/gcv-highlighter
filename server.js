const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (_req, res) => res.send('GCV Highlighter OK ✅'));

app.post('/highlight', upload.single('image'), async (req, res) => {
  try {
    const visionJson = req.body.visionJson;
    const imgBuffer = req.file.buffer;

    const wordsToHighlight = ['BANESE', 'Depósito', 'Data', '337', 'Controle', 'Valor'];

    const data = JSON.parse(visionJson);
    const annotations = data.responses[0].textAnnotations.slice(1);

    // Metadata ANTES de qualquer resize
    const metadata = await sharp(imgBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    let foundWords = 0;

    // Criar SVG com dimensões EXATAS
    let svgOverlay = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">`;

    annotations.forEach(word => {
      const text = word.description.toUpperCase();
      if (wordsToHighlight.some(target => text.includes(target.toUpperCase()))) {
        const box = word.boundingPoly.vertices;
        const x1 = Math.min(...box.map(v => v.x));
        const y1 = Math.min(...box.map(v => v.y));
        const x2 = Math.max(...box.map(v => v.x));
        const y2 = Math.max(...box.map(v => v.y));

        const stroke = foundWords % 5 === 0 ? '#00FF00' : '#FF0000';
        svgOverlay += `<rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" stroke="${stroke}" stroke-width="6" fill="none" opacity="0.8"/><text x="${x1}" y="${Math.max(0,y1-25)}" font-size="28" fill="${stroke}" font-weight="bold">${word.description}</text>`;
        foundWords++;
      }
    });

    svgOverlay += '</svg>';
    const svgBuffer = Buffer.from(svgOverlay);

    // SEM RESIZE antes do composite!
    const result = await sharp(imgBuffer)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .resize(1200, null, { fit: 'inside' })  // DEPOIS do composite
      .jpeg({ quality: 85 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(result);

  } catch (error) {
    console.error('Erro completo:', error);
    res.status(500).json({ error: error.message, foundWords: foundWords || 0 });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server na porta ${port}`));
