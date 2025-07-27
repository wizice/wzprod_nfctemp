// scripts/calculate-checksums.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../app/src/main/assets');
const OUTPUT_FILE = path.join(__dirname, '../checksums.json');

function calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function scanDirectory(dir, baseDir = '') {
    const files = {};
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(baseDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            Object.assign(files, scanDirectory(fullPath, relativePath));
        } else if (stat.isFile()) {
            // 웹 assets 파일만 처리
            const ext = path.extname(item).toLowerCase();
            const webExts = ['.html', '.js', '.css', '.png', '.jpg', '.jpeg', 
                           '.gif', '.svg', '.ttf', '.otf', '.woff', '.woff2', 
                           '.json', '.xml'];
            
            if (webExts.includes(ext)) {
                const checksum = calculateChecksum(fullPath);
                files[relativePath.replace(/\\/g, '/')] = checksum;
                console.log(`Calculated checksum for: ${relativePath}`);
            }
        }
    });
    
    return files;
}

// 메인 실행
console.log('Calculating checksums for assets...');
const checksums = scanDirectory(ASSETS_DIR);

// 결과 저장
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(checksums, null, 2));
console.log(`Checksums saved to: ${OUTPUT_FILE}`);
console.log(`Total files processed: ${Object.keys(checksums).length}`);
