/**
 * HTTP 请求工具
 */

const https = require('https');

/**
 * 发送 HTTP 请求
 */
function sendRequest(options) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (!data || data.trim() === '') {
                        const err = new Error(`API返回空响应 (HTTP ${res.statusCode})`);
                        err.statusCode = res.statusCode;
                        reject(err);
                        return;
                    }

                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    const err = new Error(`JSON解析失败 (HTTP ${res.statusCode}): ${data.substring(0, 200)}`);
                    err.raw = data;
                    err.statusCode = res.statusCode;
                    reject(err);
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

module.exports = {
    sendRequest
};
