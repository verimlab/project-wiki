const fs = require('fs');
const path = 'src/components/HomePage.tsx';
let text = fs.readFileSync(path, 'utf8');
const replacement = "setError('Добавьте хотя бы один куб, чтобы сделать бросок.');";
text = text.replace(/setError\('.*?'\);/s, replacement);
fs.writeFileSync(path, text, 'utf8');
