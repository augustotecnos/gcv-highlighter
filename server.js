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
  let foundWords = 0;

  try {
    const visionJson = req.body.visionJson;
    const imgBuffer = req.file?.buffer;

    if (!visionJson || !imgBuffer) {
      throw new Error('Faltando visionJson ou image');
    }

    let wordsToHighlight = ['BANESE', 'Depósito', 'Data', '337', 'Controle', 'Valor'];
    if (req.body.words) {
      wordsToHighlight = req.body.words.split(',').map(w => w.trim().toUpperCase());
    }

    const data = JSON.parse(visionJson);
    const annotations = data.responses?.[0]?.textAnnotations?.slice(1) || [];

    console.log(`Procurando ${wordsToHighlight.length} palavras, encontrou ${annotations.length} anotações`);

    // Carregar imagem
    const img = await loadImage(imgBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // Desenhar imagem original (mantém orientação)
    ctx.drawImage(img, 0, 0);

    // Desenhar retângulos BRILHANTES e preenchidos
    annotations.forEach((word, index) => {
      const text = word.description?.toUpperCase() || '';
      if (wordsToHighlight.some(target => text.includes(target))) {
        const box = word.boundingPoly?.vertices || [];
        if (box.length === 4) {
          const x1 = Math.min(...box.map(v => v.x));
          const y1 = Math.min(...box.map(v => v.y));
          const x2 = Math.max(...box.map(v => v.x));
          const y2 = Math.max(...box.map(v => v.y));

          // Cores OPACAS e preenchidas para visibilidade máxima
          const colors = [
            { stroke: '#00FF00', fill: 'rgba(0,255,0,0.3)' },    // Verde
            { stroke: '#FF0000', fill: 'rgba(255,0,0,0.3)' },     // Vermelho
            { stroke: '#0000FF', fill: 'rgba(0,0,255,0.3)' },     // Azul
            { stroke: '#FFA500', fill: 'rgba(255,165,0,0.3)' },   // Laranja
            { stroke: '#FF00FF', fill: 'rgba(255,0,255,0.3)' }    // Magenta
          ];
          const color = colors[foundWords % colors.length];

          // Fundo semi-transparente
          ctx.fillStyle = color.fill;
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

          // Borda grossa
          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.setLineDash([]);
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          // Texto GRANDE e branco com sombra
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 4;
          ctx.fillStyle = 'white';
          ctx.font = 'bold 32px Arial';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`${word.description} (${foundWords + 1})`, x1 + 5, y1 - 5);
          ctx.shadowBlur = 0;  // Reset sombra

          console.log(`Destacou: "${word.description}" em [${x1},${y1},${x2},${y2}]`);
          foundWords++;
        }
      }
    });

    console.log(`Total destacadas: ${foundWords}`);

    // **NÃO REDIMENSIONAR** - mantém proporção e orientação original
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'attachment; filename="highlighted.jpg"'
    });
    res.send(buffer);

  } catch (error) {
    console.error('Erro:', error.message);
    res.status(500).json({ 
      error: error.message, 
      foundWords: foundWords || 0,
      wordsToHighlight: req.body.words ? req.body.words.split(',') : 'default'
    });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server na porta ${port}`));
