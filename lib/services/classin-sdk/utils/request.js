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
                        reject({
                            error: 'API返回空响应',
                            statusCode: res.statusCode
                        });
                        return;
                    }

                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    reject({
                        error: 'JSON解析失败',
                        raw: data,
                        statusCode: res.statusCode
                    });
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
