/**
 * ClassIn 回调消息处理器
 * 处理来自 ClassIn 的各种回调消息
 */

import { ClassInCallbackData, MessageHandler } from './callback-types';
import crypto from 'crypto';

// ClassIn 安全密钥，从环境变量获取
const CLASSIN_SECRET = process.env.CLASSIN_SECRET || 'your-secret-key';

/**
 * 验证安全密钥
 * @param safeKey 接收到的安全密钥
 * @param timeStamp 时间戳
 * @returns 验证结果
 */
export function verifySafeKey(safeKey: string, timeStamp: number): boolean {
  try {
    const expectedSafeKey = crypto
      .createHash('md5')
      .update(CLASSIN_SECRET + timeStamp)
      .digest('hex');
    
    return safeKey === expectedSafeKey;
  } catch (error) {
    console.error('SafeKey verification error:', error);
    return false;
  }
}

/**
 * 记录收到的消息
 * @param messageType 消息类型
 * @param data 消息数据
 */
function logMessage(messageType: string, data: ClassInCallbackData): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 收到 ClassIn 消息类型: ${messageType}`);
  console.log('SID:', data.SID);
  console.log('数据:', JSON.stringify(data, null, 2));
}

/**
 * 处理举手消息
 */
async function handleRaiseHand(data: ClassInCallbackData): Promise<void> {
  console.log('处理举手消息:', data);
  // TODO: 保存举手记录到数据库
  // await db.raiseHands.create({
  //   data: {
  //     userId: data.UID,
  //     userName: data.userName,
  //     lessonId: data.lessonId,
  //     duration: data.duration,
  //     timestamp: new Date()
  //   }
  // });
}

/**
 * 处理奖励消息
 */
async function handleReward(data: ClassInCallbackData): Promise<void> {
  console.log('处理奖励消息:', data);
  // TODO: 保存奖励记录到数据库
}

/**
 * 处理进入教室消息
 */
async function handleEnterRoom(data: ClassInCallbackData): Promise<void> {
  console.log('处理进入教室消息:', data);
  // TODO: 保存进入教室记录到数据库
}

/**
 * 处理退出教室消息
 */
async function handleLeaveRoom(data: ClassInCallbackData): Promise<void> {
  console.log('处理退出教室消息:', data);
  // TODO: 保存退出教室记录到数据库
}

/**
 * 处理授权消息
 */
async function handleAuth(data: ClassInCallbackData): Promise<void> {
  console.log('处理授权消息:', data);
  // TODO: 处理授权逻辑
}

/**
 * 处理全体静音消息
 */
async function handleMuteAll(data: ClassInCallbackData): Promise<void> {
  console.log('处理全体静音消息:', data);
}

/**
 * 处理个人静音消息
 */
async function handleMute(data: ClassInCallbackData): Promise<void> {
  console.log('处理个人静音消息:', data);
}

/**
 * 处理答题器消息
 */
async function handleAnswer(data: ClassInCallbackData): Promise<void> {
  console.log('处理答题器消息:', data);
  // TODO: 保存答题结果到数据库
}

/**
 * 处理抢答器消息
 */
async function handleGrab(data: ClassInCallbackData): Promise<void> {
  console.log('处理抢答器消息:', data);
  // TODO: 保存抢答结果到数据库
}

/**
 * 处理上下台消息
 */
async function handleOnStage(data: ClassInCallbackData): Promise<void> {
  console.log('处理上下台消息:', data);
}

/**
 * 处理课节网络状态
 */
async function handleNetworkStatus(data: ClassInCallbackData): Promise<void> {
  console.log('处理课节网络状态:', data);
  // TODO: 保存网络状态到数据库
}

/**
 * 处理设备检测消息
 */
async function handleDeviceCheck(data: ClassInCallbackData): Promise<void> {
  console.log('处理设备检测消息:', data);
}

/**
 * 处理求助消息
 */
async function handleHelp(data: ClassInCallbackData): Promise<void> {
  console.log('处理求助消息:', data);
  // TODO: 处理求助逻辑，可能需要发送通知
}

/**
 * 处理延长课节时长消息
 */
async function handleExtendLesson(data: ClassInCallbackData): Promise<void> {
  console.log('处理延长课节时长消息:', data);
}

/**
 * 处理启动录课详情
 */
async function handleRecordStart(data: ClassInCallbackData): Promise<void> {
  console.log('处理启动录课详情:', data);
}

/**
 * 处理大黑板板书图片
 */
async function handleBlackboardImage(data: ClassInCallbackData): Promise<void> {
  console.log('处理大黑板板书图片:', data);
  // TODO: 保存板书图片到存储服务
}

/**
 * 处理直播相关消息
 */
async function handleLive(data: ClassInCallbackData): Promise<void> {
  console.log('处理直播相关消息:', data);
  // TODO: 处理直播相关逻辑
}

/**
 * 处理课后汇总数据
 */
async function handleLessonSummary(data: ClassInCallbackData): Promise<void> {
  console.log('处理课后汇总数据:', data);
  // TODO: 保存课后汇总数据到数据库
  // 可能包括学生出勤、互动统计等
}

/**
 * 处理课节评价和评分
 */
async function handleLessonEvaluation(data: ClassInCallbackData): Promise<void> {
  console.log('处理课节评价和评分:', data);
  // TODO: 保存评价数据到数据库
}

/**
 * 处理录课文件
 */
async function handleLessonRecord(data: ClassInCallbackData): Promise<void> {
  console.log('处理录课文件:', data);
  // TODO: 保存录课文件信息到数据库
}

/**
 * 处理多人多题答题信息
 */
async function handleQuizResult(data: ClassInCallbackData): Promise<void> {
  console.log('处理多人多题答题信息:', data);
  // TODO: 保存答题统计到数据库
}

/**
 * 处理回放观看数据
 */
async function handlePlayback(data: ClassInCallbackData): Promise<void> {
  console.log('处理回放观看数据:', data);
  // TODO: 保存观看记录到数据库
}

/**
 * 处理文件转换结果
 */
async function handleFileConvert(data: ClassInCallbackData): Promise<void> {
  console.log('处理文件转换结果:', data);
  // TODO: 处理文件转换完成后的逻辑
}

/**
 * 处理账号注销
 */
async function handleAccountCancel(data: ClassInCallbackData): Promise<void> {
  console.log('处理账号注销:', data);
  // TODO: 处理账号注销逻辑
}

/**
 * 处理更换手机号
 */
async function handleChangePhone(data: ClassInCallbackData): Promise<void> {
  console.log('处理更换手机号:', data);
  // TODO: 更新用户手机号
}

/**
 * 处理设置子账号
 */
async function handleSubAccount(data: ClassInCallbackData): Promise<void> {
  console.log('处理设置子账号:', data);
  // TODO: 处理子账号设置逻辑
}

/**
 * 根据消息类型分发处理
 * @param cmd 命令类型
 * @param data 回调数据
 */
export async function handleMessage(cmd: string, data: ClassInCallbackData): Promise<void> {
  logMessage(cmd, data);

  try {
    switch (cmd) {
      case 'Test':
        console.log('✅ 收到测试消息');
        break;

      case 'raiseHand':
        await handleRaiseHand(data);
        break;

      case 'reward':
        await handleReward(data);
        break;

      case 'enterRoom':
        await handleEnterRoom(data);
        break;

      case 'leaveRoom':
        await handleLeaveRoom(data);
        break;

      case 'auth':
        await handleAuth(data);
        break;

      case 'muteAll':
        await handleMuteAll(data);
        break;

      case 'mute':
        await handleMute(data);
        break;

      case 'answer':
        await handleAnswer(data);
        break;

      case 'grab':
        await handleGrab(data);
        break;

      case 'onStage':
        await handleOnStage(data);
        break;

      case 'networkStatus':
        await handleNetworkStatus(data);
        break;

      case 'deviceCheck':
        await handleDeviceCheck(data);
        break;

      case 'help':
        await handleHelp(data);
        break;

      case 'extendLesson':
        await handleExtendLesson(data);
        break;

      case 'recordStart':
        await handleRecordStart(data);
        break;

      case 'blackboardImage':
        await handleBlackboardImage(data);
        break;

      case 'liveLogin':
      case 'liveBooking':
      case 'liveView':
      case 'liveLike':
      case 'liveProductClick':
        await handleLive(data);
        break;

      case 'lessonSummary':
        await handleLessonSummary(data);
        break;

      case 'lessonEvaluation':
        await handleLessonEvaluation(data);
        break;

      case 'lessonRecord':
        await handleLessonRecord(data);
        break;

      case 'quizResult':
        await handleQuizResult(data);
        break;

      case 'webPlayback':
      case 'clientPlayback':
        await handlePlayback(data);
        break;

      case 'fileConvert':
        await handleFileConvert(data);
        break;

      case 'accountCancel':
        await handleAccountCancel(data);
        break;

      case 'changePhone':
        await handleChangePhone(data);
        break;

      case 'subAccount':
        await handleSubAccount(data);
        break;

      default:
        console.log(`⚠️  未处理的消息类型: ${cmd}`);
        console.log('数据:', JSON.stringify(data, null, 2));
        break;
    }
  } catch (error) {
    console.error(`处理消息 ${cmd} 时发生错误:`, error);
    // 不抛出错误，避免影响 ClassIn 的回调重试机制
    // ClassIn 期望收到成功响应，即使处理失败也要返回成功状态
  }
}
