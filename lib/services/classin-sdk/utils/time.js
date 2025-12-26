/**
 * 时间工具
 */

/**
 * 将各种时间格式转换为 Unix 时间戳（秒）
 * 支持：
 * 1. ISO 8601 字符串：'2025-12-27T14:00:00'
 * 2. Unix 时间戳（秒或毫秒）：1735280400 或 1735280400000
 * 3. Date 对象
 */
function normalizeTime(time) {
    if (typeof time === 'string') {
        // ISO 8601 字符串
        return Math.floor(new Date(time).getTime() / 1000);
    } else if (typeof time === 'number') {
        // Unix 时间戳
        // 如果大于 10000000000，认为是毫秒时间戳
        if (time > 10000000000) {
            return Math.floor(time / 1000);
        }
        return time;
    } else if (time instanceof Date) {
        // Date 对象
        return Math.floor(time.getTime() / 1000);
    } else {
        throw new Error(`不支持的时间格式: ${typeof time}`);
    }
}

module.exports = {
    normalizeTime
};
