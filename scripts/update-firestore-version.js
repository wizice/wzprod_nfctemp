const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ����� ���� �Ľ�
const args = process.argv.slice(2);
const argMap = {};
args.forEach((arg, index) => {
    if (arg.startsWith('--')) {
        argMap[arg.substring(2)] = args[index + 1];
    }
});

const ENV = argMap.env || 'dev';
const VERSION = argMap.version || new Date().toISOString();
const PUBLIC_REPO = argMap.repo || 'username/assets-repo';

// Firebase Admin �ʱ�ȭ (���� ���� Ű �ʿ�)
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateFirestore() {
    try {
        // üũ�� ���� �б�
        const checksumsPath = path.join(__dirname, '../checksums.json');
        const checksums = JSON.parse(fs.readFileSync(checksumsPath, 'utf8'));
        
        // ���� ���� ������Ʈ
        const versionDoc = ENV === 'prod' ? 'version_info_prod' : 'version_info_dev';
        await db.collection('app_config').doc(versionDoc).set({
            version: VERSION,
            git_repo: PUBLIC_REPO,
            git_branch: ENV === 'prod' ? 'main' : 'develop',
            update_url: `https://raw.githubusercontent.com/${PUBLIC_REPO}/${ENV === 'prod' ? 'main' : 'develop'}`,
            github_pages_url: `https://${PUBLIC_REPO.split('/')[0]}.github.io/${PUBLIC_REPO.split('/')[1]}`,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            force_update: false
        }, { merge: true });
        
        console.log(`Updated ${versionDoc} with version: ${VERSION}`);
        
        // üũ�� ���� ������Ʈ
        const checksumDoc = ENV === 'prod' ? 'file_checksums_prod' : 'file_checksums_dev';
        await db.collection('app_config').doc(checksumDoc).set({
            checksums: checksums,
            version: VERSION,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Updated ${checksumDoc} with ${Object.keys(checksums).length} file checksums`);
        
        // ���� �̷� ���� (���û���)
        await db.collection('update_history').add({
            environment: ENV,
            version: VERSION,
            files_count: Object.keys(checksums).length,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            commit: process.env.GITHUB_SHA || 'manual',
            triggered_by: process.env.GITHUB_ACTOR || 'system'
        });
        
        console.log('Firestore update completed successfully');
        process.exit(0);
        
    } catch (error) {
        console.error('Error updating Firestore:', error);
        process.exit(1);
    }
}