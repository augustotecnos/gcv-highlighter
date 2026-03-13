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

    // Palavras importantes
    const wordsToHighlight = ['BANESE', 'Depósito', 'Data', '337', 'Controle', 'Valor'];

    // Parse JSON Vision API
    const data = JSON.parse(visionJson);
    const annotations = data.responses[0].textAnnotations.slice(1);

    // Obter dimensões da imagem
    const metadata = await sharp(imgBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // Criar SVG com dimensões EXATAS da imagem
    let svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${imgHeight}" viewBox="0 0 ${imgWidth} ${imgHeight}">`;

    let foundWords = 0;
    annotations.forEach((word, index) => {
      const text = word.description.toUpperCase();
      if (wordsToHighlight.some(target => text.includes(target.toUpperCase()))) {
        const box = word.boundingPoly.vertices;
        const x1 = Math.min(...box.map(v => v.x));
        const y1 = Math.min(...box.map(v => v.y));
        const x2 = Math.max(...box.map(v => v.x));
        const y2 = Math.max(...box.map(v => v.y));
        
        const stroke = ['#00FF00', '#FF0000', '#0000FF', '#FFA500', '#FF00FF'][index % 5];
        
        svgOverlay += `
          <rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" 
                stroke="${stroke}" stroke-width="5" fill="none" stroke-opacity="0.8"/>
          <text x="${x1}" y="${y1-10}" font-size="24" fill="${stroke}" font-weight="bold" 
                font-family="Arial">${word.description}</text>`;
        
        foundWords++;
      }
    });

    svgOverlay += '</svg>';
    const svgBuffer = Buffer.from(svgOverlay);

    // Processar: resize + overlay + compress
    const result = await sharp(imgBuffer)
      .resize(1200, null, { fit: 'inside' })
      .composite([{ input: svgBuffer, gravity: 'northwest' }])
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': result.length
    });
    res.send(result);

  } catch (error) {
    console.error('Erro:', error.message);
    res.status(500).json({ error: error.message, foundWords });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server na porta ${port}`));
