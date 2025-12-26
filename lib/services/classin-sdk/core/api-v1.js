/**
 * API v1 实现
 * 用于：用户注册、课程创建等基础功能
 */

const { calculateV1Signature } = require('./signature');
const { sendRequest } = require('../utils/request');
const URLSearchParams = require('url').URLSearchParams;

class APIV1 {
    constructor(config) {
        this.SID = config.SID;
        this.SECRET = config.SECRET;
        this.BASE_URL = config.BASE_URL || 'api.eeo.cn';
        this.debug = config.debug || false;
    }

    /**
     * 发送 API v1 请求
     */
    async request(action, params) {
        const timeStamp = Math.floor(Date.now() / 1000);
        const safeKey = calculateV1Signature(this.SECRET, timeStamp);

        const formData = new URLSearchParams();
        formData.append('SID', this.SID);
        formData.append('safeKey', safeKey);
        formData.append('timeStamp', timeStamp);

        // 添加参数
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                formData.append(key, params[key]);
            }
        });

        const options = {
            hostname: this.BASE_URL,
            path: `/partner/api/course.api.php?action=${action}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(formData.toString())
            },
            body: formData.toString()
        };

        if (this.debug) {
            console.log(`[API v1] ${action}`);
            console.log('请求参数:', params);
        }

        const result = await sendRequest(options);

        // API v1 返回格式：{ error_info: { errno, error }, data }
        if (result.error_info) {
            if (result.error_info.errno === 1 || result.error_info.errno === 135) {
                // 成功或用户已存在
                return result;
            } else {
                throw result.error_info;
            }
        } else {
            return result;
        }
    }

    /**
     * 注册用户
     */
    async register(params) {
        const result = await this.request('register', params);
        return result.data;
    }

    /**
     * 添加学生到机构
     */
    async addSchoolStudent(params) {
        const result = await this.request('addSchoolStudent', params);
        return result;
    }

    /**
     * 创建课程
     */
    async createCourse(params) {
        const result = await this.request('addCourse', params);
        return result.data;
    }
}

module.exports = APIV1;
