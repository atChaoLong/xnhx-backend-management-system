/**
 * ClassIn 回调数据类型定义
 */

// 基础回调数据结构
export interface ClassInCallbackData {
  SID: number;
  Cmd: string;
  Msg?: string;
  SafeKey: string;
  TimeStamp: number;
  [key: string]: any;
}

// 错误信息接口
export interface ErrorInfo {
  errno: number;
  error: string;
}

// 回调响应接口
export interface CallbackResponse {
  error_info: ErrorInfo;
}

// 举手消息数据
export interface RaiseHandData {
  UID: number;
  userName: string;
  lessonId: string;
  duration: number;
  [key: string]: any;
}

// 奖励消息数据
export interface RewardData {
  UID: number;
  userName: string;
  lessonId: string;
  rewardCount: number;
  [key: string]: any;
}

// 进出教室消息数据
export interface RoomData {
  UID: number;
  userName: string;
  lessonId: string;
  enterTime?: string;
  leaveTime?: string;
  [key: string]: any;
}

// 课后汇总数据
export interface LessonSummaryData {
  lessonId: string;
  startTime: string;
  endTime: string;
  studentCount: number;
  teacherCount: number;
  [key: string]: any;
}

// 录课文件数据
export interface LessonRecordData {
  lessonId: string;
  recordUrl: string;
  duration: number;
  fileSize: number;
  [key: string]: any;
}

// 消息处理器类型
export type MessageHandler = (data: ClassInCallbackData) => Promise<void>;

// 课堂结束统计数据
export interface ClassEndData {
  ClassID: number;
  CourseID: number;
  SID: number;
  StartTime: number;
  CloseTime: number;
  RealCloseTime: number;
  Data: ClassEndStatistics;
  [key: string]: any;
}

// 课堂统计详情
export interface ClassEndStatistics {
  stageEnd: Record<string, StageStatistics>;
  silenceEnd: SilenceStatistics;
  screenchangeEnd: Record<string, ScreenChangeStatistics>;
  mdscreenEnd: MdscreenStatistics;
  authorizeEnd: Record<string, AuthorizeStatistics>;
  inoutEnd: Record<string, InoutStatistics>;
  muteEnd: MuteStatistics;
  equipmentsEnd: Record<string, EquipmentStatistics>;
}

// 上讲台统计
export interface StageStatistics {
  UpTotal: number;
  DownCount: number;
  UpCount: number;
  DownTotal: number;
}

// 静音统计
export interface SilenceStatistics {
  SilenceAll: {
    Count: number;
    Total: number;
  };
  Persons: Record<string, {
    Total: number;
  }>;
}

// 切屏统计
export interface ScreenChangeStatistics {
  WindowTotal: number;
  WindowCount: number;
  Details: any[];
  FullTotal: number;
  FullCount: number;
}

// 屏幕共享统计
export interface MdscreenStatistics {
  Count: number;
  Total: number;
}

// 授权统计
export interface AuthorizeStatistics {
  Count: number;
  Total: number;
}

// 进出课堂统计
export interface InoutStatistics {
  Identity: number;
  Total: number;
  Details: Array<{
    Device: number;
    Type: 'In' | 'Out';
    Time: number;
  }>;
  Deputies: Array<{
    ClientID: number;
    Total: number;
    Details: Array<{
      Device: number;
      Type: 'In' | 'Out';
      Time: number;
    }>;
  }>;
}

// 静音统计
export interface MuteStatistics {
  MuteAll: {
    Count: number;
    Total: number;
  };
  Persons: Record<string, {
    Total: number;
  }>;
}

// 设备统计
export interface EquipmentStatistics {
  Microphone: {
    Total: number;
    TotalNotDisabled: number;
  };
  Camera: {
    Total: number;
    TotalNotDisabled: number;
  };
}

// ClassIn 回调命令类型
export type ClassInCommand =
  | 'Test'
  | 'raiseHand'
  | 'reward'
  | 'enterRoom'
  | 'leaveRoom'
  | 'auth'
  | 'muteAll'
  | 'mute'
  | 'answer'
  | 'grab'
  | 'onStage'
  | 'networkStatus'
  | 'deviceCheck'
  | 'help'
  | 'extendLesson'
  | 'recordStart'
  | 'blackboardImage'
  | 'liveLogin'
  | 'liveBooking'
  | 'liveView'
  | 'liveLike'
  | 'liveProductClick'
  | 'lessonSummary'
  | 'lessonEvaluation'
  | 'lessonRecord'
  | 'quizResult'
  | 'webPlayback'
  | 'clientPlayback'
  | 'fileConvert'
  | 'accountCancel'
  | 'changePhone'
  | 'subAccount'
  | 'End';
