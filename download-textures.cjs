const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(__dirname, 'public', 'assets', 'earth');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

const files = {
    'earth_atmos_2048.jpg': 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'earth_specular_2048.jpg': 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'earth_clouds_1024.png': 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
    'earth_normal_2048.jpg': 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg'
};

for (const [name, url] of Object.entries(files)) {
    const file = fs.createWriteStream(path.join(dir, name));
    https.get(url, function(response) {
        response.pipe(file);
        file.on('finish', () => file.close());
    });
}
console.log('Downloading textures...');
