const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage() });

// endpoint simples pra teste
app.get('/', (_req, res) => {
  res.send('GCV Highlighter online');
});

app.post('/highlight', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.body.visionJson) {
      return res.status(400).json({ error: 'image e visionJson são obrigatórios' });
    }

    const imgBuffer = req.file.buffer;
    const visionJson = JSON.parse(req.body.visionJson);

    // palavras a destacar: se vier no body, usa; senão usa default
    const wordsParam = (req.body.words || '').trim();
    const wordsToHighlight = wordsParam
      ? wordsParam.split(',').map(w => w.trim()).filter(Boolean)
      : ['BANESE', 'Depósito', 'Data', 'Hora', '337,95', 'Controle'];

    const textAnnotations = visionJson.responses?.[0]?.textAnnotations || [];
    const words = textAnnotations.slice(1); // pula o primeiro (texto completo)

    const highlighted = words.filter(w =>
      wordsToHighlight.some(target =>
        w.description.toUpperCase().includes(target.toUpperCase())
      )
    );

    if (!highlighted.length) {
      console.log('Nenhuma palavra encontrada para destacar');
    }

    // tenta pegar bounding box geral (primeiro annotation) pra dimensionar SVG
    const baseBox = textAnnotations[0]?.boundingPoly?.vertices || [];
    const width =
      baseBox.length
        ? Math.max(...baseBox.map(v => v.x)) - Math.min(...baseBox.map(v => v.x))
        : 2132;
    const height =
      baseBox.length
        ? Math.max(...baseBox.map(v => v.y)) - Math.min(...baseBox.map(v => v.y))
        : 1815;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;

    highlighted.forEach((w, idx) => {
      const v = w.boundingPoly.vertices;
      const x1 = Math.min(...v.map(p => p.x || 0));
      const y1 = Math.min(...v.map(p => p.y || 0));
      const x2 = Math.max(...v.map(p => p.x || 0));
      const y2 = Math.max(...v.map(p => p.y || 0));
      const rectW = x2 - x1;
      const rectH = y2 - y1;

      const colors = ['#00FF00', '#FF0000', '#0000FF', '#FFA500', '#00FFFF', '#FF00FF'];
      const color = colors[idx % colors.length];

      svg += `
        <rect x="${x1}" y="${y1}" width="${rectW}" height="${rectH}"
              stroke="${color}" stroke-width="5" fill="none" stroke-dasharray="8,4" />
        <text x="${x1}" y="${Math.max(y1 - 10, 20)}"
              font-size="26" font-family="Arial" font-weight="bold"
              fill="${color}">
          ${w.description}
        </text>
      `;
    });

    svg += '</svg>';

    const svgBuffer = Buffer.from(svg);

    const result = await sharp(imgBuffer)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .resize({ width: 1200, withoutEnlargement: true }) // comprime
      .jpeg({ quality: 85 }) // compressão
      .toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
