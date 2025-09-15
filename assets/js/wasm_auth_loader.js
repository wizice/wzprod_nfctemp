/**
 * WASM 인증 모듈 로더
 */

// 전역 변수 중복 선언 방지
if (typeof wasmModule === 'undefined') {
    window.wasmModule = null;
}
if (typeof authenticator === 'undefined') {
    window.authenticator = null;
}

// Firebase Functions 엔드포인트
// 프로덕션: 'https://us-central1-nfctemperatureapp.cloudfunctions.net/verifyTagAuthenticity'
// 로컬 테스트: 'http://10.0.2.2:5001/nfctemperatureapp/us-central1/verifyTagAuthenticity'
const FIREBASE_FUNCTIONS_URL = 'https://us-central1-nfctemperatureapp.cloudfunctions.net/verifyTagAuthenticity';

// 암호화 키 (실제 배포 시 안전하게 관리)
const ENCRYPTION_KEY = 'ATBVo4sIj_ZAZpo2aHUFJLYeoCQVUshCGVvrhVS9MQ4=';

/**
 * WASM 모듈 초기화
 */
async function initializeWasmAuth() {
    // 이미 초기화되었는지 확인
    if (window.wasmModule) {
        console.log('WASM module already initialized');
        return true;
    }
    
    try {
        console.log('Initializing WASM authentication module...');
        
        // WASM 모듈을 동적으로 로드 - GitHub에서 직접 로드하여 file:// 프로토콜 문제 해결
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            import init, { NfcAuthenticator } from './wasm/nfc_auth_wasm.js';
            
            window.initWasmModule = async function() {
                try {
                    // GitHub에서 WASM 파일 직접 로드 (file:// 프로토콜 우회)
                    const wasmUrl = 'https://raw.githubusercontent.com/wizice/wzprod_nfctemp/develop/assets/wasm/nfc_auth_wasm_bg.wasm';
                    await init(wasmUrl);
                    
                    // NfcAuthenticator 인스턴스 생성
                    const encryptionKey = '${ENCRYPTION_KEY}';
                    const apiEndpoint = '${FIREBASE_FUNCTIONS_URL}';
                    return new NfcAuthenticator(encryptionKey, apiEndpoint);
                } catch (error) {
                    console.error('WASM init error:', error);
                    // WASM 로드 실패 시 null 반환 (fallback 처리)
                    return null;
                }
            };
        `;
        document.head.appendChild(script);
        
        // 스크립트 로드 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (window.initWasmModule) {
            try {
                window.authenticator = await window.initWasmModule();
                if (window.authenticator) {
                    window.wasmModule = window.authenticator;
                    console.log('WASM module loaded successfully');
                } else {
                    console.log('WASM module not available, using fallback mode');
                    return false;
                }
            } catch (error) {
                console.error('WASM initialization failed:', error);
                return false;
            }
        } else {
            console.error('WASM module script not loaded');
            return false;
        }
        
        console.log('WASM authentication module initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize WASM:', error);
        return false;
    }
}

// wasm-bindgen이 자동으로 메모리 관리를 처리하므로 
// 수동 메모리 관리 함수들은 더 이상 필요하지 않음

/**
 * NFC 태그 인증 (WASM 사용)
 */
async function authenticateTagWithWasm(uid) {
    try {
        if (!window.authenticator) {
            console.log('WASM not initialized, initializing now...');
            const initialized = await initializeWasmAuth();
            if (!initialized) {
                throw new Error('WASM initialization failed');
            }
        }
        
        console.log('Authenticating tag with WASM:', uid);
        
        // WasmAuth의 encrypt_uid 메서드 직접 호출
        const encryptedUuid = window.authenticator.encrypt_uid(uid);
        
        console.log('Encrypted UUID:', encryptedUuid);
        
        // 앱 버전 정보
        const appVersion = '1.0.0';
        
        // Firebase Functions 호출
        const response = await fetch(FIREBASE_FUNCTIONS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                encrypted_uuid: encryptedUuid,
                timestamp: Date.now(),
                nonce: generateNonce(),
                app_version: appVersion
            })
        });
        
        const result = await response.json();
        
        console.log('Authentication result:', result);
        
        return result.authenticated;
        
    } catch (error) {
        console.error('WASM authentication error:', error);
        
        // 폴백: 기존 방식으로 인증
        console.log('Falling back to traditional authentication...');
        return await fallbackAuthentication(uid);
    }
}

/**
 * Nonce 생성
 */
function generateNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * 폴백 인증 (WASM 실패 시)
 */
async function fallbackAuthentication(uid) {
    try {
        // Android 네이티브 코드 호출
        if (window.AndroidNfc && window.AndroidNfc.checkTagAuthentication) {
            return await new Promise((resolve) => {
                window.AndroidNfc.checkTagAuthentication(uid, (result) => {
                    resolve(result === 'true');
                });
            });
        }
        return false;
    } catch (error) {
        console.error('Fallback authentication error:', error);
        return false;
    }
}

/**
 * 전역 함수로 노출 (Android WebView에서 호출)
 */
window.authenticateNfcTag = authenticateTagWithWasm;
window.initializeWasmAuth = initializeWasmAuth;

// 페이지 로드 시 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing WASM...');
    initializeWasmAuth();
});