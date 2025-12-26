/**
 * 签名工具模块
 * 支持 API v1 和 API v2 签名方式
 */

const crypto = require('crypto');

/**
 * API v1 签名
 * 规则：MD5(SECRET + timeStamp)
 */
function calculateV1Signature(SECRET, timeStamp) {
    return crypto.createHash('md5')
        .update(SECRET + timeStamp)
        .digest('hex');
}

/**
 * API v2 签名
 * 规则：MD5('排序后的参数&key=密钥')
 */
function calculateV2Signature(SECRET, SID, params, timestamp) {
    const signedParams = {};

    // 添加 sid 和 timeStamp
    signedParams['sid'] = SID;
    signedParams['timeStamp'] = String(timestamp);

    // 添加其他参数（排除数组和对象，以及长度>1024的值）
    for (const key in params) {
        const value = params[key];
        if (Array.isArray(value) || typeof value === 'object') {
            continue;
        }
        if (typeof value === 'string' && value.length > 1024) {
            continue;
        }
        signedParams[key] = value;
    }

    // 按参数名ASCII码排序
    const sortedKeys = Object.keys(signedParams).sort();

    // 拼接成 key1=value1&key2=value2
    const stringA = sortedKeys.map(key => `${key}=${signedParams[key]}`).join('&');

    // 拼接密钥
    const stringToSign = stringA + `&key=${SECRET}`;

    // 计算 MD5
    return crypto.createHash('md5')
        .update(stringToSign)
        .digest('hex');
}

module.exports = {
    calculateV1Signature,
    calculateV2Signature
};
