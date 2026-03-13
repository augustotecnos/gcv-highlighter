const express = require('express');
const multer = require('multer');
const { createCanvas, loadImage } = require('canvas');
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

    // Carregar imagem
    const img = await loadImage(imgBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // Desenhar imagem original
    ctx.drawImage(img, 0, 0);

    let foundWords = 0;

    // Desenhar retângulos
    annotations.forEach(word => {
      const text = word.description.toUpperCase();
      if (wordsToHighlight.some(target => text.includes(target.toUpperCase()))) {
        const box = word.boundingPoly.vertices;
        const x1 = Math.min(...box.map(v => v.x));
        const y1 = Math.min(...box.map(v => v.y));
        const x2 = Math.max(...box.map(v => v.x));
        const y2 = Math.max(...box.map(v => v.y));

        // Cores diferentes
        const colors = ['lime', 'red', 'blue', 'orange', 'magenta'];
        ctx.strokeStyle = colors[foundWords % colors.length];
        ctx.lineWidth = 6;
        ctx.setLineDash([]);
        ctx.strokeRect(x1, y1, x2-x1, y2-y1);

        // Texto
        ctx.fillStyle = colors[foundWords % colors.length];
        ctx.font = 'bold 28px Arial';
        ctx.fillText(word.description, x1, Math.max(0, y1-10));

        foundWords++;
      }
    });

    // Redimensionar e JPG
    const resized = createCanvas(1200, 1200 * (img.height / img.width));
    const resizedCtx = resized.getContext('2d');
    resizedCtx.drawImage(canvas, 0, 0, 1200, 1200 * (img.height / img.width));

    const buffer = resized.toBuffer('image/jpeg', { quality: 0.85 });

    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);

  } catch (error) {
    console.error('Erro:', error.message);
    res.status(500).json({ error: error.message, foundWords: foundWords || 0 });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server na porta ${port}`));
