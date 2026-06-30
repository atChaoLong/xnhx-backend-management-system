/**
 * ClassIn API SDK - 主入口
 * 完整的 ClassIn API 集成，支持 API v1 和 API v2
 */

const APIV1 = require('./core/api-v1');
const APIV2 = require('./core/api-v2');
const { normalizeTime } = require('./utils/time');

class ClassInSDK {
    /**
     * 初始化 SDK
     * @param {Object} config
     * @param {string} config.SID - 机构ID（必填）
     * @param {string} config.SECRET - API密钥（必填）
     * @param {string} config.BASE_URL - API地址（可选）
     * @param {boolean} config.debug - 是否开启调试（可选）
     */
    constructor(config) {
        if (!config.SID || !config.SECRET) {
            throw new Error('SID 和 SECRET 是必填参数');
        }

        this.config = config;
        this.apiv1 = new APIV1(config);
        this.apiv2 = new APIV2(config);
    }

    // ==================== 用户管理 ====================

    /**
     * 注册老师
     * @param {Object} params
     * @param {string} params.telephone - 手机号
     * @param {string} params.nickname - 昵称
     * @param {string} params.password - 密码
     * @returns {Promise<number>} 老师UID
     */
    async registerTeacher(params) {
        return await this.apiv1.register({
            telephone: params.telephone,
            nickname: params.nickname,
            password: params.password,
            addToSchoolMember: 2  // 2=添加为老师
        });
    }

    /**
     * 注册学生
     * @param {Object} params
     * @param {string} params.telephone - 手机号
     * @param {string} params.nickname - 昵称
     * @param {string} params.password - 密码
     * @returns {Promise<number>} 学生UID
     */
    async registerStudent(params) {
        return await this.apiv1.register({
            telephone: params.telephone,
            nickname: params.nickname,
            password: params.password,
            addToSchoolMember: 3  // 3=添加为学生
        });
    }

    /**
     * 添加学生到机构
     * @param {Object} params
     * @param {string} params.studentAccount - 学生账号
     * @param {string} params.studentName - 学生姓名
     */
    async addSchoolStudent(params) {
        return await this.apiv1.addSchoolStudent(params);
    }

    // ==================== 课程管理 ====================

    /**
     * 创建课程
     * @param {Object} params
     * @param {string} params.courseName - 课程名称
     * @returns {Promise<number>} 课程ID
     */
    async createCourse(params) {
        return await this.apiv1.createCourse(params);
    }

    // ==================== 单元管理 ====================

    /**
     * 创建单元
     * @param {Object} params
     * @param {number} params.courseId - 课程ID
     * @param {string} params.name - 单元名称
     * @param {number} params.publishFlag - 发布状态（可选）
     * @returns {Promise<number>} 单元ID
     */
    async createUnit(params) {
        return await this.apiv2.createUnit({
            courseId: params.courseId,
            name: params.name,
            publishFlag: params.publishFlag || 0
        });
    }

    // ==================== 课堂管理 ====================

    /**
     * 创建课堂活动
     * @param {Object} params
     * @param {number} params.courseId - 课程ID
     * @param {number} params.unitId - 单元ID
     * @param {string} params.name - 课堂名称
     * @param {number} params.teacherUid - 老师UID
     * @param {string|number|Date} params.startTime - 开始时间
     * @param {string|number|Date} params.endTime - 结束时间
     * @param {number} params.liveState - 是否直播（可选）
     * @param {number} params.openState - 是否公开回放（可选）
     * @param {number} params.recordState - 是否录课（可选）
     * @param {number} params.recordType - 录课类型（可选）
     * @returns {Promise<Object>} 课堂信息
     */
    async createClassroom(params) {
        // 标准化时间
        const startTime = normalizeTime(params.startTime);
        const endTime = normalizeTime(params.endTime);

        return await this.apiv2.createClassroom({
            courseId: params.courseId,
            unitId: params.unitId,
            name: params.name,
            teacherUid: params.teacherUid,
            startTime: startTime,
            endTime: endTime,
            liveState: params.liveState || 0,
            openState: params.openState || 0,
            recordState: params.recordState || 0,
            recordType: params.recordType || 0,
            seatNum: params.seatNum || 2  // 默认一对一（1v1）
        });
    }

    /**
     * 更新课堂活动
     * @param {Object} params
     * @param {number} params.courseId - 课程ID
     * @param {number} params.classId - 课节ID
     * @param {number} params.activityId - 活动ID（必需）
     * @param {string} params.name - 课堂名称（可选）
     * @param {string|number|Date} params.startTime - 开始时间（可选）
     * @param {string|number|Date} params.endTime - 结束时间（可选）
     * @param {number} params.teacherUid - 老师UID（可选）
     * @param {number} params.liveState - 是否直播（可选）
     * @param {number} params.openState - 是否公开回放（可选）
     * @param {number} params.recordState - 是否录课（可选）
     * @param {number} params.recordType - 录课类型（可选）
     * @param {number} params.seatNum - 台上人数（可选）
     * @returns {Promise<Object>} 更新结果
     */
    async updateClassroom(params) {
        const updateParams = { ...params };
        
        // 标准化时间（如果提供）
        if (updateParams.startTime) {
            updateParams.startTime = normalizeTime(updateParams.startTime);
        }
        if (updateParams.endTime) {
            updateParams.endTime = normalizeTime(updateParams.endTime);
        }

        return await this.apiv2.updateClassroom(updateParams);
    }

    /**
     * 删除课堂活动
     * @param {Object} params
     * @param {number} params.courseId - 课程ID
     * @param {number} params.classId - 课节ID
     * @param {number} params.activityId - 活动ID（必需）
     * @returns {Promise<Object>} 删除结果
     */
    async deleteClassroom(params) {
        return await this.apiv2.deleteClassroom(params);
    }

    /**
     * 课程下添加学生/旁听（单个）
     */
    async addCourseStudent(params) {
        return await this.apiv1.addCourseStudent(params);
    }

    // ==================== 完整流程（推荐）====================

    /**
     * 一键创建课程和课堂
     * @param {Object} options
     * @param {Object} options.teacher - 老师信息
     * @param {Object} options.course - 课程信息
     * @param {Object} options.unit - 单元信息（可选）
     * @param {Object} options.classroom - 课堂信息
     * @returns {Promise<Object>} 完整结果
     */
    async createCompleteClassroom(options) {
        // 1. 注册老师
        const teacherUid = await this.registerTeacher(options.teacher);

        // 2. 创建课程
        const courseId = await this.createCourse(options.course);

        // 3. 创建单元（可选）
        let unitId;
        if (options.unit) {
            unitId = await this.createUnit({
                courseId: courseId,
                name: options.unit.name
            });
        } else {
            // 如果没有单元，使用课程ID作为单元ID
            unitId = courseId;
        }

        // 4. 创建课堂
        const classroom = await this.createClassroom({
            courseId: courseId,
            unitId: unitId,
            name: options.classroom.name,
            teacherUid: teacherUid,
            startTime: options.classroom.startTime,
            endTime: options.classroom.endTime
        });

        return {
            teacherUid: teacherUid,
            courseId: courseId,
            unitId: unitId,
            classId: classroom.classId,
            activityId: classroom.activityId
        };
    }
}

module.exports = ClassInSDK;
