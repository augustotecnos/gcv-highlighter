const express = require('express');
const multer = require('multer');
const { createCanvas, loadImage } = require('canvas');
const cors = require('cors');
const sharp = require('sharp');  // Para orientação EXIF

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (_req, res) => res.send('GCV Highlighter OK ✅'));

app.post('/highlight', upload.single('image'), async (req, res) => {
  let foundWords = 0;

  try {
    const visionJsonStr = req.body.visionJson;
    const imgBuffer = req.file?.buffer;

    if (!visionJsonStr || !imgBuffer) {
      throw new Error('Faltando visionJson ou image');
    }

    let wordsToHighlight = ['BANESE', 'Depósito', 'Data', '337', 'Controle', 'Valor'];
    if (req.body.words) {
      wordsToHighlight = req.body.words.split(',').map(w => w.trim().toUpperCase());
    }

    // **CORREÇÃO 1: n8n envia só "responses" array**
    const visionData = JSON.parse(visionJsonStr);
    console.log('visionData estrutura:', Object.keys(visionData));
    
    let annotations = [];
    if (Array.isArray(visionData) && visionData.length > 0) {
      // n8n: [{"textAnnotations": [...]}]
      annotations = visionData[0]?.textAnnotations?.slice(1) || [];
    } else if (visionData.responses?.[0]?.textAnnotations) {
      // Full GCV response
      annotations = visionData.responses[0].textAnnotations.slice(1);
    }

    console.log(`Procurando ${wordsToHighlight.join(',')}, encontrou ${annotations.length} anotações`);

    // **CORREÇÃO 2: Sharp corrige orientação EXIF**
    const imgSharp = sharp(imgBuffer);
    const metadata = await imgSharp.metadata();
    const img = await loadImage(await imgSharp.toBuffer());

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // Desenhar imagem corrigida
    ctx.drawImage(img, 0, 0);

    // **CORREÇÃO 3: Match case-insensitive + log detalhado**
    annotations.forEach((word, index) => {
      const text = word.description.toUpperCase();
      const match = wordsToHighlight.find(target => text.includes(target));
      
      console.log(`Word ${index}: "${word.description}" | Match: ${match || 'NOPE'}`);
      
      if (match) {
        const box = word.boundingPoly.vertices;
        const x1 = Math.min(...box.map(v => v.x));
        const y1 = Math.min(...box.map(v => v.y));
        const x2 = Math.max(...box.map(v => v.x));
        const y2 = Math.max(...box.map(v => v.y));

        // Retângulo ULTRA VISÍVEL
        const colors = [
          { stroke: '#00FF00', fill: 'rgba(0,255,0,0.4)' },
          { stroke: '#FF0000', fill: 'rgba(255,0,0,0.4)' },
          { stroke: '#0000FF', fill: 'rgba(0,0,255,0.4)' },
          { stroke: '#FFA500', fill: 'rgba(255,165,0,0.4)' },
          { stroke: '#FF00FF', fill: 'rgba(255,0,255,0.4)' }
        ];
        const color = colors[foundWords % colors.length];

        ctx.fillStyle = color.fill;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Texto com sombra
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 5;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${word.description} [${match}]`, x1 + 8, y1 - 8);
        ctx.shadowBlur = 0;

        foundWords++;
      }
    });

    console.log(`✅ Total destacadas: ${foundWords}`);

    // **CORREÇÃO 4: Sharp final com orientação**
    const highlightedBuffer = canvas.toBuffer('image/png');  // PNG preserva melhor
    const finalBuffer = await sharp(highlightedBuffer)
      .jpeg({ quality: 95 })
      .toBuffer();

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'attachment; filename="highlighted.jpg"',
      'Access-Control-Expose-Headers': 'Content-Disposition'
    });
    res.send(finalBuffer);

  } catch (error) {
    console.error('❌ Erro completo:', error);
    res.status(500).json({ 
      error: error.message, 
      foundWords,
      wordsToHighlight: req.body.words?.split(',') || 'default',
      visionKeys: visionJsonStr ? Object.keys(JSON.parse(visionJsonStr)) : 'null'
    });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server na porta ${port}`));
