const fs = require('fs');
let content = fs.readFileSync('f:/Knexa/js/discover.js', 'utf8');
let newContent = content.replace(/\\`/g, '`').replace(/\\\${/g, '${');
fs.writeFileSync('f:/Knexa/js/discover.js', newContent);
console.log('Fixed discover.js');
