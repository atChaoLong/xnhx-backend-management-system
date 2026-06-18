/**
 * API v2 实现
 * 用于：LMS 功能（单元、课堂活动等）
 */

const { calculateV2Signature } = require('./signature');
const { sendRequest } = require('../utils/request');

const SENSITIVE_PARAM_PATTERN = /(key|secret|token|password|phone|mobile|email|name|uid|id|wechat|card|account|url|link)/i;

function summarizeRequestParams(params) {
    if (!params || typeof params !== 'object') {
        return {
            param_count: 0,
            keys: [],
            sensitive_key_count: 0
        };
    }

    const keys = Object.keys(params);

    return {
        param_count: keys.length,
        keys: keys.slice(0, 30),
        sensitive_key_count: keys.filter(key => SENSITIVE_PARAM_PATTERN.test(key)).length
    };
}

class APIV2 {
    constructor(config) {
        this.SID = config.SID;
        this.SECRET = config.SECRET;
        this.BASE_URL = config.BASE_URL || 'api.eeo.cn';
        this.debug = config.debug || false;
    }

    /**
     * 发送 API v2 请求
     */
    async request(path, data) {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = calculateV2Signature(this.SECRET, this.SID, data, timestamp);

        const postData = JSON.stringify(data);

        const options = {
            hostname: this.BASE_URL,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-EEO-UID': this.SID,
                'X-EEO-TS': String(timestamp),
                'X-EEO-SIGN': signature
            },
            body: postData
        };

        if (this.debug) {
            console.log('[API v2] request summary:', {
                path,
                params: summarizeRequestParams(data)
            });
        }

        const result = await sendRequest(options);

        // API v2 返回格式：{ code, msg, data }
        if (result.code === 1) {
            return result;
        } else {
            throw result;
        }
    }

    /**
     * 创建单元
     */
    async createUnit(params) {
        const result = await this.request('/lms/unit/create', params);
        return result.data;
    }

    /**
     * 创建课堂活动
     */
    async createClassroom(params) {
        const result = await this.request('/lms/activity/createClass', params);
        return result.data;
    }

    /**
     * 更新课堂活动
     */
    async updateClassroom(params) {
        const result = await this.request('/lms/activity/updateClass', params);
        return result.data;
    }

    /**
     * 删除课堂活动
     */
    async deleteClassroom(params) {
        const result = await this.request('/lms/activity/delete', params);
        return result.data;
    }
}

module.exports = APIV2;
